/**
 * @nature [TEST]
 * @module ManaCostTest
 * @description Verifica parsing dei costi di mana, valore di mana, affinità, errori e affinità citate nel testo.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile packages/shared/tests/schemas/mana-cost.test.ts
 */
import { describe, expect, it } from 'vitest';
import { ManaCostSchema, affinitiesInText, parseManaCost } from '../../src/schemas/mana-cost.js';

describe('parseManaCost', () => {
  it('scompone generico e simboli specifici', () => {
    expect(parseManaCost('{2}{F}{S}')).toEqual({
      ok: true,
      value: { generic: 2, symbols: { A: 0, M: 0, O: 0, F: 1, S: 1, C: 0 }, manaValue: 4, affinities: ['F', 'S'] },
    });
  });

  it('ordina le affinità in modo canonico e conta i simboli ripetuti', () => {
    const result = parseManaCost('{S}{A}{S}{C}');
    expect(result.ok && result.value).toMatchObject({ manaValue: 4, affinities: ['A', 'S'], symbols: { S: 2, A: 1, C: 1 } });
  });

  it.each([
    ['', 0],
    ['{0}', 0],
    ['{20}', 20],
    ['{C}', 1],
  ])('accetta %j con valore %i', (cost, manaValue) => {
    const result = parseManaCost(cost);
    expect(result.ok && result.value.manaValue).toBe(manaValue);
  });

  it.each([
    ['{X}', 'MALFORMED'],
    ['{F', 'MALFORMED'],
    ['F', 'MALFORMED'],
    ['{F} ', 'MALFORMED'],
    ['{01}', 'MALFORMED'],
    ['{}', 'MALFORMED'],
    ['{F}{2}', 'GENERIC_NOT_FIRST'],
    ['{1}{1}', 'GENERIC_NOT_FIRST'],
    ['{21}', 'GENERIC_TOO_LARGE'],
    ['{0}{F}', 'ZERO_NOT_ALONE'],
    ['{F}'.repeat(13), 'TOO_MANY_SYMBOLS'],
  ])('rifiuta %j (%s)', (cost, error) => {
    expect(parseManaCost(cost)).toEqual({ ok: false, error });
  });

  it('è rientrante (regex sticky resettata a ogni chiamata)', () => {
    parseManaCost('{1}{F');
    expect(parseManaCost('{F}').ok).toBe(true);
  });
});

describe('affinitiesInText', () => {
  it('estrae solo simboli di affinità colorate, unici e in ordine canonico', () => {
    expect(affinitiesInText('Esaurisci: aggiungi {S} oppure {A}. Paga {2}{C}{S}.')).toEqual(['A', 'S']);
    expect(affinitiesInText('Nessun simbolo')).toEqual([]);
  });
});

describe('ManaCostSchema', () => {
  it('valida con un messaggio che riporta il motivo', () => {
    expect(ManaCostSchema.safeParse('{1}{M}').success).toBe(true);
    const failed = ManaCostSchema.safeParse('{M}{1}');
    expect(failed.success).toBe(false);
    expect(failed.error?.issues[0]?.message).toContain('GENERIC_NOT_FIRST');
  });
});
