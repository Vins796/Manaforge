/**
 * @nature [UI]
 * @module CardFilters
 * @description Logica pura dei filtri di collezione e deckbuilder: affinità (incl. Multi/Incolore), valore di mana (0–6+), tipo, formato e ricerca testuale.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/card-filters.test.ts
 */
import { AFFINITY_CODES, TYPE_LINE_SEPARATOR, type AffinityCode, type CardView, type DeckFormat } from '@manaforge/shared';

/** Opzioni del filtro affinità: le cinque affinità più multi-affinità e incolore. */
export const AFFINITY_FILTERS = [...AFFINITY_CODES, 'MULTI', 'COLORLESS'] as const;
export type AffinityFilter = (typeof AFFINITY_FILTERS)[number];

/** Valori di mana filtrabili; `6` significa "6 o più". */
export const MANA_VALUE_FILTERS = [0, 1, 2, 3, 4, 5, 6] as const;
export type ManaValueFilter = (typeof MANA_VALUE_FILTERS)[number];

/** Tipi filtrabili (`Fonte` include le Fonti base). */
export const TYPE_FILTERS = ['Creatura', 'Rituale', 'Rapido', 'Artefatto', 'Fonte'] as const;
export type TypeFilter = (typeof TYPE_FILTERS)[number];

/** Stato dei filtri. Insiemi vuoti = nessun vincolo. */
export interface CardFilters {
  readonly affinities: ReadonlySet<AffinityFilter>;
  readonly manaValues: ReadonlySet<ManaValueFilter>;
  readonly type: TypeFilter | null;
  readonly format: DeckFormat;
  readonly query: string;
}

/** Filtri iniziali (mostrano tutto). */
export const EMPTY_FILTERS: CardFilters = Object.freeze({
  affinities: new Set<AffinityFilter>(),
  manaValues: new Set<ManaValueFilter>(),
  type: null,
  format: 'standard',
  query: '',
});

/** Etichetta di ciascun filtro di affinità. */
export const AFFINITY_FILTER_LABELS: Readonly<Record<AffinityFilter, string>> = Object.freeze({
  A: 'Alba',
  M: 'Marea',
  O: 'Ombra',
  F: 'Fiamma',
  S: 'Selva',
  MULTI: 'Multi',
  COLORLESS: 'Incolore',
});

/**
 * Restituisce un nuovo insieme con `value` aggiunto o rimosso.
 *
 * @param set - Insieme di partenza (non modificato).
 * @param value - Valore da alternare.
 * @returns Il nuovo insieme.
 */
export const toggleInSet = <T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> => {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
};

const matchesAffinity = (identity: readonly AffinityCode[], filter: AffinityFilter): boolean => {
  if (filter === 'MULTI') return identity.length > 1;
  if (filter === 'COLORLESS') return identity.length === 0;
  return identity.includes(filter);
};

const baseType = (typeLine: string): string => {
  const type = typeLine.split(TYPE_LINE_SEPARATOR)[0] ?? typeLine;
  return type === 'Fonte base' ? 'Fonte' : type;
};

const normalize = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('it');

/**
 * Indica se una carta soddisfa i filtri. Più affinità o valori di mana selezionati si combinano in OR;
 * categorie diverse in AND. La ricerca guarda nome, riga del tipo e testo, ignorando maiuscole e accenti.
 *
 * @param card - Carta.
 * @param filters - Filtri attivi.
 * @returns `true` se la carta va mostrata.
 */
export const matchesFilters = (card: CardView, filters: CardFilters): boolean => {
  if (filters.affinities.size > 0 && ![...filters.affinities].some((f) => matchesAffinity(card.affinityIdentity, f))) return false;
  if (filters.manaValues.size > 0 && !filters.manaValues.has(Math.min(card.manaValue, 6) as ManaValueFilter)) return false;
  if (filters.type !== null && baseType(card.typeLine) !== filters.type) return false;
  const query = normalize(filters.query.trim());
  if (query === '') return true;
  return normalize(`${card.name}\n${card.typeLine}\n${card.rulesText}`).includes(query);
};

/**
 * Filtra un elenco di carte mantenendone l'ordine.
 *
 * @param cards - Carte.
 * @param filters - Filtri attivi.
 * @returns Le carte che soddisfano i filtri.
 */
export const filterCards = (cards: readonly CardView[], filters: CardFilters): CardView[] =>
  cards.filter((card) => matchesFilters(card, filters));

/**
 * Indica se almeno un filtro è attivo.
 *
 * @param filters - Filtri.
 * @returns `true` se qualcosa restringe l'elenco.
 */
export const hasActiveFilters = (filters: CardFilters): boolean =>
  filters.affinities.size > 0 || filters.manaValues.size > 0 || filters.type !== null || filters.query.trim() !== '';
