/**
 * @nature [API]
 * @module JwtSecret
 * @description Carica il segreto JWT locale o lo genera al primo avvio (file con permessi 0600).
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/auth/jwt-secret.test.ts
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { err, ok, type Result } from '@manaforge/shared';

/** Dimensione del segreto generato, in byte. */
export const JWT_SECRET_BYTES = 64;

/** Errore di caricamento del segreto. */
export interface JwtSecretError {
  readonly code: 'JWT_SECRET_INVALID' | 'JWT_SECRET_IO';
  readonly message: string;
}

const isMissingFile = (cause: unknown): boolean =>
  typeof cause === 'object' && cause !== null && (cause as { code?: unknown }).code === 'ENOENT';

/**
 * Restituisce il segreto salvato in `filePath`, creandolo se assente.
 * La creazione usa il flag `wx`, quindi non sovrascrive mai un file esistente.
 *
 * @param filePath - Percorso del file del segreto (es. `~/.manaforge/data/jwt.secret`).
 * @returns Il segreto, oppure un errore se il file è corrotto o non accessibile.
 */
export const loadOrCreateJwtSecret = (filePath: string): Result<Uint8Array, JwtSecretError> => {
  try {
    const existing = readFileSync(filePath);
    if (existing.byteLength !== JWT_SECRET_BYTES) {
      return err({ code: 'JWT_SECRET_INVALID', message: `Il file ${filePath} non contiene ${JWT_SECRET_BYTES} byte` });
    }
    return ok(new Uint8Array(existing));
  } catch (cause) {
    if (!isMissingFile(cause)) return err({ code: 'JWT_SECRET_IO', message: String(cause) });
  }
  try {
    const secret = randomBytes(JWT_SECRET_BYTES);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, secret, { mode: 0o600, flag: 'wx' });
    return ok(new Uint8Array(secret));
  } catch (cause) {
    return err({ code: 'JWT_SECRET_IO', message: String(cause) });
  }
};
