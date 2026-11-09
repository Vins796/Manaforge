/**
 * @nature [TEST]
 * @module AffinitiesTest
 * @description Verifica codici, nomi e type guard delle affinità di mana.
 * @relatedDocs docs/catalog/TEST/01-test-runner.md
 * @testFile packages/shared/tests/constants/affinities.test.ts
 */
import { describe, expect, it } from 'vitest';
import { AFFINITY_CODES, AFFINITY_NAMES, COLORLESS_CODE, MANA_COLORS, isAffinityCode } from '../../src/constants/affinities.js';

describe('affinità', () => {
  it('ogni codice ha un nome e il nome incolore non è un\'affinità', () => {
    expect(AFFINITY_CODES).toHaveLength(5);
    for (const code of AFFINITY_CODES) expect(AFFINITY_NAMES[code]).toBeTruthy();
    expect(isAffinityCode(COLORLESS_CODE)).toBe(false);
  });

  it('isAffinityCode riconosce solo codici validi', () => {
    expect(isAffinityCode('F')).toBe(true);
    expect(isAffinityCode('X')).toBe(false);
    expect(isAffinityCode('')).toBe(false);
  });

  it('la mappa dei nomi è immutabile', () => {
    expect(Object.isFrozen(AFFINITY_NAMES)).toBe(true);
  });

  it('ogni tipo di mana ha un colore esadecimale del Design Brief', () => {
    for (const code of [...AFFINITY_CODES, COLORLESS_CODE]) expect(MANA_COLORS[code]).toMatch(/^#[0-9A-F]{6}$/);
    expect(MANA_COLORS.F).toBe('#F87171');
    expect(Object.isFrozen(MANA_COLORS)).toBe(true);
  });
});
