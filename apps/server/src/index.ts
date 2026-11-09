/**
 * @nature [ARCH]
 * @module ServerIndex
 * @description Entry point del backend locale. Fastify, Socket.io e SQLite vengono aggiunti dagli step 1.2–1.3.
 * @relatedDocs docs/catalog/ARCH/01-monorepo-setup.md
 * @testFile apps/server/tests/smoke.test.ts
 */
import { ENGINE_ID } from '@manaforge/engine';
import { APP_NAME } from '@manaforge/shared';

/** Metadati del servizio esposti dall'endpoint di health (step 1.3). */
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
