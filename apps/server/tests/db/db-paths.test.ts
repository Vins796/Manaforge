/**
 * @nature [TEST]
 * @module DbPathsTest
 * @description Verifica il calcolo dei percorsi di dati e cache e il rifiuto di home non assolute.
 * @relatedDocs docs/catalog/DATA/01-sqlite-schema.md
 * @testFile apps/server/tests/db/db-paths.test.ts
 */
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDataPaths } from '../../src/db/db-paths.js';

describe('resolveDataPaths', () => {
  it('deriva tutti i percorsi da ~/.manaforge', () => {
    const home = resolve('/home/tester');
    const result = resolveDataPaths(home);
    expect(result).toEqual({
      ok: true,
      value: {
        rootDir: join(home, '.manaforge'),
        dataDir: join(home, '.manaforge', 'data'),
        dbFile: join(home, '.manaforge', 'data', 'manaforge.db'),
        imageCacheDir: join(home, '.manaforge', 'cache', 'images'),
      },
    });
  });

  it.each(['', '   ', 'relativa/home'])('rifiuta la home non assoluta %j', (home) => {
    expect(resolveDataPaths(home)).toEqual({ ok: false, error: { code: 'HOME_DIR_NOT_ABSOLUTE', homeDir: home } });
  });
});
