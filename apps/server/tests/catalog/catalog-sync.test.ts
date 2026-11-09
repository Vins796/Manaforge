/**
 * @nature [TEST]
 * @module CatalogSyncTest
 * @description Importa un batch di carte di prova in SQLite in-memory, verifica idempotenza, aggiornamenti, rimozioni
 *              protette dai mazzi e il salvataggio in cache su disco delle illustrazioni.
 * @relatedDocs docs/catalog/TEST/04-catalog-tests.md
 * @testFile apps/server/tests/catalog/catalog-sync.test.ts
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asc } from 'drizzle-orm';
import { unwrap } from '@manaforge/shared';
import { loadBundledCatalog } from '../../src/catalog/card-catalog.js';
import { syncCatalog } from '../../src/catalog/catalog-sync.js';
import { createImageCache } from '../../src/catalog/image-cache.js';
import { createCardRepository } from '../../src/db/card-repository.js';
import { IN_MEMORY, openDatabase, type DatabaseConnection } from '../../src/db/db-client.js';
import { cards, deckCards, decks, users } from '../../src/db/db-schema.js';
import { TEST_CARDS, loadTestCatalog } from '../helpers/catalog-fixtures.js';

describe('syncCatalog', () => {
  let conn: DatabaseConnection;
  let cacheDir: string;

  beforeEach(() => {
    conn = unwrap(openDatabase({ filename: IN_MEMORY }));
    cacheDir = join(mkdtempSync(join(tmpdir(), 'manaforge-cache-')), 'images');
  });

  afterEach(() => {
    conn.close();
    rmSync(join(cacheDir, '..'), { recursive: true, force: true });
  });

  const allCards = () => conn.db.select().from(cards).orderBy(asc(cards.id)).all();

  it('importa il batch di prova e salva in cache su disco le illustrazioni della carta', () => {
    const catalog = loadTestCatalog();
    expect(unwrap(syncCatalog(conn.db, catalog))).toEqual({
      version: catalog.version,
      status: 'imported',
      inserted: 3,
      updated: 0,
      removed: 0,
      retained: [],
    });

    const rows = allCards();
    expect(rows.map((row) => row.id)).toEqual(['TS1-001', 'TS1-002', 'TS1-003']);
    expect(rows[1]).toMatchObject({
      name: 'Drago di Prova',
      cost: '{3}{F}{F}',
      manaValue: 5,
      typeLine: 'Creatura — Drago',
      affinities: ['F'],
      affinityIdentity: ['F'],
      power: 4,
      toughness: 4,
      keywords: ['ALATO'],
      rarity: 'rara',
      catalogVersion: catalog.version,
      localImageNormalPath: null,
      localImageCropPath: null,
    });

    const repo = createCardRepository(conn.db);
    const paths = unwrap(createImageCache({ cards: repo, cacheDir }).ensureCardImages('TS1-002'));
    expect(existsSync(paths.normalPath)).toBe(true);
    expect(existsSync(paths.cropPath)).toBe(true);
    expect(paths.normalPath.startsWith(cacheDir)).toBe(true);
    expect(readFileSync(paths.normalPath, 'utf8')).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(repo.findById('TS1-002')).toMatchObject({ localImageNormalPath: paths.normalPath, localImageCropPath: paths.cropPath });
  });

  it('è idempotente: la seconda importazione della stessa versione non scrive nulla', () => {
    const catalog = loadTestCatalog();
    unwrap(syncCatalog(conn.db, catalog));
    const paths = unwrap(createImageCache({ cards: createCardRepository(conn.db), cacheDir }).ensureCardImages('TS1-001'));

    expect(unwrap(syncCatalog(conn.db, catalog))).toMatchObject({ status: 'up_to_date', inserted: 0, updated: 0, removed: 0 });
    expect(allCards()[0]).toMatchObject({ localImageNormalPath: paths.normalPath });
  });

  it('aggiorna le carte modificate, azzera le immagini se cambia l\'arte e rimuove solo le carte non usate nei mazzi', () => {
    unwrap(syncCatalog(conn.db, loadTestCatalog()));
    const repo = createCardRepository(conn.db);
    const cache = createImageCache({ cards: repo, cacheDir });
    unwrap(cache.ensureCardImages('TS1-002'));
    unwrap(cache.ensureCardImages('TS1-003'));

    const user = conn.db.insert(users).values({ email: 'a@b.it', username: 'Ada' }).returning().get();
    const deck = conn.db.insert(decks).values({ userId: user.id, name: 'Rosso' }).returning().get();
    conn.db.insert(deckCards).values({ deckId: deck.id, cardId: 'TS1-001', quantity: 20 }).run();

    const next = loadTestCatalog([
      { ...TEST_CARDS[1]!, artSeed: 'drago-ridisegnato' },
      { ...TEST_CARDS[2]!, rulesText: 'Infligge 2 danni a qualsiasi bersaglio.' },
      { id: 'TS1-004', name: 'Nuova Carta', cost: '{2}', type: 'Artefatto', rarity: 'non_comune', artSeed: 'nuova-carta' },
    ]);
    expect(unwrap(syncCatalog(conn.db, next))).toEqual({
      version: next.version,
      status: 'imported',
      inserted: 1,
      updated: 2,
      removed: 0,
      retained: ['TS1-001'],
    });

    const rows = allCards();
    expect(rows.map((row) => row.id)).toEqual(['TS1-001', 'TS1-002', 'TS1-003', 'TS1-004']);
    expect(rows[1]).toMatchObject({ artSeed: 'drago-ridisegnato', localImageNormalPath: null, catalogVersion: next.version });
    expect(rows[2]).toMatchObject({ rulesText: 'Infligge 2 danni a qualsiasi bersaglio.', localImageNormalPath: expect.any(String) });
    expect(rows[0]?.catalogVersion).not.toBe(next.version);

    // La carta trattenuta non impedisce di riconoscere la versione già importata.
    expect(unwrap(syncCatalog(conn.db, next)).status).toBe('up_to_date');

    conn.db.delete(deckCards).run();
    const final = loadTestCatalog([TEST_CARDS[2]!]);
    expect(unwrap(syncCatalog(conn.db, final))).toMatchObject({ removed: 3, retained: [] });
    expect(allCards().map((row) => row.id)).toEqual(['TS1-003']);
  });

  it('importa il catalogo distribuito MF1 e lo riconosce come aggiornato al riavvio', () => {
    const catalog = unwrap(loadBundledCatalog());
    expect(unwrap(syncCatalog(conn.db, catalog)).inserted).toBe(catalog.records.length);
    expect(allCards()).toHaveLength(catalog.records.length);
    expect(unwrap(syncCatalog(conn.db, catalog)).status).toBe('up_to_date');
  });

  it('restituisce CATALOG_SYNC_FAILED se il database non è utilizzabile', () => {
    conn.close();
    expect(syncCatalog(conn.db, loadTestCatalog())).toMatchObject({ ok: false, error: { code: 'CATALOG_SYNC_FAILED', message: expect.any(String) } });
    conn = unwrap(openDatabase({ filename: IN_MEMORY }));
  });

  it('annulla la transazione se una scrittura fallisce a metà', () => {
    conn.sqlite.exec(`CREATE TRIGGER fail_on_second BEFORE INSERT ON cards WHEN NEW.id = 'TS1-002' BEGIN SELECT RAISE(ABORT, 'scrittura bloccata'); END;`);
    expect(syncCatalog(conn.db, loadTestCatalog())).toMatchObject({ ok: false, error: { code: 'CATALOG_SYNC_FAILED', message: 'scrittura bloccata' } });
    expect(allCards()).toEqual([]);
  });
});
