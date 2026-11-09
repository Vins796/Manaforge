/**
 * @nature [API]
 * @module DeckSchemas
 * @description Contratti REST di carte e mazzi (Zod) e regole di costruzione del mazzo (min 60, max 15 in riserva, max 4 copie salvo Fonti base).
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile packages/shared/tests/schemas/deck.test.ts
 */
import { z } from 'zod';
import { AFFINITY_CODES } from '../constants/affinities.js';
import { MAX_COPIES_PER_CARD, MAX_SIDEBOARD_SIZE, MIN_DECK_SIZE } from '../constants/game.js';
import { KEYWORD_CODES } from '../constants/keywords.js';
import { CARD_RARITIES, CardIdSchema } from './card.js';

/** Sezioni di un mazzo: principale e riserva. */
export const DECK_BOARDS = ['main', 'sideboard'] as const;
export type DeckBoard = (typeof DECK_BOARDS)[number];

/** Formati di gioco ammessi. */
export const DECK_FORMATS = ['standard'] as const;
export type DeckFormat = (typeof DECK_FORMATS)[number];

/** Lunghezza massima del nome di un mazzo (coerente con il CHECK SQL). */
export const DECK_NAME_MAX_LENGTH = 40;
/** Copie massime ammesse in una singola riga (limite di sicurezza, anche per le Fonti base). */
export const MAX_ENTRY_QUANTITY = 99;
/** Righe massime in un mazzo (carte distinte per sezione). */
export const MAX_DECK_ENTRIES = 250;
/** Prefisso della riga del tipo delle Fonti base, esenti dal limite di copie. */
export const BASIC_SOURCE_TYPE_PREFIX = 'Fonte base';

/** Carta come esposta dalle API (nessun percorso locale). */
export const CardViewSchema = z.strictObject({
  id: CardIdSchema,
  name: z.string(),
  cost: z.string(),
  manaValue: z.int().min(0),
  typeLine: z.string(),
  rulesText: z.string(),
  affinities: z.array(z.enum(AFFINITY_CODES)),
  affinityIdentity: z.array(z.enum(AFFINITY_CODES)),
  power: z.int().nullable(),
  toughness: z.int().nullable(),
  keywords: z.array(z.enum(KEYWORD_CODES)),
  rarity: z.enum(CARD_RARITIES),
});
export type CardView = z.infer<typeof CardViewSchema>;

/** Risposta di `GET /api/cards`. */
export const CardListResponseSchema = z.strictObject({ cards: z.array(CardViewSchema) });
export type CardListResponse = z.infer<typeof CardListResponseSchema>;

/** Nome del mazzo: 1–40 caratteri stampabili, spazi ai bordi rimossi. */
export const DeckNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(DECK_NAME_MAX_LENGTH)
  .regex(/^[^\p{Cc}]+$/u, 'Il nome non può contenere caratteri di controllo');

/** Una riga del mazzo: quantità di una carta in una sezione. */
export const DeckEntrySchema = z.strictObject({
  cardId: CardIdSchema,
  quantity: z.int().min(1).max(MAX_ENTRY_QUANTITY),
  board: z.enum(DECK_BOARDS),
});
export type DeckEntry = z.infer<typeof DeckEntrySchema>;

/** Corpo di `POST /api/decks` e `PUT /api/decks/:id`. Le righe duplicate (stessa carta e sezione) sono rifiutate. */
export const SaveDeckRequestSchema = z
  .strictObject({
    name: DeckNameSchema,
    format: z.enum(DECK_FORMATS).default('standard'),
    coverCardId: CardIdSchema.nullable().default(null),
    cards: z.array(DeckEntrySchema).max(MAX_DECK_ENTRIES),
  })
  .superRefine((deck, ctx) => {
    const seen = new Set<string>();
    deck.cards.forEach((entry, index) => {
      const key = `${entry.board}:${entry.cardId}`;
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: ['cards', index], message: `Riga duplicata: ${entry.cardId}` });
      seen.add(key);
    });
  });
export type SaveDeckRequest = z.input<typeof SaveDeckRequestSchema>;
export type SaveDeckInput = z.output<typeof SaveDeckRequestSchema>;

/** Codici dei problemi di costruzione del mazzo. */
export const DECK_ISSUE_CODES = ['MAIN_TOO_SMALL', 'SIDEBOARD_TOO_LARGE', 'TOO_MANY_COPIES', 'UNKNOWN_CARD'] as const;
export type DeckIssueCode = (typeof DECK_ISSUE_CODES)[number];

/** Problemi che impediscono il salvataggio (gli altri rendono il mazzo solo "incompleto"). */
export const BLOCKING_DECK_ISSUES: readonly DeckIssueCode[] = ['SIDEBOARD_TOO_LARGE', 'TOO_MANY_COPIES', 'UNKNOWN_CARD'];

/** Un problema di costruzione del mazzo. */
export const DeckIssueSchema = z.discriminatedUnion('code', [
  z.strictObject({ code: z.literal('MAIN_TOO_SMALL'), count: z.int(), min: z.int() }),
  z.strictObject({ code: z.literal('SIDEBOARD_TOO_LARGE'), count: z.int(), max: z.int() }),
  z.strictObject({ code: z.literal('TOO_MANY_COPIES'), cardId: z.string(), name: z.string(), count: z.int(), max: z.int() }),
  z.strictObject({ code: z.literal('UNKNOWN_CARD'), cardId: z.string() }),
]);
export type DeckIssue = z.infer<typeof DeckIssueSchema>;

/** Esito della validazione delle regole di costruzione. */
export const DeckValidationSchema = z.strictObject({
  isValid: z.boolean(),
  mainCount: z.int(),
  sideboardCount: z.int(),
  issues: z.array(DeckIssueSchema),
});
export type DeckValidation = z.infer<typeof DeckValidationSchema>;

/** Mazzo nell'elenco di `GET /api/decks`. */
export const DeckSummarySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  format: z.enum(DECK_FORMATS),
  coverCardId: CardIdSchema.nullable(),
  updatedAt: z.iso.datetime(),
  mainCount: z.int(),
  sideboardCount: z.int(),
  isValid: z.boolean(),
});
export type DeckSummary = z.infer<typeof DeckSummarySchema>;

/** Risposta di `GET /api/decks`. */
export const DeckListResponseSchema = z.strictObject({ decks: z.array(DeckSummarySchema) });
export type DeckListResponse = z.infer<typeof DeckListResponseSchema>;

/** Mazzo completo (`GET/POST/PUT /api/decks[/:id]`). */
export const DeckDetailSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  format: z.enum(DECK_FORMATS),
  coverCardId: CardIdSchema.nullable(),
  updatedAt: z.iso.datetime(),
  cards: z.array(DeckEntrySchema),
  validation: DeckValidationSchema,
});
export type DeckDetail = z.infer<typeof DeckDetailSchema>;

/** Dati minimi di una carta necessari alla validazione. */
export interface DeckRuleCard {
  readonly id: string;
  readonly name: string;
  readonly typeLine: string;
}

/**
 * Indica se una carta è una Fonte base (esente dal limite di copie).
 *
 * @param card - Carta con la riga del tipo.
 * @returns `true` per le Fonti base.
 */
export const isBasicSource = (card: Pick<DeckRuleCard, 'typeLine'>): boolean => card.typeLine.startsWith(BASIC_SOURCE_TYPE_PREFIX);

/**
 * Valida le regole di costruzione: almeno 60 carte nel mazzo principale, al massimo 15 in riserva,
 * al massimo 4 copie per carta sommando le due sezioni (le Fonti base sono illimitate), nessuna carta sconosciuta.
 *
 * @param entries - Righe del mazzo.
 * @param lookup - Risolve un id carta; `undefined` se la carta non esiste nel catalogo.
 * @returns Conteggi, problemi trovati e `isValid` (nessun problema).
 */
export const validateDeck = (
  entries: readonly DeckEntry[],
  lookup: (cardId: string) => DeckRuleCard | undefined,
): DeckValidation => {
  const issues: DeckIssue[] = [];
  const copies = new Map<string, number>();
  let mainCount = 0;
  let sideboardCount = 0;

  for (const entry of entries) {
    if (entry.board === 'main') mainCount += entry.quantity;
    else sideboardCount += entry.quantity;
    copies.set(entry.cardId, (copies.get(entry.cardId) ?? 0) + entry.quantity);
  }

  if (mainCount < MIN_DECK_SIZE) issues.push({ code: 'MAIN_TOO_SMALL', count: mainCount, min: MIN_DECK_SIZE });
  if (sideboardCount > MAX_SIDEBOARD_SIZE) issues.push({ code: 'SIDEBOARD_TOO_LARGE', count: sideboardCount, max: MAX_SIDEBOARD_SIZE });
  for (const [cardId, count] of copies) {
    const card = lookup(cardId);
    if (!card) issues.push({ code: 'UNKNOWN_CARD', cardId });
    else if (!isBasicSource(card) && count > MAX_COPIES_PER_CARD) {
      issues.push({ code: 'TOO_MANY_COPIES', cardId, name: card.name, count, max: MAX_COPIES_PER_CARD });
    }
  }
  return { isValid: issues.length === 0, mainCount, sideboardCount, issues };
};

/**
 * Indica se la validazione contiene problemi che impediscono il salvataggio.
 *
 * @param validation - Esito di {@link validateDeck}.
 * @returns `true` se c'è almeno un problema bloccante.
 */
export const hasBlockingIssues = (validation: DeckValidation): boolean =>
  validation.issues.some((issue) => BLOCKING_DECK_ISSUES.includes(issue.code));

/**
 * Descrizione in italiano di un problema di costruzione, per la UI.
 *
 * @param issue - Problema.
 * @returns Il messaggio.
 */
export const describeDeckIssue = (issue: DeckIssue): string => {
  switch (issue.code) {
    case 'MAIN_TOO_SMALL':
      return `Il mazzo ha ${issue.count} carte: ne servono almeno ${issue.min}.`;
    case 'SIDEBOARD_TOO_LARGE':
      return `La riserva ha ${issue.count} carte: al massimo ${issue.max}.`;
    case 'TOO_MANY_COPIES':
      return `${issue.name}: ${issue.count} copie, al massimo ${issue.max}.`;
    case 'UNKNOWN_CARD':
      return `Carta sconosciuta: ${issue.cardId}.`;
  }
};
