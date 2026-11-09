/**
 * @nature [API]
 * @module GoogleOAuth
 * @description Flusso OAuth 2.0 Authorization Code + PKCE (S256) per app desktop con redirect loopback sul server locale.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/auth/google-oauth.test.ts
 */
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { err, ok, type Result } from '@manaforge/shared';
import type { GoogleProfile } from './auth-service.js';
import { createExpiringStore } from './expiring-store.js';

/** Endpoint di autorizzazione Google. */
export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
/** Endpoint di scambio del codice. */
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
/** Endpoint OpenID userinfo. */
export const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
/** Validità di un flusso avviato e non completato. */
export const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;
/** Flussi pendenti massimi contemporanei. */
export const OAUTH_MAX_PENDING_FLOWS = 50;
/** Timeout delle chiamate HTTP verso Google. */
export const GOOGLE_HTTP_TIMEOUT_MS = 10_000;

/** Configurazione del client OAuth (Client ID di tipo "Desktop app" in Google Cloud Console). */
export interface GoogleOAuthConfig {
  readonly clientId: string;
  /** Per i client "Desktop" Google lo richiede ma non è considerato segreto (RFC 8252 §8.5). */
  readonly clientSecret?: string | undefined;
  /** URL loopback del server locale, es. `http://127.0.0.1:47821/api/auth/google/callback`. */
  readonly redirectUri: string;
}

/** Errori del flusso Google. */
export type GoogleOAuthError = 'GOOGLE_STATE_INVALID' | 'GOOGLE_DENIED' | 'GOOGLE_EXCHANGE_FAILED';

/** Parametri ricevuti sulla callback. */
export interface GoogleCallbackParams {
  readonly state?: string | undefined;
  readonly code?: string | undefined;
  readonly error?: string | undefined;
}

/** Flusso OAuth Google. */
export interface GoogleOAuth {
  /** Avvia un flusso: genera state e verifier PKCE e restituisce l'URL da aprire nel browser di sistema. */
  start(): { authUrl: string; state: string };
  /** Indica se lo state appartiene a un flusso avviato e non ancora concluso. */
  isPending(state: string): boolean;
  /** Completa il flusso: valida lo state (uso singolo), scambia il codice e legge il profilo. */
  complete(params: GoogleCallbackParams): Promise<Result<{ state: string; profile: GoogleProfile }, GoogleOAuthError>>;
}

/** Dipendenze di {@link createGoogleOAuth}. */
export interface GoogleOAuthDeps {
  readonly config: GoogleOAuthConfig;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
}

const base64Url = (bytes: Buffer): string => bytes.toString('base64url');

/**
 * Calcola il code challenge PKCE S256.
 *
 * @param verifier - Code verifier (43–128 caratteri).
 * @returns `BASE64URL(SHA256(verifier))`.
 */
export const pkceChallenge = (verifier: string): string => base64Url(createHash('sha256').update(verifier).digest());

const TokenResponseSchema = z.object({ access_token: z.string().min(1) });
const UserInfoSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

/**
 * Crea il gestore del flusso OAuth Google.
 *
 * @param deps - Configurazione, `fetch` e orologio iniettabili.
 * @returns Il {@link GoogleOAuth}.
 */
export const createGoogleOAuth = ({ config, fetch = globalThis.fetch, now = Date.now }: GoogleOAuthDeps): GoogleOAuth => {
  const pending = createExpiringStore<{ verifier: string }>({
    ttlMs: OAUTH_FLOW_TTL_MS,
    maxEntries: OAUTH_MAX_PENDING_FLOWS,
    now,
  });

  const exchange = async (code: string, verifier: string): Promise<GoogleProfile | undefined> => {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });
    if (config.clientSecret) body.set('client_secret', config.clientSecret);

    const tokenRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(GOOGLE_HTTP_TIMEOUT_MS),
    });
    if (!tokenRes.ok) return undefined;
    const tokenData = TokenResponseSchema.safeParse(await tokenRes.json());
    if (!tokenData.success) return undefined;

    const infoRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${tokenData.data.access_token}` },
      signal: AbortSignal.timeout(GOOGLE_HTTP_TIMEOUT_MS),
    });
    if (!infoRes.ok) return undefined;
    const info = UserInfoSchema.safeParse(await infoRes.json());
    if (!info.success) return undefined;
    return {
      sub: info.data.sub,
      email: info.data.email,
      emailVerified: info.data.email_verified === true,
      name: info.data.name,
    };
  };

  return {
    start() {
      const state = base64Url(randomBytes(32));
      const verifier = base64Url(randomBytes(32));
      pending.set(state, { verifier });
      const url = new URL(GOOGLE_AUTH_ENDPOINT);
      url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: pkceChallenge(verifier),
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }).toString();
      return { authUrl: url.toString(), state };
    },

    isPending: (state) => pending.get(state) !== undefined,

    async complete({ state, code, error }) {
      const flow = state ? pending.take(state) : undefined;
      if (!state || !flow) return err('GOOGLE_STATE_INVALID');
      if (error || !code) return err('GOOGLE_DENIED');
      try {
        const profile = await exchange(code, flow.verifier);
        return profile ? ok({ state, profile }) : err('GOOGLE_EXCHANGE_FAILED');
      } catch {
        return err('GOOGLE_EXCHANGE_FAILED');
      }
    },
  };
};
