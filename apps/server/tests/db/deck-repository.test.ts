/**
 * @nature [TEST]
 * @module DeckRepositoryTest
 * @description Integration test su SQLite in-memory del repository dei mazzi: proprietà per utente, sostituzione transazionale delle righe, cascata e vincoli FK.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/server/tests/db/deck-repository.test.ts
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { unwrap, type SaveDeckInput } from '@manaforge/shared';
import { syncCatalog } from '../../src/catalog/catalog-sync.js';
import { deckCards } from '../../src/db/db-schema.js';
import { loadTestCatalog } from '../helpers/catalog-fixtures.js';
import { createTestContext, type TestContext } from '../helpers/test-context.js';

const input = (overrides: Partial<SaveDeckInput> = {}): SaveDeckInput => ({
  name: 'Fiamma Rapida',
  format: 'standard',
  coverCardId: 'TS1-002',
  cards: [
    { cardId: 'TS1-003', quantity: 4, board: 'main' },
    { cardId: 'TS1-001', quantity: 20, board: 'main' },
    { cardId: 'TS1-002', quantity: 2, board: 'sideboard' },
  ],
  ...overrides,
});

describe('DeckRepository', () => {
  let ctx: TestContext;
  let ada: string;
  let bruno: string;

  beforeEach(() => {
    ctx = createTestContext();
    unwrap(syncCatalog(ctx.conn.db, loadTestCatalog()));
    ada = ctx.users.insert({ email: 'ada@example.com', username: 'Ada' }).id;
    bruno = ctx.users.insert({ email: 'bruno@example.com', username: 'Bruno' }).id;
  });

  afterEach(() => ctx.conn.close());

  it('crea un mazzo e lo rilegge con le righe ordinate (mazzo, poi riserva)', () => {
    const created = ctx.decks.create(ada, input());
    expect(created.deck).toMatchObject({ userId: ada, name: 'Fiamma Rapida', format: 'standard', coverCardId: 'TS1-002' });
    expect(created.cards).toEqual([
      { cardId: 'TS1-001', quantity: 20, board: 'main' },
      { cardId: 'TS1-003', quantity: 4, board: 'main' },
      { cardId: 'TS1-002', quantity: 2, board: 'sideboard' },
    ]);
    expect(ctx.decks.findOwned(created.deck.id, ada)).toEqual(created);
  });

  it('un mazzo vuoto è ammesso', () => {
    const created = ctx.decks.create(ada, input({ cards: [], coverCardId: null }));
    expect(created.cards).toEqual([]);
  });

  it('non espone, modifica né elimina mazzi di altri utenti', () => {
    const { deck } = ctx.decks.create(ada, input());
    expect(ctx.decks.findOwned(deck.id, bruno)).toBeUndefined();
    expect(ctx.decks.update(deck.id, bruno, input({ name: 'Rubato' }))).toBeUndefined();
    expect(ctx.decks.remove(deck.id, bruno)).toBe(false);
    expect(ctx.decks.listByUser(bruno)).toEqual([]);
    expect(ctx.decks.findOwned(deck.id, ada)?.deck.name).toBe('Fiamma Rapida');
  });

  it('elenca i mazzi dell\'utente dal più recente', () => {
    const first = ctx.decks.create(ada, input({ name: 'Primo' }));
    const second = ctx.decks.create(ada, input({ name: 'Secondo', cards: [] }));
    ctx.decks.update(first.deck.id, ada, input({ name: 'Primo aggiornato' }));
    const list = ctx.decks.listByUser(ada);
    expect(list.map((record) => record.deck.name)).toEqual(['Primo aggiornato', 'Secondo']);
    expect(list[1]?.cards).toEqual([]);
    expect(list[0]?.deck.updatedAt.getTime()).toBeGreaterThanOrEqual(second.deck.updatedAt.getTime());
  });

  it('update sostituisce tutte le righe in modo atomico', () => {
    const { deck } = ctx.decks.create(ada, input());
    const updated = ctx.decks.update(deck.id, ada, input({ name: 'Nuovo', coverCardId: null, cards: [{ cardId: 'TS1-002', quantity: 4, board: 'main' }] }));
    expect(updated?.deck).toMatchObject({ name: 'Nuovo', coverCardId: null });
    expect(updated?.cards).toEqual([{ cardId: 'TS1-002', quantity: 4, board: 'main' }]);

    // Una carta inesistente viola la FK: la transazione viene annullata e il mazzo resta com'era.
    expect(() => ctx.decks.update(deck.id, ada, input({ name: 'Rotto', cards: [{ cardId: 'XX1-001', quantity: 1, board: 'main' }] }))).toThrow();
    expect(ctx.decks.findOwned(deck.id, ada)).toMatchObject({ deck: { name: 'Nuovo' }, cards: [{ cardId: 'TS1-002', quantity: 4, board: 'main' }] });
  });

  it('remove elimina il mazzo e le righe in cascata', () => {
    const { deck } = ctx.decks.create(ada, input());
    expect(ctx.decks.remove(deck.id, ada)).toBe(true);
    expect(ctx.decks.findOwned(deck.id, ada)).toBeUndefined();
    expect(ctx.conn.db.select().from(deckCards).where(eq(deckCards.deckId, deck.id)).all()).toEqual([]);
    expect(ctx.decks.remove(deck.id, ada)).toBe(false);
  });
});
