/**
 * @nature [TEST]
 * @module GameConstantsTest
 * @description Verifica i valori del regolamento e l'ordine delle fasi del turno.
 * @relatedDocs docs/catalog/TEST/01-test-runner.md
 * @testFile packages/shared/tests/constants/game.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_COPIES_PER_CARD,
  MAX_SIDEBOARD_SIZE,
  MIN_DECK_SIZE,
  OPENING_HAND_SIZE,
  PHASES,
  STARTING_LIFE,
} from '../../src/constants/game.js';

describe('costanti di gioco', () => {
  it('rispettano il regolamento del PRD', () => {
    expect(STARTING_LIFE).toBe(20);
    expect(OPENING_HAND_SIZE).toBe(7);
    expect(MIN_DECK_SIZE).toBe(60);
    expect(MAX_SIDEBOARD_SIZE).toBe(15);
    expect(MAX_COPIES_PER_CARD).toBe(4);
  });

  it('elencano 12 fasi uniche, da READY a CLEANUP', () => {
    expect(PHASES).toHaveLength(12);
    expect(new Set(PHASES).size).toBe(PHASES.length);
    expect(PHASES[0]).toBe('READY');
    expect(PHASES.at(-1)).toBe('CLEANUP');
    expect(PHASES.indexOf('COMBAT_ATTACKERS')).toBeLessThan(PHASES.indexOf('COMBAT_BLOCKERS'));
  });
});
