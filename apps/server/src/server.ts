/**
 * @nature [ARCH]
 * @module Server
 * @description Composizione del server locale: percorsi dati, DB, segreto JWT, servizi, Fastify in ascolto.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/server.test.ts
 */
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { err, ok, type Result } from '@manaforge/shared';
import { buildApp } from './app.js';
import { createAuthService } from './auth/auth-service.js';
import { createGoogleOAuth } from './auth/google-oauth.js';
import { loadOrCreateJwtSecret } from './auth/jwt-secret.js';
import { createTokenService } from './auth/token-service.js';
import type { ServerConfig } from './config.js';
import { openDatabase } from './db/db-client.js';
import { resolveDataPaths } from './db/db-paths.js';
import { createUserRepository } from './db/user-repository.js';

/** Nome del file del segreto JWT nella cartella dati. */
export const JWT_SECRET_FILE = 'jwt.secret';

/** Server avviato. */
export interface RunningServer {
  readonly app: FastifyInstance;
  /** URL base effettivo (porta reale se `port` era 0). */
  readonly url: string;
  readonly close: () => Promise<void>;
}

/** Opzioni di {@link startServer}. */
export interface StartServerOptions {
  readonly homeDir: string;
  readonly config: ServerConfig;
  readonly logger?: boolean;
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * Avvia il server locale.
 *
 * @param options - Home dell'utente, configurazione e dipendenze iniettabili.
 * @returns Il server in ascolto, oppure un messaggio di errore di avvio.
 */
export const startServer = async ({ homeDir, config, logger = false, fetch }: StartServerOptions): Promise<Result<RunningServer, string>> => {
  const paths = resolveDataPaths(homeDir);
  if (!paths.ok) return err(`Home directory non valida: ${paths.error.homeDir}`);

  const conn = openDatabase({ filename: paths.value.dbFile });
  if (!conn.ok) return err(`${conn.error.code}: ${conn.error.message}`);

  const secret = loadOrCreateJwtSecret(join(paths.value.dataDir, JWT_SECRET_FILE));
  if (!secret.ok) {
    conn.value.close();
    return err(`${secret.error.code}: ${secret.error.message}`);
  }

  const tokens = createTokenService({ secret: secret.value });
  const auth = createAuthService({ users: createUserRepository(conn.value.db), tokens });
  const redirectUri = `http://127.0.0.1:${config.port}/api/auth/google/callback`;
  const google = config.google
    ? createGoogleOAuth({ config: { ...config.google, redirectUri }, ...(fetch ? { fetch } : {}) })
    : null;

  const app = await buildApp({ auth, tokens, google, allowedOrigins: config.allowedOrigins, logger });
  try {
    const url = await app.listen({ host: config.host, port: config.port });
    return ok({
      app,
      url,
      close: async () => {
        await app.close();
        conn.value.close();
      },
    });
  } catch (cause) {
    await app.close();
    conn.value.close();
    return err(`Impossibile mettersi in ascolto: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
};
