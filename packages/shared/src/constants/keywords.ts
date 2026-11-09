/**
 * @nature [RULE]
 * @module Keywords
 * @description Parole chiave originali di Manaforge: codici usati nel catalogo e nel motore, con nome visualizzato.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile packages/shared/tests/constants/keywords.test.ts
 */

/** Codici delle parole chiave, nell'ordine canonico di visualizzazione. */
export const KEYWORD_CODES = [
  'ALATO',
  'VEDETTA',
  'SFONDAMENTO',
  'SCATTO',
  'SENTINELLA',
  'VELENO',
  'LINFA',
  'FENDENTE',
  'DOPPIO_FENDENTE',
  'EGIDA',
  'FULMINEO',
] as const;

/** Codice di una parola chiave. */
export type KeywordCode = (typeof KEYWORD_CODES)[number];

/** Nome visualizzato di ciascuna parola chiave. */
export const KEYWORD_NAMES: Readonly<Record<KeywordCode, string>> = Object.freeze({
  ALATO: 'Alato',
  VEDETTA: 'Vedetta',
  SFONDAMENTO: 'Sfondamento',
  SCATTO: 'Scatto',
  SENTINELLA: 'Sentinella',
  VELENO: 'Veleno',
  LINFA: 'Linfa',
  FENDENTE: 'Fendente',
  DOPPIO_FENDENTE: 'Doppio Fendente',
  EGIDA: 'Egida',
  FULMINEO: 'Fulmineo',
});

/**
 * Type guard per i codici delle parole chiave.
 *
 * @param value - Stringa da verificare.
 * @returns `true` se `value` è un {@link KeywordCode}.
 */
export const isKeywordCode = (value: string): value is KeywordCode =>
  (KEYWORD_CODES as readonly string[]).includes(value);
