/**
 * @nature [TEST]
 * @module CardFiltersTest
 * @description Verifica i filtri delle carte: affinità (OR, Multi, Incolore), valore di mana con 6+, tipo (Fonte include Fonte base), ricerca senza accenti e combinazioni.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/card-filters.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  filterCards,
  hasActiveFilters,
  toggleInSet,
  type AffinityFilter,
  type CardFilters,
  type ManaValueFilter,
} from '../../../src/components/ui/card-filters.js';
import { CARDS, card } from '../../helpers/fake-api.js';

const ids = (filters: Partial<CardFilters>) => filterCards(CARDS, { ...EMPTY_FILTERS, ...filters }).map((c) => c.id);
const affinities = (...values: AffinityFilter[]) => new Set(values);
const mana = (...values: ManaValueFilter[]) => new Set(values);

describe('filterCards', () => {
  it('senza filtri restituisce tutto, nello stesso ordine', () => {
    expect(ids({})).toEqual(CARDS.map((c) => c.id));
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('affinità: OR tra le scelte, Multi = 2+ affinità, Incolore = nessuna', () => {
    expect(ids({ affinities: affinities('F') })).toEqual(['TS1-003', 'TS1-004', 'TS1-005']);
    expect(ids({ affinities: affinities('M', 'S') })).toEqual(['TS1-005', 'TS1-006']);
    expect(ids({ affinities: affinities('MULTI') })).toEqual(['TS1-005']);
    expect(ids({ affinities: affinities('COLORLESS') })).toEqual(['TS1-001', 'TS1-002']);
  });

  it('valore di mana: 6 comprende i costi superiori', () => {
    const big = card({ id: 'TS1-009', name: 'Colosso', manaValue: 9 });
    expect(filterCards([...CARDS, big], { ...EMPTY_FILTERS, manaValues: mana(6) }).map((c) => c.id)).toEqual(['TS1-006', 'TS1-009']);
    expect(ids({ manaValues: mana(0, 4) })).toEqual(['TS1-001', 'TS1-002', 'TS1-005']);
  });

  it('tipo: Fonte include le Fonti base', () => {
    expect(ids({ type: 'Fonte' })).toEqual(['TS1-001', 'TS1-002']);
    expect(ids({ type: 'Creatura' })).toEqual(['TS1-003', 'TS1-005']);
    expect(ids({ type: 'Rituale' })).toEqual(['TS1-006']);
  });

  it('ricerca su nome, tipo e testo ignorando maiuscole e accenti; categorie in AND', () => {
    expect(ids({ query: '  CHIMERA ' })).toEqual(['TS1-005']);
    expect(ids({ query: 'danni' })).toEqual(['TS1-004']);
    expect(ids({ query: 'folletto' })).toEqual(['TS1-003']);
    const accented = card({ id: 'TS1-010', name: 'Città Perduta' });
    expect(filterCards([accented], { ...EMPTY_FILTERS, query: 'citta' })).toEqual([accented]);
    expect(ids({ affinities: affinities('F'), type: 'Creatura', manaValues: mana(1) })).toEqual(['TS1-003']);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: 'x' })).toBe(true);
  });
});

describe('toggleInSet', () => {
  it('aggiunge e rimuove senza modificare l\'originale', () => {
    const start = new Set([1]);
    expect([...toggleInSet(start, 2)]).toEqual([1, 2]);
    expect([...toggleInSet(start, 1)]).toEqual([]);
    expect([...start]).toEqual([1]);
  });
});
