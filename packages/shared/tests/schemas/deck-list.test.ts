/**
 * @nature [TEST]
 * @module DeckListFormatTest
 * @description Verifica il parser di import (sezioni, quantità, commenti, errori per riga), la risoluzione dei nomi e l'export testuale (round-trip).
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile packages/shared/tests/schemas/deck-list.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  DECK_LIST_MAX_LENGTH,
  ParseDeckListResponseSchema,
  formatDeckList,
  normalizeCardName,
  parseDeckList,
  resolveDeckList,
} from '../../src/schemas/deck-list.js';

const CATALOG = new Map([
  ['scintilla rovente', 'MF1-029'],
  ['vigore della selva', 'MF1-036'],
  ["scudiera dell'aurora", 'MF1-007'],
  ['fucina vulcanica', 'MF1-004'],
]);

describe('normalizeCardName', () => {
  it('ignora maiuscole, spazi multipli e apostrofi tipografici', () => {
    expect(normalizeCardName('  Scudiera   dell’Aurora ')).toBe("scudiera dell'aurora");
  });
});

describe('parseDeckList', () => {
  it('legge sezioni Mazzo/Riserva, formato "4x", commenti e righe vuote', () => {
    const text = [
      '# lista di prova',
      'Mazzo',
      '4 Scintilla Rovente',
      '20x Fucina Vulcanica',
      '',
      '// riserva',
      'Riserva (2):',
      '2 Vigore della Selva',
    ].join('\r\n');
    expect(parseDeckList(text)).toEqual({
      lines: [
        { name: 'Scintilla Rovente', quantity: 4, board: 'main', line: 3 },
        { name: 'Fucina Vulcanica', quantity: 20, board: 'main', line: 4 },
        { name: 'Vigore della Selva', quantity: 2, board: 'sideboard', line: 8 },
      ],
      issues: [],
    });
  });

  it('senza intestazioni usa il mazzo principale e somma le righe ripetute', () => {
    const { lines } = parseDeckList('2 Scintilla Rovente\n2 scintilla  rovente\nmazzo:\n1 Vigore della Selva');
    expect(lines).toEqual([
      { name: 'Scintilla Rovente', quantity: 4, board: 'main', line: 1 },
      { name: 'Vigore della Selva', quantity: 1, board: 'main', line: 4 },
    ]);
  });

  it('segnala righe non valide e quantità fuori limite con il numero di riga', () => {
    const { lines, issues } = parseDeckList('Scintilla Rovente\n0 Vigore della Selva\n100 Fucina Vulcanica\n4 Fucina Vulcanica');
    expect(lines).toEqual([{ name: 'Fucina Vulcanica', quantity: 4, board: 'main', line: 4 }]);
    expect(issues).toEqual([
      { code: 'INVALID_LINE', line: 1, text: 'Scintilla Rovente' },
      { code: 'INVALID_QUANTITY', line: 2, text: '0 Vigore della Selva' },
      { code: 'INVALID_QUANTITY', line: 3, text: '100 Fucina Vulcanica' },
    ]);
  });

  it('segnala la somma di righe ripetute oltre il limite', () => {
    const { lines, issues } = parseDeckList('60 Fucina Vulcanica\n60 Fucina Vulcanica');
    expect(lines).toEqual([]);
    expect(issues).toEqual([{ code: 'INVALID_QUANTITY', line: 1, text: '120 Fucina Vulcanica' }]);
  });

  it('rifiuta testi troppo lunghi senza analizzarli', () => {
    expect(parseDeckList('x'.repeat(DECK_LIST_MAX_LENGTH + 1))).toEqual({
      lines: [],
      issues: [{ code: 'TOO_LONG', line: 0, text: `Testo oltre ${DECK_LIST_MAX_LENGTH} caratteri` }],
    });
  });
});

describe('resolveDeckList', () => {
  it('risolve i nomi in id e segnala quelli sconosciuti, ordinando i problemi per riga', () => {
    const parsed = parseDeckList('4 scintilla rovente\n2 Carta Inventata\nboh\nRiserva\n1 Scudiera dell’Aurora');
    const result = resolveDeckList(parsed, (name) => CATALOG.get(name));
    expect(result).toEqual({
      entries: [
        { cardId: 'MF1-029', quantity: 4, board: 'main' },
        { cardId: 'MF1-007', quantity: 1, board: 'sideboard' },
      ],
      issues: [
        { code: 'UNKNOWN_CARD', line: 2, text: 'Carta Inventata' },
        { code: 'INVALID_LINE', line: 3, text: 'boh' },
      ],
    });
    expect(ParseDeckListResponseSchema.parse(result)).toEqual(result);
  });
});

describe('formatDeckList', () => {
  it('esporta le sezioni e omette la riserva vuota', () => {
    expect(formatDeckList([{ name: 'Scintilla Rovente', quantity: 4, board: 'main' }])).toBe('Mazzo\n4 Scintilla Rovente\n');
    expect(formatDeckList([])).toBe('Mazzo\n');
  });

  it('round-trip: export → parse restituisce le stesse righe', () => {
    const entries = [
      { name: 'Fucina Vulcanica', quantity: 24, board: 'main' as const },
      { name: 'Scintilla Rovente', quantity: 4, board: 'main' as const },
      { name: 'Vigore della Selva', quantity: 3, board: 'sideboard' as const },
    ];
    const text = formatDeckList(entries);
    expect(text).toBe('Mazzo\n24 Fucina Vulcanica\n4 Scintilla Rovente\n\nRiserva\n3 Vigore della Selva\n');
    expect(parseDeckList(text).lines.map(({ name, quantity, board }) => ({ name, quantity, board }))).toEqual(entries);
  });
});
