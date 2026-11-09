/**
 * @nature [RULE]
 * @module GameConstants
 * @description Costanti di base del regolamento (vita iniziale, mano, limiti di mazzo, fasi del turno).
 * @relatedDocs docs/catalog/ARCH/01-monorepo-setup.md
 * @testFile packages/shared/tests/constants/game.test.ts
 */

/** Nome del prodotto. */
export const APP_NAME = 'Manaforge';

/** Punti vita iniziali di ciascun giocatore. */
export const STARTING_LIFE = 20;

/** Carte nella mano iniziale. */
export const OPENING_HAND_SIZE = 7;

/** Numero minimo di carte nel mazzo principale. */
export const MIN_DECK_SIZE = 60;

/** Numero massimo di carte nella riserva. */
export const MAX_SIDEBOARD_SIZE = 15;

/** Copie massime per carta (le Fonti base sono escluse dal limite). */
export const MAX_COPIES_PER_CARD = 4;

/** Fasi e sottofasi del turno, in ordine di esecuzione. */
export const PHASES = [
  'READY',
  'UPKEEP',
  'DRAW',
  'MAIN_1',
  'COMBAT_BEGIN',
  'COMBAT_ATTACKERS',
  'COMBAT_BLOCKERS',
  'COMBAT_DAMAGE',
  'COMBAT_END',
  'MAIN_2',
  'END',
  'CLEANUP',
] as const;

/** Una fase o sottofase del turno. */
export type Phase = (typeof PHASES)[number];
