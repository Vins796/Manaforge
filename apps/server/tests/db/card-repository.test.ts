/**
 * @nature [TEST]
 * @module CardRepositoryTest
 * @description Verifica lettura per id, elenco ordinato e aggiornamento dei percorsi immagine della tabella `cards`.
 * @relatedDocs docs/catalog/TEST/04-catalog-tests.md
 * @testFile apps/server/tests/db/card-repository.test.ts
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unwrap } from '@manaforge/shared';
import { syncCatalog } from '../../src/catalog/catalog-sync.js';
import { createCardRepository } from '../../src/db/card-repository.js';
import { IN_MEMORY, openDatabase, type DatabaseConnection } from '../../src/db/db-client.js';
import { loadTestCatalog } from '../helpers/catalog-fixtures.js';

describe('CardRepository', () => {
  let conn: DatabaseConnection;

  beforeEach(() => {
    conn = unwrap(openDatabase({ filename: IN_MEMORY }));
    unwrap(syncCatalog(conn.db, loadTestCatalog()));
  });

  afterEach(() => conn.close());

  it('trova per id e restituisce undefined per id sconosciuti', () => {
    const repo = createCardRepository(conn.db);
    expect(repo.findById('TS1-003')?.name).toBe('Lampo di Prova');
    expect(repo.findById('TS1-404')).toBeUndefined();
  });

  it('elenca per valore di mana e poi per nome', () => {
    expect(createCardRepository(conn.db).listAll().map((card) => card.id)).toEqual(['TS1-001', 'TS1-003', 'TS1-002']);
  });

  it('aggiorna i percorsi delle immagini', () => {
    const repo = createCardRepository(conn.db);
    expect(repo.setImagePaths('TS1-002', { normalPath: '/c/n.svg', cropPath: '/c/c.svg' })).toMatchObject({
      localImageNormalPath: '/c/n.svg',
      localImageCropPath: '/c/c.svg',
    });
    expect(repo.setImagePaths('TS1-404', { normalPath: '/n', cropPath: '/c' })).toBeUndefined();
  });
});
