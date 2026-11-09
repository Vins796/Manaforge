/**
 * @nature [ARCH]
 * @module ServerIndex
 * @description API pubblica del backend locale (composizione e factory dei servizi).
 * @relatedDocs docs/catalog/ARCH/01-monorepo-setup.md
 * @testFile apps/server/tests/smoke.test.ts
 */
import { ENGINE_ID } from '@manaforge/engine';
import { APP_NAME } from '@manaforge/shared';

export { buildApp } from './app.js';
export { createAuthService } from './auth/auth-service.js';
export { createGoogleOAuth } from './auth/google-oauth.js';
export { createTokenService } from './auth/token-service.js';
export { loadServerConfig } from './config.js';
export { startServer } from './server.js';

/** Metadati del servizio. */
export interface ServerInfo {
  readonly name: string;
  readonly engine: string;
}

/**
 * Restituisce i metadati del server locale.
 *
 * @returns Nome del servizio e identificativo dell'engine collegato.
 */
export const getServerInfo = (): ServerInfo => ({ name: `${APP_NAME}/server`, engine: ENGINE_ID });
