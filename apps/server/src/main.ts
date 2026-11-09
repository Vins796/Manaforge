/**
 * @nature [ARCH]
 * @module Main
 * @description Entry point eseguibile del server locale (avviato dal sidecar Tauri). Solo wiring di processo, nessuna logica.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/server.test.ts
 */
import { homedir } from 'node:os';
import { loadServerConfig } from './config.js';
import { startServer } from './server.js';

const config = loadServerConfig(process.env);
if (!config.ok) {
  console.error(`Configurazione non valida:\n${config.error}`);
  process.exit(1);
}

const server = await startServer({ homeDir: homedir(), config: config.value, logger: true });
if (!server.ok) {
  console.error(server.error);
  process.exit(1);
}

const shutdown = (): void => {
  void server.value.close().finally(() => process.exit(0));
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
