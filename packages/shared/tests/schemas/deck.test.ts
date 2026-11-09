/**
 * @nature [TEST]
 * @module DeckSchemasTest
 * @description Verifica le regole di costruzione del mazzo (min 60, riserva max 15, max 4 copie salvo Fonti base) e gli schemi dei payload.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile packages/shared/tests/schemas/deck.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  DeckDetailSchema,
  DeckIssueSchema,
  SaveDeckRequestSchema,
  describeDeckIssue,
  hasBlockingIssues,
  isBasicSource,
  validateDeck,
  type DeckEntry,
  type DeckIssue,
  type DeckRuleCard,
} from '../../src/schemas/deck.js';

const CARDS: Record<string, DeckRuleCard> = {
  'TS1-001': { id: 'TS1-001', name: 'Fonte di Prova', typeLine: 'Fonte base — Fiamma' },
  'TS1-002': { id: 'TS1-002', name: 'Drago di Prova', typeLine: 'Creatura — Drago' },
  'TS1-003': { id: 'TS1-003', name: 'Lampo di Prova', typeLine: 'Rapido' },
  'TS1-004': { id: 'TS1-004', name: 'Pietra di Prova', typeLine: 'Fonte' },
};
const lookup = (id: string) => CARDS[id];
const main = (cardId: string, quantity: number): DeckEntry => ({ cardId, quantity, board: 'main' });
const side = (cardId: string, quantity: number): DeckEntry => ({ cardId, quantity, board: 'sideboard' });

describe('validateDeck', () => {
  it('accetta un mazzo da 60 con Fonti base oltre le 4 copie', () => {
    const result = validateDeck([main('TS1-001', 52), main('TS1-002', 4), main('TS1-003', 4), side('TS1-004', 4)], lookup);
    expect(result).toEqual({ isValid: true, mainCount: 60, sideboardCount: 4, issues: [] });
  });

  it('segnala un mazzo sotto le 60 carte come incompleto ma non bloccante', () => {
    const result = validateDeck([main('TS1-002', 4)], lookup);
    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual([{ code: 'MAIN_TOO_SMALL', count: 4, min: 60 }]);
    expect(hasBlockingIssues(result)).toBe(false);
  });

  it('conta le copie sommando mazzo e riserva; le Fonti non base sono limitate', () => {
    const result = validateDeck([main('TS1-001', 56), main('TS1-002', 3), side('TS1-002', 2), main('TS1-004', 1), side('TS1-004', 4)], lookup);
    expect(result.issues).toEqual([
      { code: 'TOO_MANY_COPIES', cardId: 'TS1-002', name: 'Drago di Prova', count: 5, max: 4 },
      { code: 'TOO_MANY_COPIES', cardId: 'TS1-004', name: 'Pietra di Prova', count: 5, max: 4 },
    ]);
    expect(hasBlockingIssues(result)).toBe(true);
  });

  it('segnala riserva oltre 15 e carte sconosciute, in ordine stabile', () => {
    const result = validateDeck([side('TS1-001', 16), main('XX1-999', 1)], lookup);
    expect(result.issues.map((issue) => issue.code)).toEqual(['MAIN_TOO_SMALL', 'SIDEBOARD_TOO_LARGE', 'UNKNOWN_CARD']);
    expect(hasBlockingIssues(result)).toBe(true);
  });

  it('un mazzo vuoto ha 0 carte e un solo problema', () => {
    expect(validateDeck([], lookup)).toEqual({ isValid: false, mainCount: 0, sideboardCount: 0, issues: [{ code: 'MAIN_TOO_SMALL', count: 0, min: 60 }] });
  });
});

describe('isBasicSource', () => {
  it('riconosce solo le Fonti base', () => {
    expect(isBasicSource({ typeLine: 'Fonte base — Alba' })).toBe(true);
    expect(isBasicSource({ typeLine: 'Fonte' })).toBe(false);
    expect(isBasicSource({ typeLine: 'Creatura — Umano' })).toBe(false);
  });
});

describe('describeDeckIssue', () => {
  it.each<[DeckIssue, string]>([
    [{ code: 'MAIN_TOO_SMALL', count: 12, min: 60 }, 'Il mazzo ha 12 carte: ne servono almeno 60.'],
    [{ code: 'SIDEBOARD_TOO_LARGE', count: 16, max: 15 }, 'La riserva ha 16 carte: al massimo 15.'],
    [{ code: 'TOO_MANY_COPIES', cardId: 'TS1-002', name: 'Drago di Prova', count: 5, max: 4 }, 'Drago di Prova: 5 copie, al massimo 4.'],
    [{ code: 'UNKNOWN_CARD', cardId: 'XX1-001' }, 'Carta sconosciuta: XX1-001.'],
  ])('%j', (issue, message) => {
    expect(DeckIssueSchema.parse(issue)).toEqual(issue);
    expect(describeDeckIssue(issue)).toBe(message);
  });
});

describe('SaveDeckRequestSchema', () => {
  it('applica i default e normalizza il nome', () => {
    const parsed = SaveDeckRequestSchema.parse({ name: '  Fiamma Rapida ', cards: [main('TS1-002', 4)] });
    expect(parsed).toEqual({ name: 'Fiamma Rapida', format: 'standard', coverCardId: null, cards: [main('TS1-002', 4)] });
  });

  it('rifiuta righe duplicate, quantità fuori limite, id e nomi non validi, campi extra', () => {
    const bad = (body: unknown) => SaveDeckRequestSchema.safeParse(body).success;
    expect(bad({ name: 'A', cards: [main('TS1-002', 1), main('TS1-002', 1)] })).toBe(false);
    expect(bad({ name: 'A', cards: [main('TS1-002', 1), side('TS1-002', 1)] })).toBe(true);
    expect(bad({ name: 'A', cards: [main('TS1-002', 0)] })).toBe(false);
    expect(bad({ name: 'A', cards: [main('TS1-002', 100)] })).toBe(false);
    expect(bad({ name: 'A', cards: [main('../etc', 1)] })).toBe(false);
    expect(bad({ name: '   ', cards: [] })).toBe(false);
    expect(bad({ name: 'x'.repeat(41), cards: [] })).toBe(false);
    expect(bad({ name: 'a\u0007b', cards: [] })).toBe(false);
    expect(bad({ name: 'A', cards: [], extra: 1 })).toBe(false);
  });

  it('DeckDetailSchema accetta un mazzo completo', () => {
    const detail = {
      id: 'd1',
      name: 'Prova',
      format: 'standard',
      coverCardId: null,
      updatedAt: '2026-11-09T10:00:00.000Z',
      cards: [main('TS1-002', 4)],
      validation: validateDeck([main('TS1-002', 4)], lookup),
    };
    expect(DeckDetailSchema.parse(detail)).toEqual(detail);
  });
});
