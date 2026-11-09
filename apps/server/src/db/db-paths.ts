/**
 * @nature [DATA]
 * @module DbPaths
 * @description Calcola i percorsi locali di dati e cache (`~/.manaforge/data`, `~/.manaforge/cache/images`).
 * @relatedDocs docs/catalog/DATA/01-sqlite-schema.md
 * @testFile apps/server/tests/db/db-paths.test.ts
 */
import { isAbsolute, join } from 'node:path';
import { err, ok, type Result } from '@manaforge/shared';

/** Nome della cartella applicativa nella home dell'utente. */
export const APP_DIR_NAME = '.manaforge';
/** Nome del file del database SQLite. */
export const DB_FILE_NAME = 'manaforge.db';

/** Percorsi assoluti usati dal server locale. */
export interface DataPaths {
  readonly rootDir: string;
  readonly dataDir: string;
  readonly dbFile: string;
  readonly imageCacheDir: string;
}

/** Errore restituito da {@link resolveDataPaths}. */
export interface DataPathsError {
  readonly code: 'HOME_DIR_NOT_ABSOLUTE';
  readonly homeDir: string;
}

/**
 * Costruisce i percorsi dei dati a partire dalla home dell'utente.
 *
 * @param homeDir - Home directory assoluta (in produzione `os.homedir()`).
 * @returns I percorsi, oppure un errore se `homeDir` non è assoluta.
 */
export const resolveDataPaths = (homeDir: string): Result<DataPaths, DataPathsError> => {
  if (homeDir.trim() === '' || !isAbsolute(homeDir)) {
    return err({ code: 'HOME_DIR_NOT_ABSOLUTE', homeDir });
  }
  const rootDir = join(homeDir, APP_DIR_NAME);
  const dataDir = join(rootDir, 'data');
  return ok({
    rootDir,
    dataDir,
    dbFile: join(dataDir, DB_FILE_NAME),
    imageCacheDir: join(rootDir, 'cache', 'images'),
  });
};
