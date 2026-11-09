/**
 * @nature [TEST]
 * @module CardCatalogTest
 * @description Verifica caricamento, validazione, conflitti tra blocchi e versione (hash) del catalogo, incluso il blocco reale MF1.
 * @relatedDocs docs/catalog/TEST/04-catalog-tests.md
 * @testFile apps/server/tests/catalog/card-catalog.test.ts
 */
import { describe, expect, it } from 'vitest';
import { KEYWORD_CODES, SOURCE_TYPES, unwrap } from '@manaforge/shared';
import { computeCatalogVersion, loadBundledCatalog, parseCatalogSources } from '../../src/catalog/card-catalog.js';
import { TEST_CARDS, loadTestCatalog, testCatalogSource } from '../helpers/catalog-fixtures.js';

describe('catalogo distribuito (MF1 — Prima Fusione)', () => {
  const catalog = unwrap(loadBundledCatalog());

  it('è valido, ordinato per id e con versione stabile', () => {
    expect(catalog.blocks).toEqual([{ code: 'MF1', name: 'Prima Fusione' }]);
    expect(catalog.records.length).toBeGreaterThanOrEqual(40);
    const ids = catalog.records.map((card) => card.id);
    expect(ids).toEqual([...ids].sort());
    expect(catalog.version).toMatch(/^v1-[0-9a-f]{16}$/);
    expect(unwrap(loadBundledCatalog()).version).toBe(catalog.version);
  });

  it('contiene una Fonte base per ciascuna affinità e usa tutte le parole chiave', () => {
    const sources = catalog.records.filter((card) => card.typeLine.startsWith('Fonte base'));
    expect(sources.map((card) => card.affinityIdentity)).toEqual([['A'], ['M'], ['O'], ['F'], ['S']]);
    const used = new Set(catalog.records.flatMap((card) => card.keywords));
    expect([...used].sort()).toEqual([...KEYWORD_CODES].sort());
  });

  it('include le carte citate dai documenti di regole', () => {
    const names = catalog.records.map((card) => card.name);
    expect(names).toEqual(expect.arrayContaining(['Scintilla Rovente', 'Vigore della Selva']));
    expect(SOURCE_TYPES).toContain('Fonte base');
  });
});

describe('parseCatalogSources', () => {
  it('normalizza le carte di prova', () => {
    const catalog = loadTestCatalog();
    expect(catalog.records.find((card) => card.id === 'TS1-002')).toMatchObject({ manaValue: 5, typeLine: 'Creatura — Drago', affinities: ['F'] });
  });

  it('restituisce CATALOG_INVALID con il dettaglio Zod', () => {
    const result = parseCatalogSources([testCatalogSource([{ ...TEST_CARDS[1]!, power: undefined }])]);
    expect(result).toMatchObject({ ok: false, error: { code: 'CATALOG_INVALID', sourceIndex: 0, message: expect.stringContaining('Forza') } });
    expect(parseCatalogSources(['non json'])).toMatchObject({ ok: false, error: { code: 'CATALOG_INVALID' } });
  });

  it('rifiuta un elenco vuoto di blocchi', () => {
    expect(parseCatalogSources([])).toMatchObject({ ok: false, error: { code: 'CATALOG_INVALID', sourceIndex: -1 } });
  });

  it('rifiuta blocchi duplicati e nomi ripetuti tra blocchi', () => {
    const block = testCatalogSource();
    expect(parseCatalogSources([block, block])).toMatchObject({ ok: false, error: { code: 'CATALOG_CONFLICT', sourceIndex: 1, message: expect.stringContaining('TS1') } });

    const other = { schemaVersion: 1, block: { code: 'TS2', name: 'Altro' }, cards: [{ ...TEST_CARDS[2]!, id: 'TS2-001', artSeed: 'altro' }] };
    expect(parseCatalogSources([block, other])).toMatchObject({ ok: false, error: { code: 'CATALOG_CONFLICT', message: expect.stringContaining('Lampo di Prova') } });
  });
});

describe('computeCatalogVersion', () => {
  it("non dipende dall'ordine ma cambia con il contenuto", () => {
    const { records, version } = loadTestCatalog();
    expect(computeCatalogVersion([...records].reverse())).toBe(version);
    const changed = loadTestCatalog([TEST_CARDS[0]!, TEST_CARDS[1]!, { ...TEST_CARDS[2]!, rulesText: 'Infligge 2 danni.' }]);
    expect(changed.version).not.toBe(version);
  });
});
