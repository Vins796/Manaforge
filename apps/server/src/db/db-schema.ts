/**
 * @nature [DATA]
 * @module DbSchema
 * @description Schema Drizzle delle tabelle SQLite locali: users, cards, decks, deck_cards, matches.
 * @relatedDocs docs/catalog/DATA/01-sqlite-schema.md
 * @testFile apps/server/tests/db/db-schema.test.ts
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { CARD_RARITIES, type AffinityCode, type KeywordCode } from '@manaforge/shared';

/** Rarità ammesse per le carte del catalogo (fonte unica: `@manaforge/shared`). */
export { CARD_RARITIES };
/** Sezioni di un mazzo. */
export const DECK_BOARDS = ['main', 'sideboard'] as const;
/** Modalità di partita. */
export const MATCH_MODES = ['bot', 'p2p'] as const;
/** Avatar assegnato ai nuovi utenti. */
export const DEFAULT_AVATAR = 'forgiatore';
/** Formato assegnato ai nuovi mazzi. */
export const DEFAULT_DECK_FORMAT = 'standard';

const uuidPk = () => text('id').primaryKey().$defaultFn(() => randomUUID());
const createdAtColumn = (name: string) =>
  integer(name, { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

/** Profili utente locali (login manuale e/o Google). */
export const users = sqliteTable('users', {
  id: uuidPk(),
  email: text('email').notNull().unique(),
  username: text('username').notNull(),
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  avatar: text('avatar').notNull().default(DEFAULT_AVATAR),
  createdAt: createdAtColumn('created_at'),
});

/** Catalogo carte originale, importato dai JSON versionati in `src/catalog`. */
export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    cost: text('cost').notNull(),
    manaValue: integer('mana_value').notNull(),
    typeLine: text('type_line').notNull(),
    rulesText: text('rules_text').notNull().default(''),
    affinities: text('affinities', { mode: 'json' }).$type<AffinityCode[]>().notNull(),
    affinityIdentity: text('affinity_identity', { mode: 'json' }).$type<AffinityCode[]>().notNull(),
    power: integer('power'),
    toughness: integer('toughness'),
    keywords: text('keywords', { mode: 'json' })
      .$type<KeywordCode[]>()
      .notNull()
      .default(sql`'[]'`),
    rarity: text('rarity', { enum: CARD_RARITIES }).notNull(),
    artSeed: text('art_seed').notNull(),
    localImageNormalPath: text('local_image_normal_path'),
    localImageCropPath: text('local_image_crop_path'),
    catalogVersion: text('catalog_version').notNull(),
  },
  (t) => [
    index('cards_name_idx').on(t.name),
    index('cards_mana_value_idx').on(t.manaValue),
    index('cards_type_line_idx').on(t.typeLine),
    check('cards_mana_value_check', sql`${t.manaValue} >= 0`),
    check('cards_rarity_check', sql`${t.rarity} IN ('comune', 'non_comune', 'rara', 'mitica')`),
  ],
);

/** Mazzi di proprietà di un utente. */
export const decks = sqliteTable(
  'decks',
  {
    id: uuidPk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    format: text('format').notNull().default(DEFAULT_DECK_FORMAT),
    coverCardId: text('cover_card_id').references(() => cards.id, { onDelete: 'set null' }),
    updatedAt: createdAtColumn('updated_at').$onUpdateFn(() => new Date()),
  },
  (t) => [
    index('decks_user_id_idx').on(t.userId),
    check('decks_name_length_check', sql`length(${t.name}) BETWEEN 1 AND 40`),
  ],
);

/** Righe dei mazzi: quantità di una carta in una sezione. */
export const deckCards = sqliteTable(
  'deck_cards',
  {
    id: uuidPk(),
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    board: text('board', { enum: DECK_BOARDS }).notNull().default('main'),
  },
  (t) => [
    unique('deck_cards_deck_card_board_unique').on(t.deckId, t.cardId, t.board),
    check('deck_cards_quantity_check', sql`${t.quantity} > 0`),
    check('deck_cards_board_check', sql`${t.board} IN ('main', 'sideboard')`),
  ],
);

/**
 * Storico partite dell'Host.
 *
 * @remarks
 * `guestUserId` e `winnerUserId` non hanno chiave esterna: l'utente ospite vive nel DB
 * di un'altra macchina, quindi il suo id non esiste localmente.
 */
export const matches = sqliteTable(
  'matches',
  {
    id: uuidPk(),
    hostUserId: text('host_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    guestUserId: text('guest_user_id'),
    mode: text('mode', { enum: MATCH_MODES }).notNull(),
    winnerUserId: text('winner_user_id'),
    playedAt: createdAtColumn('played_at'),
  },
  (t) => [
    index('matches_host_user_id_idx').on(t.hostUserId),
    check('matches_mode_check', sql`${t.mode} IN ('bot', 'p2p')`),
  ],
);

/** Riga di `users` letta dal DB. */
export type User = typeof users.$inferSelect;
/** Dati per inserire una riga in `users`. */
export type NewUser = typeof users.$inferInsert;
/** Riga di `cards` letta dal DB. */
export type Card = typeof cards.$inferSelect;
/** Dati per inserire una riga in `cards`. */
export type NewCard = typeof cards.$inferInsert;
/** Riga di `decks` letta dal DB. */
export type Deck = typeof decks.$inferSelect;
/** Dati per inserire una riga in `decks`. */
export type NewDeck = typeof decks.$inferInsert;
/** Riga di `deck_cards` letta dal DB. */
export type DeckCard = typeof deckCards.$inferSelect;
/** Dati per inserire una riga in `deck_cards`. */
export type NewDeckCard = typeof deckCards.$inferInsert;
/** Riga di `matches` letta dal DB. */
export type Match = typeof matches.$inferSelect;
/** Dati per inserire una riga in `matches`. */
export type NewMatch = typeof matches.$inferInsert;
