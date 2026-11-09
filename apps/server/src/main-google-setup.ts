/**
 * @nature [ARCH]
 * @module MainGoogleSetup
 * @description CLI: `pnpm --filter @manaforge/server google:setup <client_secret.json>` scrive le credenziali Google in `apps/server/.env`.
 *   Solo wiring di processo (eccezione entry point, `.cursorrules §4`).
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/auth/google-credentials.test.ts
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGoogleEnvFromJson } from './auth/google-credentials.js';

const arg = process.argv[2];
if (!arg) {
  console.error('Uso: pnpm --filter @manaforge/server google:setup <percorso/client_secret.json>');
  process.exit(1);
}

// pnpm esegue lo script dentro apps/server: i percorsi relativi vanno risolti dalla cartella da cui è stato lanciato.
const jsonPath = resolve(process.env.INIT_CWD ?? process.cwd(), arg);
const envPath = fileURLToPath(new URL('../.env', import.meta.url));

const result = writeGoogleEnvFromJson({ jsonPath, envPath });
if (!result.ok) {
  console.error(result.error.message);
  process.exit(1);
}
const masked = `${result.value.clientSecret.slice(0, 7)}…`;
console.log(`Credenziali Google salvate in ${envPath}\n  client_id: ${result.value.clientId}\n  client_secret: ${masked}`);
