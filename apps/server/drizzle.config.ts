/**
 * @nature [DATA]
 * @module DrizzleConfig
 * @description Configurazione di drizzle-kit per generare le migrazioni SQL in `apps/server/drizzle`.
 * @relatedDocs docs/catalog/DATA/01-sqlite-schema.md
 * @testFile apps/server/tests/db/db-client.test.ts
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/db-schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});
