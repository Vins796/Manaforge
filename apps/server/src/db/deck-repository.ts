/**
 * @nature [DATA]
 * @module DeckRepository
 * @description Accesso a `decks` e `deck_cards` sempre filtrato per proprietario: elenco, lettura, creazione, sostituzione transazionale delle righe ed eliminazione.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/server/tests/db/deck-repository.test.ts
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { DeckEntry, SaveDeckInput } from '@manaforge/shared';
import type { AppDatabase } from './db-client.js';
import { deckCards, decks, type Deck } from './db-schema.js';

/** Mazzo letto dal DB con le sue righe (mazzo principale prima, poi riserva). */
export interface DeckRecord {
  readonly deck: Deck;
  readonly cards: DeckEntry[];
}

/** Operazioni sui mazzi. Ogni metodo agisce solo sui mazzi di `userId`. */
export interface DeckRepository {
  /** Mazzi dell'utente, dal più recente. */
  listByUser(userId: string): DeckRecord[];
  /** Il mazzo, se esiste e appartiene all'utente. */
  findOwned(deckId: string, userId: string): DeckRecord | undefined;
  /** Crea un mazzo con le sue righe in un'unica transazione. Lancia se una carta non esiste (FK). */
  create(userId: string, input: SaveDeckInput): DeckRecord;
  /** Sostituisce nome, formato, copertina e righe; `undefined` se il mazzo non è dell'utente. */
  update(deckId: string, userId: string, input: SaveDeckInput): DeckRecord | undefined;
  /** Elimina il mazzo (le righe seguono in cascata); `false` se non è dell'utente. */
  remove(deckId: string, userId: string): boolean;
}

/**
 * Crea il repository dei mazzi.
 *
 * @param db - Istanza Drizzle.
 * @returns Il {@link DeckRepository}.
 */
export const createDeckRepository = (db: AppDatabase): DeckRepository => {
  const entriesOf = (deckIds: readonly string[]): Map<string, DeckEntry[]> => {
    const byDeck = new Map<string, DeckEntry[]>(deckIds.map((id) => [id, []]));
    if (deckIds.length === 0) return byDeck;
    db.select({ deckId: deckCards.deckId, cardId: deckCards.cardId, quantity: deckCards.quantity, board: deckCards.board })
      .from(deckCards)
      .where(inArray(deckCards.deckId, [...deckIds]))
      .orderBy(asc(deckCards.board), asc(deckCards.cardId))
      .all()
      .forEach(({ deckId, ...entry }) => byDeck.get(deckId)?.push(entry));
    return byDeck;
  };

  const owned = (deckId: string, userId: string) => and(eq(decks.id, deckId), eq(decks.userId, userId));

  const findOwned = (deckId: string, userId: string): DeckRecord | undefined => {
    const deck = db.select().from(decks).where(owned(deckId, userId)).get();
    return deck ? { deck, cards: entriesOf([deck.id]).get(deck.id) ?? [] } : undefined;
  };

  return {
    listByUser: (userId) => {
      const rows = db.select().from(decks).where(eq(decks.userId, userId)).orderBy(desc(decks.updatedAt), asc(decks.name)).all();
      const entries = entriesOf(rows.map((row) => row.id));
      return rows.map((deck) => ({ deck, cards: entries.get(deck.id) ?? [] }));
    },

    findOwned,

    create: (userId, { name, format, coverCardId, cards }) =>
      db.transaction((tx) => {
        const deck = tx.insert(decks).values({ userId, name, format, coverCardId }).returning().get();
        if (cards.length > 0) tx.insert(deckCards).values(cards.map((entry) => ({ ...entry, deckId: deck.id }))).run();
        return { deck, cards: entriesOf([deck.id]).get(deck.id) ?? [] };
      }),

    update: (deckId, userId, { name, format, coverCardId, cards }) =>
      db.transaction((tx) => {
        const deck = tx
          .update(decks)
          .set({ name, format, coverCardId, updatedAt: new Date() })
          .where(owned(deckId, userId))
          .returning()
          .get();
        if (!deck) return undefined;
        tx.delete(deckCards).where(eq(deckCards.deckId, deckId)).run();
        if (cards.length > 0) tx.insert(deckCards).values(cards.map((entry) => ({ ...entry, deckId }))).run();
        return { deck, cards: entriesOf([deckId]).get(deckId) ?? [] };
      }),

    remove: (deckId, userId) => db.delete(decks).where(owned(deckId, userId)).run().changes > 0,
  };
};
