/**
 * @nature [DATA]
 * @module CardCatalog
 * @description Carica e valida con Zod i blocchi JSON del catalogo originale, li normalizza e ne calcola la versione (hash).
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile apps/server/tests/catalog/card-catalog.test.ts
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  CATALOG_SCHEMA_VERSION,
  CardCatalogSchema,
  err,
  ok,
  toCardRecord,
  type CardCatalog,
  type CardRecord,
  type Result,
} from '@manaforge/shared';
import mf1PrimaFusione from './mf1-prima-fusione.json' with { type: 'json' };
import mf2CorrentiAstrali from './mf2-correnti-astrali.json' with { type: 'json' };

/** Blocchi distribuiti con l'applicazione, nell'ordine di pubblicazione. */
export const BUNDLED_CATALOG_SOURCES: readonly unknown[] = Object.freeze([mf1PrimaFusione, mf2CorrentiAstrali]);

/** Catalogo validato e pronto per l'import. */
export interface LoadedCatalog {
  /** Hash del contenuto normalizzato: cambia se e solo se cambia una carta. */
  readonly version: string;
  readonly blocks: readonly CardCatalog['block'][];
  /** Carte normalizzate, ordinate per id. */
  readonly records: readonly CardRecord[];
}

/** Errore di caricamento del catalogo. */
export interface CatalogError {
  readonly code: 'CATALOG_INVALID' | 'CATALOG_CONFLICT';
  /** Indice del blocco sorgente che ha causato l'errore. */
  readonly sourceIndex: number;
  readonly message: string;
}

/** Ordinamento per id indipendente dal locale di sistema (gli id sono ASCII). */
const byId = (a: CardRecord, b: CardRecord): number => a.id.localeCompare(b.id, 'en');

/**
 * Calcola la versione del catalogo come SHA-256 (troncato) dei record normalizzati.
 * Include la versione del formato, così un cambio di schema forza il reimport.
 *
 * @param records - Carte normalizzate (l'ordine non conta: vengono ordinate per id).
 * @returns Versione nel formato `v<schema>-<16 hex>`.
 */
export const computeCatalogVersion = (records: readonly CardRecord[]): string => {
  const sorted = [...records].sort(byId);
  const digest = createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  return `v${CATALOG_SCHEMA_VERSION}-${digest.slice(0, 16)}`;
};

/**
 * Valida uno o più blocchi di catalogo e li unisce, verificando che codici blocco e nomi siano unici tra i blocchi.
 *
 * @param sources - Contenuti JSON già deserializzati (non fidati).
 * @returns Il catalogo caricato, oppure il primo errore trovato.
 */
export const parseCatalogSources = (sources: readonly unknown[]): Result<LoadedCatalog, CatalogError> => {
  const blocks: CardCatalog['block'][] = [];
  const records: CardRecord[] = [];
  const names = new Set<string>();

  for (const [sourceIndex, source] of sources.entries()) {
    const parsed = CardCatalogSchema.safeParse(source);
    if (!parsed.success) {
      return err({ code: 'CATALOG_INVALID', sourceIndex, message: z.prettifyError(parsed.error) });
    }
    const { block, cards } = parsed.data;
    if (blocks.some((known) => known.code === block.code)) {
      return err({ code: 'CATALOG_CONFLICT', sourceIndex, message: `Blocco duplicato: ${block.code}` });
    }
    for (const card of cards) {
      const key = card.name.toLocaleLowerCase('it');
      if (names.has(key)) {
        return err({ code: 'CATALOG_CONFLICT', sourceIndex, message: `Nome carta duplicato tra blocchi: ${card.name}` });
      }
      names.add(key);
      records.push(toCardRecord(card));
    }
    blocks.push(block);
  }

  if (records.length === 0) return err({ code: 'CATALOG_INVALID', sourceIndex: -1, message: 'Nessun blocco di catalogo' });
  records.sort(byId);
  return ok({ version: computeCatalogVersion(records), blocks, records });
};

/**
 * Carica il catalogo distribuito con l'applicazione.
 *
 * @returns Il catalogo validato, oppure l'errore di validazione.
 */
export const loadBundledCatalog = (): Result<LoadedCatalog, CatalogError> => parseCatalogSources(BUNDLED_CATALOG_SOURCES);
