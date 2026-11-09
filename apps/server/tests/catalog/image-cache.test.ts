/**
 * @nature [TEST]
 * @module ImageCacheTest
 * @description Verifica generazione on-demand, cache hit, rigenerazione di file mancanti, invalidazione e gestione errori della cache immagini.
 * @relatedDocs docs/catalog/TEST/04-catalog-tests.md
 * @testFile apps/server/tests/catalog/image-cache.test.ts
 */
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { unwrap } from '@manaforge/shared';
import { syncCatalog } from '../../src/catalog/catalog-sync.js';
import { createImageCache, imageFileName } from '../../src/catalog/image-cache.js';
import { createCardRepository, type CardRepository } from '../../src/db/card-repository.js';
import { IN_MEMORY, openDatabase, type DatabaseConnection } from '../../src/db/db-client.js';
import { cards } from '../../src/db/db-schema.js';
import { loadTestCatalog } from '../helpers/catalog-fixtures.js';

describe('createImageCache', () => {
  let conn: DatabaseConnection;
  let root: string;
  let cacheDir: string;
  let repo: CardRepository;

  beforeEach(() => {
    conn = unwrap(openDatabase({ filename: IN_MEMORY }));
    unwrap(syncCatalog(conn.db, loadTestCatalog()));
    repo = createCardRepository(conn.db);
    root = mkdtempSync(join(tmpdir(), 'manaforge-images-'));
    cacheDir = join(root, 'cache', 'images');
  });

  afterEach(() => {
    conn.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('crea la cartella, scrive le due varianti senza file temporanei residui e ha nomi con impronta', () => {
    const paths = unwrap(createImageCache({ cards: repo, cacheDir }).ensureCardImages('TS1-003'));
    expect(readdirSync(cacheDir).sort()).toEqual([basename(paths.cropPath), basename(paths.normalPath)]);
    expect(basename(paths.normalPath)).toMatch(/^TS1-003-[0-9a-f]{12}-normal\.svg$/);
    expect(imageFileName('MF1-001', 'abc', 'crop')).toBe('MF1-001-abc-crop.svg');
  });

  it('non rigenera se i file esistono e sono registrati (cache hit)', () => {
    const cache = createImageCache({ cards: repo, cacheDir });
    const first = unwrap(cache.ensureCardImages('TS1-002'));
    const spy = vi.spyOn(repo, 'setImagePaths');
    const mtime = statSync(first.normalPath).mtimeMs;
    expect(unwrap(cache.ensureCardImages('TS1-002'))).toEqual(first);
    expect(spy).not.toHaveBeenCalled();
    expect(statSync(first.normalPath).mtimeMs).toBe(mtime);
  });

  it('rigenera se un file è stato cancellato o se il DB non li registra', () => {
    const cache = createImageCache({ cards: repo, cacheDir });
    const first = unwrap(cache.ensureCardImages('TS1-002'));
    rmSync(first.cropPath);
    expect(unwrap(cache.ensureCardImages('TS1-002'))).toEqual(first);
    expect(statSync(first.cropPath).isFile()).toBe(true);

    conn.db.update(cards).set({ localImageNormalPath: null }).where(eq(cards.id, 'TS1-002')).run();
    expect(unwrap(cache.ensureCardImages('TS1-002'))).toEqual(first);
    expect(repo.findById('TS1-002')?.localImageNormalPath).toBe(first.normalPath);
  });

  it("cambia file quando cambia l'arte (impronta diversa)", () => {
    const cache = createImageCache({ cards: repo, cacheDir });
    const first = unwrap(cache.ensureCardImages('TS1-002'));
    conn.db.update(cards).set({ artSeed: 'seed-nuovo' }).where(eq(cards.id, 'TS1-002')).run();
    const second = unwrap(cache.ensureCardImages('TS1-002'));
    expect(second.normalPath).not.toBe(first.normalPath);
  });

  it.each(['TS1-999', '../../etc/passwd', 'MF1-001/../x'])('restituisce CARD_NOT_FOUND per %j', (cardId) => {
    expect(createImageCache({ cards: repo, cacheDir }).ensureCardImages(cardId)).toEqual({ ok: false, error: { code: 'CARD_NOT_FOUND', cardId } });
  });

  it('restituisce IMAGE_WRITE_FAILED se la cartella di cache non è scrivibile', () => {
    mkdirSync(join(root, 'cache'), { recursive: true });
    writeFileSync(cacheDir, 'non una cartella');
    expect(createImageCache({ cards: repo, cacheDir }).ensureCardImages('TS1-001')).toMatchObject({ ok: false, error: { code: 'IMAGE_WRITE_FAILED' } });
  });

  it('rimuove il file temporaneo se il rename fallisce', () => {
    const cache = createImageCache({ cards: repo, cacheDir });
    const paths = unwrap(cache.ensureCardImages('TS1-001'));
    rmSync(paths.normalPath);
    mkdirSync(paths.normalPath); // una cartella al posto del file fa fallire il rename
    expect(cache.ensureCardImages('TS1-001')).toMatchObject({ ok: false, error: { code: 'IMAGE_WRITE_FAILED' } });
    expect(readdirSync(cacheDir).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('rifiuta una cartella di cache relativa', () => {
    expect(() => createImageCache({ cards: repo, cacheDir: 'relativa/images' })).toThrow(/assoluta/);
  });
});
