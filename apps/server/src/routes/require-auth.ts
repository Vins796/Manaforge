/**
 * @nature [API]
 * @module RequireAuth
 * @description Estrazione del Bearer token e verifica della sessione per le rotte protette (JWT valido e utente ancora esistente).
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/routes/require-auth.test.ts
 */
import type { FastifyRequest } from 'fastify';
import type { AuthService } from '../auth/auth-service.js';
import type { TokenService } from '../auth/token-service.js';

/** Restituisce l'id dell'utente autenticato, o `undefined` se la richiesta non ha una sessione valida. */
export type AuthGuard = (request: FastifyRequest) => Promise<string | undefined>;

/**
 * Legge il token dall'header `Authorization: Bearer <token>`.
 *
 * @param request - Richiesta Fastify.
 * @returns Il token, oppure `undefined` se l'header manca o è malformato.
 */
export const bearerToken = (request: FastifyRequest): string | undefined => {
  const header = request.headers.authorization;
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match?.[1];
};

/**
 * Crea la guardia di autenticazione.
 *
 * @param deps - Servizio token e servizio di autenticazione (per verificare che l'utente esista ancora).
 * @returns L'{@link AuthGuard}.
 */
export const createAuthGuard = ({ tokens, auth }: { readonly tokens: TokenService; readonly auth: AuthService }): AuthGuard =>
  async (request) => {
    const token = bearerToken(request);
    const verified = token ? await tokens.verify(token) : undefined;
    if (!verified?.ok) return undefined;
    return auth.getProfile(verified.value.userId).ok ? verified.value.userId : undefined;
  };
