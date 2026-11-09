/**
 * @nature [API]
 * @module TokenService
 * @description Emissione e verifica dei JWT di sessione (HS256) con issuer/audience fissi e scadenza.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/auth/token-service.test.ts
 */
import { SignJWT, jwtVerify } from 'jose';
import { err, ok, type Result } from '@manaforge/shared';

/** Emittente dei token. */
export const JWT_ISSUER = 'manaforge-server';
/** Destinatario dei token. */
export const JWT_AUDIENCE = 'manaforge-client';
/** Durata predefinita della sessione: 7 giorni. */
export const DEFAULT_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Lunghezza minima del segreto HS256 in byte. */
export const MIN_SECRET_BYTES = 32;

/** Token emesso con la sua scadenza. */
export interface IssuedToken {
  readonly token: string;
  readonly expiresAt: Date;
}

/** Servizio di gestione dei token. */
export interface TokenService {
  /** Emette un token per l'utente indicato. */
  issue(userId: string): Promise<IssuedToken>;
  /** Verifica firma, issuer, audience e scadenza; restituisce l'id utente. */
  verify(token: string): Promise<Result<{ userId: string }, 'INVALID_TOKEN'>>;
}

/** Opzioni di {@link createTokenService}. */
export interface TokenServiceOptions {
  readonly secret: Uint8Array;
  readonly ttlSeconds?: number;
  /** Orologio iniettabile per i test. */
  readonly now?: () => Date;
}

/**
 * Crea il servizio dei token.
 *
 * @param options - Segreto (≥ 32 byte), durata e orologio.
 * @returns Il {@link TokenService}.
 * @throws Error se il segreto è troppo corto o la durata non è positiva (errore di configurazione).
 */
export const createTokenService = ({
  secret,
  ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS,
  now = () => new Date(),
}: TokenServiceOptions): TokenService => {
  if (secret.byteLength < MIN_SECRET_BYTES) throw new Error(`Il segreto JWT deve avere almeno ${MIN_SECRET_BYTES} byte`);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) throw new Error('ttlSeconds deve essere un intero positivo');

  return {
    async issue(userId) {
      const issuedAt = Math.floor(now().getTime() / 1000);
      const expiresAtSeconds = issuedAt + ttlSeconds;
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(userId)
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt(issuedAt)
        .setExpirationTime(expiresAtSeconds)
        .sign(secret);
      return { token, expiresAt: new Date(expiresAtSeconds * 1000) };
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, secret, {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          algorithms: ['HS256'],
          currentDate: now(),
        });
        return payload.sub ? ok({ userId: payload.sub }) : err('INVALID_TOKEN');
      } catch {
        return err('INVALID_TOKEN');
      }
    },
  };
};
