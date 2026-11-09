/**
 * @nature [DATA]
 * @module DeckListFormat
 * @description Parser ed esportatore del formato testuale delle liste mazzo (`4 Scintilla Rovente`, sezioni `Mazzo` / `Riserva`) e risoluzione dei nomi.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile packages/shared/tests/schemas/deck-list.test.ts
 */
import { z } from 'zod';
import { DeckEntrySchema, MAX_ENTRY_QUANTITY, type DeckBoard, type DeckEntry } from './deck.js';

/** Lunghezza massima del testo importato (circa 500 righe). */
export const DECK_LIST_MAX_LENGTH = 20_000;

/** Intestazioni delle sezioni nel formato testuale. */
export const DECK_LIST_HEADERS: Readonly<Record<DeckBoard, string>> = Object.freeze({ main: 'Mazzo', sideboard: 'Riserva' });

/** Riga di carta letta dal testo (nome non ancora risolto). */
export interface DeckListLine {
  readonly name: string;
  readonly quantity: number;
  readonly board: DeckBoard;
  /** Numero di riga (1-based) della prima occorrenza. */
  readonly line: number;
}

/** Codici dei problemi di import. */
export const DECK_LIST_ISSUE_CODES = ['TOO_LONG', 'INVALID_LINE', 'INVALID_QUANTITY', 'UNKNOWN_CARD'] as const;
export type DeckListIssueCode = (typeof DECK_LIST_ISSUE_CODES)[number];

/** Problema di una riga del testo importato (`line` = 0 per problemi dell'intero testo). */
export const DeckListIssueSchema = z.strictObject({
  code: z.enum(DECK_LIST_ISSUE_CODES),
  line: z.int().min(0),
  text: z.string(),
});
export type DeckListIssue = z.infer<typeof DeckListIssueSchema>;

/** Esito del parsing del testo. */
export interface ParsedDeckList {
  readonly lines: DeckListLine[];
  readonly issues: DeckListIssue[];
}

/** Corpo di `POST /api/decks/parse`. */
export const ParseDeckListRequestSchema = z.strictObject({ text: z.string().max(DECK_LIST_MAX_LENGTH) });
export type ParseDeckListRequest = z.infer<typeof ParseDeckListRequestSchema>;

/** Risposta di `POST /api/decks/parse`: righe risolte e problemi (l'import riesce se `issues` è vuoto). */
export const ParseDeckListResponseSchema = z.strictObject({
  entries: z.array(DeckEntrySchema),
  issues: z.array(DeckListIssueSchema),
});
export type ParseDeckListResponse = z.infer<typeof ParseDeckListResponseSchema>;

const HEADER_RE = /^(mazzo|riserva)(?:\s*\(\d+\))?\s*:?$/iu;
const CARD_LINE_RE = /^(\d{1,6})\s*[xX]?\s+(\S.*)$/u;

/**
 * Normalizza un nome di carta per il confronto: spazi compattati, apostrofo tipografico → `'`, minuscole.
 *
 * @param name - Nome come scritto dall'utente o dal catalogo.
 * @returns La chiave di confronto.
 */
export const normalizeCardName = (name: string): string =>
  name.trim().replace(/\s+/gu, ' ').replace(/[’‘`´]/gu, "'").toLocaleLowerCase('it');

/**
 * Legge una lista mazzo testuale.
 *
 * Formato: una carta per riga (`4 Nome Carta`, ammesso anche `4x Nome Carta`); le righe `Mazzo` / `Riserva`
 * (con `:` o `(N)` opzionali) cambiano sezione; righe vuote e commenti (`#`, `//`) sono ignorati.
 * Senza intestazione le carte vanno nel mazzo principale. Le righe ripetute della stessa carta e sezione si sommano.
 *
 * @param text - Testo incollato dall'utente.
 * @returns Righe lette e problemi riscontrati.
 */
export const parseDeckList = (text: string): ParsedDeckList => {
  if (text.length > DECK_LIST_MAX_LENGTH) {
    return { lines: [], issues: [{ code: 'TOO_LONG', line: 0, text: `Testo oltre ${DECK_LIST_MAX_LENGTH} caratteri` }] };
  }
  const merged = new Map<string, { name: string; quantity: number; board: DeckBoard; line: number }>();
  const issues: DeckListIssue[] = [];
  let board: DeckBoard = 'main';

  text.split(/\r?\n/u).forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

    const header = HEADER_RE.exec(trimmed);
    if (header) {
      board = header[1]?.toLocaleLowerCase('it') === 'riserva' ? 'sideboard' : 'main';
      return;
    }
    const match = CARD_LINE_RE.exec(trimmed);
    if (!match) {
      issues.push({ code: 'INVALID_LINE', line, text: trimmed });
      return;
    }
    const quantity = Number(match[1]);
    const name = (match[2] ?? '').trim().replace(/\s+/gu, ' ');
    if (quantity < 1 || quantity > MAX_ENTRY_QUANTITY) {
      issues.push({ code: 'INVALID_QUANTITY', line, text: trimmed });
      return;
    }
    const key = `${board}:${normalizeCardName(name)}`;
    const previous = merged.get(key);
    if (previous) previous.quantity += quantity;
    else merged.set(key, { name, quantity, board, line });
  });

  const lines: DeckListLine[] = [];
  for (const entry of merged.values()) {
    if (entry.quantity > MAX_ENTRY_QUANTITY) issues.push({ code: 'INVALID_QUANTITY', line: entry.line, text: `${entry.quantity} ${entry.name}` });
    else lines.push(entry);
  }
  issues.sort((a, b) => a.line - b.line);
  return { lines, issues };
};

/**
 * Risolve i nomi letti dal testo in id di carta.
 *
 * @param parsed - Esito di {@link parseDeckList}.
 * @param findIdByName - Restituisce l'id della carta con quel nome normalizzato ({@link normalizeCardName}), o `undefined`.
 * @returns Righe del mazzo pronte e problemi (quelli del parsing più i nomi sconosciuti), ordinati per riga.
 */
export const resolveDeckList = (
  parsed: ParsedDeckList,
  findIdByName: (normalizedName: string) => string | undefined,
): { entries: DeckEntry[]; issues: DeckListIssue[] } => {
  const entries: DeckEntry[] = [];
  const issues = [...parsed.issues];
  for (const line of parsed.lines) {
    const cardId = findIdByName(normalizeCardName(line.name));
    if (cardId) entries.push({ cardId, quantity: line.quantity, board: line.board });
    else issues.push({ code: 'UNKNOWN_CARD', line: line.line, text: line.name });
  }
  issues.sort((a, b) => a.line - b.line);
  return { entries, issues };
};

/** Riga da esportare. */
export interface DeckListExportEntry {
  readonly name: string;
  readonly quantity: number;
  readonly board: DeckBoard;
}

/**
 * Esporta un mazzo nel formato testuale (sezione `Riserva` solo se non vuota), nell'ordine ricevuto.
 *
 * @param entries - Righe con nome della carta.
 * @returns Il testo, terminato da a capo.
 */
export const formatDeckList = (entries: readonly DeckListExportEntry[]): string => {
  const section = (board: DeckBoard) =>
    entries.filter((entry) => entry.board === board).map((entry) => `${entry.quantity} ${entry.name}`);
  const main = section('main');
  const sideboard = section('sideboard');
  const blocks = [[DECK_LIST_HEADERS.main, ...main].join('\n')];
  if (sideboard.length > 0) blocks.push([DECK_LIST_HEADERS.sideboard, ...sideboard].join('\n'));
  return `${blocks.join('\n\n')}\n`;
};
