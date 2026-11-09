/**
 * @nature [TEST]
 * @module KeywordsTest
 * @description Verifica codici, nomi visualizzati e type guard delle parole chiave originali.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile packages/shared/tests/constants/keywords.test.ts
 */
import { describe, expect, it } from 'vitest';
import { KEYWORD_CODES, KEYWORD_NAMES, isKeywordCode } from '../../src/constants/keywords.js';

describe('parole chiave', () => {
  it('elenca le 11 parole chiave originali, ognuna con un nome', () => {
    expect(KEYWORD_CODES).toHaveLength(11);
    expect(new Set(KEYWORD_CODES).size).toBe(KEYWORD_CODES.length);
    for (const code of KEYWORD_CODES) expect(KEYWORD_NAMES[code]).toBeTruthy();
    expect(KEYWORD_NAMES.DOPPIO_FENDENTE).toBe('Doppio Fendente');
    expect(Object.isFrozen(KEYWORD_NAMES)).toBe(true);
  });

  it('isKeywordCode riconosce solo codici validi (case-sensitive)', () => {
    expect(isKeywordCode('ALATO')).toBe(true);
    expect(isKeywordCode('alato')).toBe(false);
    expect(isKeywordCode('FLYING')).toBe(false);
  });
});
