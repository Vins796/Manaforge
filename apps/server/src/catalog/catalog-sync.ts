/**
 * @nature [DATA]
 * @module CatalogSync
 * @description Importer idempotente del catalogo nella tabella `cards`, guidato dalla versione (hash) del catalogo.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile apps/server/tests/catalog/catalog-sync.test.ts
 */
import { eq, inArray } from 'drizzle-orm';
import { err, ok, type CardRecord, type Result } from '@manaforge/shared';
import type { AppDatabase } from '../db/db-client.js';
import { cards, deckCards, type NewCard } from '../db/db-schema.js';
import type { LoadedCatalog } from './card-catalog.js';

/** Esito di una sincronizzazione. */
export interface CatalogSyncReport {
  readonly version: string;
  /** `up_to_date`: nessuna scrittura, il DB contiene già questa versione. */
  readonly status: 'up_to_date' | 'imported';
  readonly inserted: number;
  readonly updated: number;
  /** Carte non più nel catalogo e rimosse dal DB. */
  readonly removed: number;
  /** Carte non più nel catalogo ma conservate perché usate in almeno un mazzo. */
  readonly retained: readonly string[];
}

/** Errore di scrittura durante la sincronizzazione (la transazione viene annullata). */
export interface CatalogSyncError {
  readonly code: 'CATALOG_SYNC_FAILED';
  readonly message: string;
}

/** Massimo numero di parametri per singola query `IN (...)` (limite prudente di SQLite). */
const IN_CHUNK_SIZE = 500;

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const toRow = (record: CardRecord, catalogVersion: string): Omit<NewCard, 'localImageNormalPath' | 'localImageCropPath'> => ({
  id: record.id,
  name: record.name,
  cost: record.cost,
  manaValue: record.manaValue,
  typeLine: record.typeLine,
  rulesText: record.rulesText,
  affinities: [...record.affinities],
  affinityIdentity: [...record.affinityIdentity],
  power: record.power,
  toughness: record.toughness,
  keywords: [...record.keywords],
  rarity: record.rarity,
  artSeed: record.artSeed,
  catalogVersion,
});

/**
 * Allinea la tabella `cards` al catalogo.
 *
 * - Se tutte le carte del catalogo sono già presenti con la stessa versione, non scrive nulla.
 * - Altrimenti, in un'unica transazione: inserisce le nuove carte, aggiorna le esistenti (azzerando i percorsi
 *   delle immagini se cambia l'illustrazione) e rimuove le carte uscite dal catalogo non usate da alcun mazzo.
 *
 * @param db - Istanza Drizzle.
 * @param catalog - Catalogo validato.
 * @returns Il resoconto, oppure un errore se la transazione fallisce.
 */
export const syncCatalog = (db: AppDatabase, catalog: LoadedCatalog): Result<CatalogSyncReport, CatalogSyncError> => {
  const { version, records } = catalog;
  try {
    const current = db.select({ id: cards.id, artSeed: cards.artSeed, catalogVersion: cards.catalogVersion }).from(cards).all();
    const wanted = new Set(records.map((record) => record.id));
    const upToDate = current.filter((row) => row.catalogVersion === version && wanted.has(row.id)).length === records.length;
    if (upToDate) return ok({ version, status: 'up_to_date', inserted: 0, updated: 0, removed: 0, retained: [] });

    return ok(
      db.transaction((tx) => {
        const existing = new Map(current.map((row) => [row.id, row]));
        let inserted = 0;
        let updated = 0;
        for (const record of records) {
          const row = toRow(record, version);
          const previous = existing.get(record.id);
          if (!previous) {
            tx.insert(cards).values(row).run();
            inserted += 1;
            continue;
          }
          const artChanged = previous.artSeed !== record.artSeed;
          tx.update(cards)
            .set(artChanged ? { ...row, localImageNormalPath: null, localImageCropPath: null } : row)
            .where(eq(cards.id, record.id))
            .run();
          updated += 1;
        }

        const stale = current.map((row) => row.id).filter((id) => !wanted.has(id));
        const referenced = new Set<string>();
        for (const ids of chunk(stale, IN_CHUNK_SIZE)) {
          tx.selectDistinct({ cardId: deckCards.cardId })
            .from(deckCards)
            .where(inArray(deckCards.cardId, ids))
            .all()
            .forEach(({ cardId }) => referenced.add(cardId));
        }
        const removable = stale.filter((id) => !referenced.has(id));
        for (const ids of chunk(removable, IN_CHUNK_SIZE)) tx.delete(cards).where(inArray(cards.id, ids)).run();

        return {
          version,
          status: 'imported' as const,
          inserted,
          updated,
          removed: removable.length,
          retained: stale.filter((id) => referenced.has(id)),
        };
      }),
    );
  } catch (cause) {
    return err({ code: 'CATALOG_SYNC_FAILED', message: cause instanceof Error ? cause.message : String(cause) });
  }
};
