/**
 * @nature [DATA]
 * @module DbClient
 * @description Apre il database SQLite (file o in-memory), imposta i PRAGMA e applica le migrazioni Drizzle.
 * @relatedDocs docs/catalog/DATA/01-sqlite-schema.md
 * @testFile apps/server/tests/db/db-client.test.ts
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { err, ok, type Result } from '@manaforge/shared';
import * as schema from './db-schema.js';

/** Nome speciale per un database in memoria (test). */
export const IN_MEMORY = ':memory:';

/**
 * Cartella delle migrazioni SQL generate da `drizzle-kit`.
 * Risolta rispetto al modulo, quindi valida sia da `src/db` sia da `dist/db`.
 */
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Istanza Drizzle tipizzata sullo schema dell'app. */
export type AppDatabase = BetterSQLite3Database<typeof schema>;

/** Connessione aperta: istanza Drizzle + handle nativo + chiusura. */
export interface DatabaseConnection {
  readonly db: AppDatabase;
  readonly sqlite: Database.Database;
  readonly close: () => void;
}

/** Opzioni di {@link openDatabase}. */
export interface OpenDatabaseOptions {
  /** Percorso del file SQLite oppure {@link IN_MEMORY}. */
  readonly filename: string;
  /** Cartella delle migrazioni; default {@link DEFAULT_MIGRATIONS_DIR}. */
  readonly migrationsDir?: string;
}

/** Errore di apertura o migrazione del database. */
export interface DatabaseOpenError {
  readonly code: 'DB_OPEN_FAILED' | 'DB_MIGRATION_FAILED';
  readonly message: string;
}

const toMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/**
 * Apre il database, abilita chiavi esterne e WAL (solo su file) e applica le migrazioni pendenti.
 * L'operazione è idempotente: riaprire un DB già migrato non modifica lo schema.
 *
 * @param options - Percorso del database e cartella delle migrazioni.
 * @returns La connessione aperta, oppure un errore tipizzato. In caso di errore di migrazione la connessione viene chiusa.
 */
export const openDatabase = (
  options: OpenDatabaseOptions,
): Result<DatabaseConnection, DatabaseOpenError> => {
  const { filename, migrationsDir = DEFAULT_MIGRATIONS_DIR } = options;
  const inMemory = filename === IN_MEMORY;

  let sqlite: Database.Database;
  try {
    if (!inMemory) mkdirSync(dirname(filename), { recursive: true });
    sqlite = new Database(filename);
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('busy_timeout = 5000');
    if (!inMemory) sqlite.pragma('journal_mode = WAL');
  } catch (cause) {
    return err({ code: 'DB_OPEN_FAILED', message: toMessage(cause) });
  }

  const db = drizzle(sqlite, { schema });
  try {
    migrate(db, { migrationsFolder: migrationsDir });
  } catch (cause) {
    sqlite.close();
    return err({ code: 'DB_MIGRATION_FAILED', message: toMessage(cause) });
  }

  return ok({ db, sqlite, close: () => sqlite.close() });
};
