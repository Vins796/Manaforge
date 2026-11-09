/**
 * @nature [RULE]
 * @module ManaCost
 * @description Sintassi dei costi di mana (`{2}{F}{S}`): validazione, scomposizione in simboli, valore di mana e affinità.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile packages/shared/tests/schemas/mana-cost.test.ts
 */
import { z } from 'zod';
import { AFFINITY_CODES, COLORLESS_CODE, isAffinityCode, type AffinityCode, type ManaType } from '../constants/affinities.js';
import { err, ok, type Result } from '../types/result.js';

/** Massimo mana generico esprimibile in un singolo simbolo `{N}`. */
export const MAX_GENERIC_MANA = 20;
/** Massimo numero di simboli in un costo. */
export const MAX_COST_SYMBOLS = 12;

/** Costo scomposto. */
export interface ManaCost {
  /** Mana generico (pagabile con qualsiasi tipo di mana). */
  readonly generic: number;
  /** Simboli specifici per tipo di mana. */
  readonly symbols: Readonly<Record<ManaType, number>>;
  /** Valore di mana totale. */
  readonly manaValue: number;
  /** Affinità colorate presenti nel costo, in ordine canonico. */
  readonly affinities: readonly AffinityCode[];
}

/** Motivo per cui un costo non è valido. */
export type ManaCostError =
  | 'MALFORMED'
  | 'TOO_MANY_SYMBOLS'
  | 'GENERIC_NOT_FIRST'
  | 'GENERIC_TOO_LARGE'
  | 'ZERO_NOT_ALONE';

const TOKEN_PATTERN = /\{([^{}]*)\}/gy;
const GENERIC_PATTERN = /^(?:0|[1-9]\d?)$/;

const emptySymbols = (): Record<ManaType, number> => ({ A: 0, M: 0, O: 0, F: 0, S: 0, C: 0 });

/**
 * Scompone un costo di mana. La stringa vuota indica "nessun costo" (es. le Fonti).
 *
 * Regole: un solo simbolo generico `{N}` ammesso, sempre in prima posizione; `{0}` solo da solo;
 * simboli specifici `{A}` `{M}` `{O}` `{F}` `{S}` `{C}`.
 *
 * @param cost - Costo testuale, es. `{2}{F}{S}`.
 * @returns Il costo scomposto, oppure il motivo dell'errore.
 */
export const parseManaCost = (cost: string): Result<ManaCost, ManaCostError> => {
  const tokens: string[] = [];
  TOKEN_PATTERN.lastIndex = 0;
  let consumed = 0;
  for (let match = TOKEN_PATTERN.exec(cost); match; match = TOKEN_PATTERN.exec(cost)) {
    tokens.push(match[1] ?? '');
    consumed = TOKEN_PATTERN.lastIndex;
  }
  if (consumed !== cost.length) return err('MALFORMED');
  if (tokens.length > MAX_COST_SYMBOLS) return err('TOO_MANY_SYMBOLS');

  const symbols = emptySymbols();
  let generic = 0;
  for (const [index, token] of tokens.entries()) {
    if (GENERIC_PATTERN.test(token)) {
      if (index !== 0) return err('GENERIC_NOT_FIRST');
      generic = Number(token);
      if (generic > MAX_GENERIC_MANA) return err('GENERIC_TOO_LARGE');
      if (generic === 0 && tokens.length > 1) return err('ZERO_NOT_ALONE');
    } else if (token === COLORLESS_CODE || isAffinityCode(token)) {
      symbols[token] += 1;
    } else {
      return err('MALFORMED');
    }
  }

  const specific = Object.values(symbols).reduce((sum, n) => sum + n, 0);
  return ok({
    generic,
    symbols: Object.freeze(symbols),
    manaValue: generic + specific,
    affinities: Object.freeze(AFFINITY_CODES.filter((code) => symbols[code] > 0)),
  });
};

/**
 * Estrae le affinità citate come simboli (`{A}`, `{F}`…) in un testo delle regole.
 *
 * @param text - Testo delle regole.
 * @returns Le affinità trovate, uniche e in ordine canonico.
 */
export const affinitiesInText = (text: string): AffinityCode[] => {
  const found = new Set<string>();
  for (const match of text.matchAll(/\{([AMOFS])\}/g)) found.add(match[1] ?? '');
  return AFFINITY_CODES.filter((code) => found.has(code));
};

/** Schema Zod di un costo di mana testuale (stringa vuota ammessa). */
export const ManaCostSchema = z.string().superRefine((value, ctx) => {
  const parsed = parseManaCost(value);
  if (!parsed.ok) ctx.addIssue({ code: 'custom', message: `Costo di mana non valido (${parsed.error}): "${value}"` });
});
