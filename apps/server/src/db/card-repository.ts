/**
 * @nature [DATA]
 * @module CardRepository
 * @description Accesso alla tabella `cards`: lettura per id, elenco ordinato e aggiornamento dei percorsi delle immagini in cache.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile apps/server/tests/db/card-repository.test.ts
 */
import { asc, eq } from 'drizzle-orm';
import type { AppDatabase } from './db-client.js';
import { cards, type Card } from './db-schema.js';

/** Percorsi delle immagini di una carta in cache. */
export interface CardImagePaths {
  readonly normalPath: string;
  readonly cropPath: string;
}

/** Operazioni sulla tabella `cards`. */
export interface CardRepository {
  findById(id: string): Card | undefined;
  /** Tutte le carte ordinate per valore di mana e nome. */
  listAll(): Card[];
  /** Registra i percorsi delle immagini generate; restituisce la carta aggiornata. */
  setImagePaths(id: string, paths: CardImagePaths): Card | undefined;
}

/**
 * Crea il repository delle carte.
 *
 * @param db - Istanza Drizzle.
 * @returns Il {@link CardRepository}.
 */
export const createCardRepository = (db: AppDatabase): CardRepository => ({
  findById: (id) => db.select().from(cards).where(eq(cards.id, id)).get(),
  listAll: () => db.select().from(cards).orderBy(asc(cards.manaValue), asc(cards.name)).all(),
  setImagePaths: (id, { normalPath, cropPath }) =>
    db
      .update(cards)
      .set({ localImageNormalPath: normalPath, localImageCropPath: cropPath })
      .where(eq(cards.id, id))
      .returning()
      .get(),
});
