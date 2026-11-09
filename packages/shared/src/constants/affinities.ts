/**
 * @nature [RULE]
 * @module Affinities
 * @description Affinità di mana originali di Manaforge e relativi codici usati nella sintassi dei costi (es. `{2}{F}{S}`).
 * @relatedDocs docs/04-design-brief.md
 * @testFile packages/shared/tests/constants/affinities.test.ts
 */

/** Codici delle affinità colorate, nell'ordine canonico di visualizzazione. */
export const AFFINITY_CODES = ['A', 'M', 'O', 'F', 'S'] as const;

/** Codice di un'affinità colorata. */
export type AffinityCode = (typeof AFFINITY_CODES)[number];

/** Codice del mana incolore. */
export const COLORLESS_CODE = 'C';

/** Qualsiasi tipo di mana presente in una riserva. */
export type ManaType = AffinityCode | typeof COLORLESS_CODE;

/** Nome visualizzato di ciascuna affinità. */
export const AFFINITY_NAMES: Readonly<Record<AffinityCode, string>> = Object.freeze({
  A: 'Alba',
  M: 'Marea',
  O: 'Ombra',
  F: 'Fiamma',
  S: 'Selva',
});

/**
 * Type guard per i codici di affinità colorata.
 *
 * @param value - Stringa da verificare.
 * @returns `true` se `value` è un {@link AffinityCode}.
 */
export const isAffinityCode = (value: string): value is AffinityCode =>
  (AFFINITY_CODES as readonly string[]).includes(value);

/** Colore di riferimento di ciascun tipo di mana (Design Brief §1), usato da UI e illustrazioni procedurali. */
export const MANA_COLORS: Readonly<Record<ManaType, string>> = Object.freeze({
  A: '#FDE68A',
  M: '#38BDF8',
  O: '#A855F7',
  F: '#F87171',
  S: '#4ADE80',
  C: '#9CA3AF',
});
