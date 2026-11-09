/**
 * @nature [API]
 * @module AuthRoutes
 * @description Rotte REST `/api/auth/*`: registrazione, login, profilo corrente e flusso Google (start, callback loopback, polling).
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/routes/auth.test.ts
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  LoginRequestSchema,
  RegisterRequestSchema,
  type AuthErrorCode,
  type AuthResponse,
  type GoogleResultResponse,
} from '@manaforge/shared';
import type { AuthService } from '../auth/auth-service.js';
import { createExpiringStore } from '../auth/expiring-store.js';
import { OAUTH_FLOW_TTL_MS, OAUTH_MAX_PENDING_FLOWS, type GoogleOAuth } from '../auth/google-oauth.js';
import type { TokenService } from '../auth/token-service.js';

/** Tentativi di login/registrazione consentiti per IP al minuto. */
export const AUTH_RATE_LIMIT_PER_MINUTE = 10;

/** Dipendenze delle rotte di autenticazione. */
export interface AuthRoutesDeps {
  readonly auth: AuthService;
  readonly tokens: TokenService;
  /** `null` se il Client ID Google non è configurato. */
  readonly google: GoogleOAuth | null;
}

const MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  VALIDATION_ERROR: 'Dati non validi.',
  EMAIL_TAKEN: 'Esiste già un account con questa email.',
  INVALID_CREDENTIALS: 'Email o password non corretti.',
  UNAUTHORIZED: 'Sessione mancante o scaduta.',
  USER_NOT_FOUND: 'Utente non trovato.',
  RATE_LIMITED: 'Troppi tentativi, riprova tra poco.',
  GOOGLE_NOT_CONFIGURED: 'Accesso con Google non configurato.',
  GOOGLE_STATE_INVALID: 'Richiesta di accesso Google scaduta o non valida.',
  GOOGLE_DENIED: 'Accesso con Google annullato.',
  GOOGLE_EXCHANGE_FAILED: 'Impossibile completare l\'accesso con Google.',
  GOOGLE_EMAIL_NOT_VERIFIED: 'L\'email dell\'account Google non è verificata.',
  GOOGLE_ACCOUNT_CONFLICT: 'Questa email è già collegata a un altro account Google.',
  NOT_FOUND: 'Risorsa non trovata.',
  INTERNAL_ERROR: 'Errore interno del server.',
};

/**
 * Invia una risposta di errore nel formato standard `{ error: { code, message } }`.
 *
 * @param reply - Risposta Fastify.
 * @param status - Codice HTTP.
 * @param code - Codice applicativo.
 * @param message - Messaggio opzionale; default il testo standard del codice.
 * @returns La risposta inviata.
 */
export const sendError = (reply: FastifyReply, status: number, code: AuthErrorCode, message = MESSAGES[code]) =>
  reply.code(status).send({ error: { code, message } });

const StateQuerySchema = z.object({ state: z.string().min(1).max(128) });
const CallbackQuerySchema = z.object({
  state: z.string().max(128).optional(),
  code: z.string().max(2048).optional(),
  error: z.string().max(256).optional(),
});

const callbackPage = (title: string, message: string): string =>
  `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Manaforge</title>
<style>body{background:#0B0E14;color:#ece8df;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}</style>
</head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;

const bearerToken = (request: FastifyRequest): string | undefined => {
  const header = request.headers.authorization;
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match?.[1];
};

/**
 * Registra le rotte di autenticazione.
 *
 * @param app - Istanza Fastify (con `@fastify/rate-limit` già registrato).
 * @param deps - Servizi di autenticazione, token e Google.
 */
export const registerAuthRoutes = async (app: FastifyInstance, { auth, tokens, google }: AuthRoutesDeps): Promise<void> => {
  const googleResults = createExpiringStore<GoogleResultResponse>({
    ttlMs: OAUTH_FLOW_TTL_MS,
    maxEntries: OAUTH_MAX_PENDING_FLOWS,
  });
  const strictLimit = { rateLimit: { max: AUTH_RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' } };

  app.post('/api/auth/register', { config: strictLimit }, async (request, reply) => {
    const body = RegisterRequestSchema.safeParse(request.body);
    if (!body.success) return sendError(reply, 400, 'VALIDATION_ERROR', z.prettifyError(body.error));
    const result = await auth.register(body.data);
    return result.ok ? reply.code(201).send(result.value) : sendError(reply, 409, result.error);
  });

  app.post('/api/auth/login', { config: strictLimit }, async (request, reply) => {
    const body = LoginRequestSchema.safeParse(request.body);
    if (!body.success) return sendError(reply, 400, 'VALIDATION_ERROR', z.prettifyError(body.error));
    const result = await auth.login(body.data);
    return result.ok ? reply.send(result.value) : sendError(reply, 401, result.error);
  });

  app.get('/api/auth/me', async (request, reply) => {
    const token = bearerToken(request);
    const verified = token ? await tokens.verify(token) : undefined;
    if (!verified?.ok) return sendError(reply, 401, 'UNAUTHORIZED');
    const profile = auth.getProfile(verified.value.userId);
    return profile.ok ? reply.send(profile.value) : sendError(reply, 401, 'UNAUTHORIZED');
  });

  app.get('/api/auth/google/start', async (_request, reply) => {
    if (!google) return sendError(reply, 503, 'GOOGLE_NOT_CONFIGURED');
    return reply.send(google.start());
  });

  app.get('/api/auth/google/callback', async (request, reply) => {
    reply.type('text/html; charset=utf-8').header('cache-control', 'no-store');
    const query = CallbackQuerySchema.safeParse(request.query);
    if (!google || !query.success) {
      return reply.code(400).send(callbackPage('Accesso non riuscito', 'Richiesta non valida.'));
    }
    const flow = await google.complete(query.data);
    if (!flow.ok) {
      if (query.data.state && flow.error !== 'GOOGLE_STATE_INVALID') {
        googleResults.set(query.data.state, { status: 'error', code: flow.error });
      }
      return reply.code(400).send(callbackPage('Accesso non riuscito', MESSAGES[flow.error]));
    }
    const login = await auth.loginWithGoogle(flow.value.profile);
    const outcome: GoogleResultResponse = login.ok
      ? { status: 'complete', auth: login.value satisfies AuthResponse }
      : { status: 'error', code: login.error };
    googleResults.set(flow.value.state, outcome);
    return login.ok
      ? reply.send(callbackPage('Accesso completato', 'Puoi chiudere questa finestra e tornare a Manaforge.'))
      : reply.code(400).send(callbackPage('Accesso non riuscito', MESSAGES[login.error]));
  });

  app.get('/api/auth/google/result', async (request, reply) => {
    if (!google) return sendError(reply, 503, 'GOOGLE_NOT_CONFIGURED');
    const query = StateQuerySchema.safeParse(request.query);
    if (!query.success) return sendError(reply, 400, 'VALIDATION_ERROR');
    const outcome = googleResults.take(query.data.state);
    if (outcome) return reply.header('cache-control', 'no-store').send(outcome);
    if (google.isPending(query.data.state)) return reply.send({ status: 'pending' } satisfies GoogleResultResponse);
    return sendError(reply, 404, 'GOOGLE_STATE_INVALID');
  });
};
