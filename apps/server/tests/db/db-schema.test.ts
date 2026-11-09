/**
 * @nature [TEST]
 * @module DbSchemaTest
 * @description Integration test CRUD sullo schema SQLite in-memory: inserimento, lettura, cancellazione, vincoli e cascate.
 * @relatedDocs docs/catalog/DATA/01-sqlite-schema.md
 * @testFile apps/server/tests/db/db-schema.test.ts
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { unwrap } from '@manaforge/shared';
import { IN_MEMORY, openDatabase, type DatabaseConnection } from '../../src/db/db-client.js';
import {
  DEFAULT_AVATAR,
  DEFAULT_DECK_FORMAT,
  cards,
  deckCards,
  decks,
  matches,
  users,
  type NewCard,
} from '../../src/db/db-schema.js';

const sampleCard = (overrides: Partial<NewCard> = {}): NewCard => ({
  id: 'MF1-001',
  name: 'Scintilla Rovente',
  cost: '{F}',
  manaValue: 1,
  typeLine: 'Rapido',
  rulesText: 'Infliggi 3 danni a un bersaglio.',
  affinities: ['F'],
  affinityIdentity: ['F'],
  rarity: 'comune',
  artSeed: 'seed-001',
  catalogVersion: 'test',
  ...overrides,
});

describe('schema SQLite (in-memory)', () => {
  let conn: DatabaseConnection;

  beforeEach(() => {
    conn = unwrap(openDatabase({ filename: IN_MEMORY }));
  });

  afterEach(() => {
    conn.close();
  });

  const insertUser = (email = 'ada@example.com') =>
    conn.db.insert(users).values({ email, username: 'Ada' }).returning().get();

  it('crea e legge un utente con i default (uuid, avatar, createdAt)', () => {
    const user = insertUser();
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.avatar).toBe(DEFAULT_AVATAR);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.passwordHash).toBeNull();

    const read = conn.db.select().from(users).where(eq(users.email, 'ada@example.com')).get();
    expect(read).toEqual(user);
  });

  it('rifiuta email e googleId duplicati', () => {
    insertUser();
    expect(() => insertUser()).toThrow(/UNIQUE/);
    conn.db.insert(users).values({ email: 'b@x.it', username: 'B', googleId: 'g-1' }).run();
    expect(() =>
      conn.db.insert(users).values({ email: 'c@x.it', username: 'C', googleId: 'g-1' }).run(),
    ).toThrow(/UNIQUE/);
  });

  it('serializza e deserializza i campi JSON delle carte', () => {
    conn.db.insert(cards).values(sampleCard({ keywords: ['FULMINEO'] })).run();
    const card = conn.db.select().from(cards).where(eq(cards.id, 'MF1-001')).get();
    expect(card?.affinities).toEqual(['F']);
    expect(card?.keywords).toEqual(['FULMINEO']);
    expect(card?.power).toBeNull();
  });

  it('applica il default [] alle keywords e i CHECK su rarità e valore di mana', () => {
    conn.db.insert(cards).values(sampleCard()).run();
    expect(conn.db.select().from(cards).get()?.keywords).toEqual([]);
    expect(() => conn.db.insert(cards).values(sampleCard({ id: 'X', manaValue: -1 })).run()).toThrow(/CHECK/);
    expect(() =>
      conn.sqlite
        .prepare(
          `INSERT INTO cards (id, name, cost, mana_value, type_line, affinities, affinity_identity, rarity, art_seed, catalog_version)
           VALUES ('Y', 'n', '{1}', 1, 't', '[]', '[]', 'leggendaria', 's', 'v')`,
        )
        .run(),
    ).toThrow(/CHECK/);
  });

  it('gestisce il ciclo di vita di un mazzo con le sue carte', () => {
    const user = insertUser();
    conn.db.insert(cards).values(sampleCard()).run();
    const deck = conn.db.insert(decks).values({ userId: user.id, name: 'Fiamma Rapida' }).returning().get();
    expect(deck.format).toBe(DEFAULT_DECK_FORMAT);

    conn.db.insert(deckCards).values({ deckId: deck.id, cardId: 'MF1-001', quantity: 4 }).run();
    conn.db.insert(deckCards).values({ deckId: deck.id, cardId: 'MF1-001', quantity: 2, board: 'sideboard' }).run();
    const rows = conn.db.select().from(deckCards).where(eq(deckCards.deckId, deck.id)).all();
    expect(rows.map((r) => [r.board, r.quantity]).sort()).toEqual([
      ['main', 4],
      ['sideboard', 2],
    ]);

    conn.db.update(deckCards).set({ quantity: 3 }).where(eq(deckCards.board, 'main')).run();
    expect(conn.db.select().from(deckCards).where(eq(deckCards.board, 'main')).get()?.quantity).toBe(3);

    conn.db.delete(decks).where(eq(decks.id, deck.id)).run();
    expect(conn.db.select().from(deckCards).all()).toHaveLength(0);
  });

  it('impone vincoli su quantità, sezione unica, nome mazzo e chiavi esterne', () => {
    const user = insertUser();
    conn.db.insert(cards).values(sampleCard()).run();
    const deck = conn.db.insert(decks).values({ userId: user.id, name: 'D' }).returning().get();

    expect(() => conn.db.insert(deckCards).values({ deckId: deck.id, cardId: 'MF1-001', quantity: 0 }).run()).toThrow(/CHECK/);
    conn.db.insert(deckCards).values({ deckId: deck.id, cardId: 'MF1-001', quantity: 1 }).run();
    expect(() => conn.db.insert(deckCards).values({ deckId: deck.id, cardId: 'MF1-001', quantity: 1 }).run()).toThrow(/UNIQUE/);
    expect(() => conn.db.insert(deckCards).values({ deckId: deck.id, cardId: 'NON-ESISTE', quantity: 1 }).run()).toThrow(/FOREIGN KEY/);
    expect(() => conn.db.insert(decks).values({ userId: user.id, name: '' }).run()).toThrow(/CHECK/);
    expect(() => conn.db.insert(decks).values({ userId: 'nessuno', name: 'X' }).run()).toThrow(/FOREIGN KEY/);
    // una carta usata in un mazzo non può essere rimossa dal catalogo
    expect(() => conn.db.delete(cards).where(eq(cards.id, 'MF1-001')).run()).toThrow(/FOREIGN KEY/);
  });

  it('azzera la copertina del mazzo se la carta viene rimossa dal catalogo', () => {
    const user = insertUser();
    conn.db.insert(cards).values(sampleCard()).run();
    const deck = conn.db.insert(decks).values({ userId: user.id, name: 'D', coverCardId: 'MF1-001' }).returning().get();
    conn.db.delete(cards).where(eq(cards.id, 'MF1-001')).run();
    expect(conn.db.select().from(decks).where(eq(decks.id, deck.id)).get()?.coverCardId).toBeNull();
  });

  it('aggiorna updatedAt del mazzo a ogni modifica', () => {
    const user = insertUser();
    const past = new Date('2020-01-01T00:00:00Z');
    const deck = conn.db.insert(decks).values({ userId: user.id, name: 'D', updatedAt: past }).returning().get();
    expect(deck.updatedAt).toEqual(past);
    const updated = conn.db.update(decks).set({ name: 'D2' }).where(eq(decks.id, deck.id)).returning().get();
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(past.getTime());
  });

  it('dichiara le chiavi esterne attese con le relative azioni ON DELETE', () => {
    const describeFks = (table: Parameters<typeof getTableConfig>[0]) =>
      getTableConfig(table)
        .foreignKeys.map((fk) => {
          const ref = fk.reference();
          return `${ref.columns.map((c) => c.name).join()}->${getTableConfig(ref.foreignTable).name}:${fk.onDelete}`;
        })
        .sort();
    expect(describeFks(decks)).toEqual(['cover_card_id->cards:set null', 'user_id->users:cascade']);
    expect(describeFks(deckCards)).toEqual(['card_id->cards:restrict', 'deck_id->decks:cascade']);
    expect(describeFks(matches)).toEqual(['host_user_id->users:cascade']);
  });

  it('registra partite bot e p2p e cancella a cascata con l\'utente host', () => {
    const host = insertUser();
    conn.db.insert(decks).values({ userId: host.id, name: 'D' }).run();
    conn.db.insert(matches).values({ hostUserId: host.id, mode: 'bot', winnerUserId: host.id }).run();
    // l'ospite p2p vive su un'altra macchina: nessuna FK sul suo id
    conn.db.insert(matches).values({ hostUserId: host.id, mode: 'p2p', guestUserId: 'remote-uuid' }).run();
    expect(conn.db.select().from(matches).all()).toHaveLength(2);
    expect(() =>
      conn.sqlite.prepare(`INSERT INTO matches (id, host_user_id, mode, played_at) VALUES ('m', ?, 'ranked', 0)`).run(host.id),
    ).toThrow(/CHECK/);

    conn.db.delete(users).where(eq(users.id, host.id)).run();
    expect(conn.db.select().from(matches).all()).toHaveLength(0);
    expect(conn.db.select().from(decks).all()).toHaveLength(0);
  });
});
