/**
 * @nature [TEST]
 * @module CatalogFixtures
 * @description Batch di carte di prova (blocco `TS1`) e helper per costruire cataloghi caricati nei test del server.
 * @relatedDocs docs/catalog/TEST/04-catalog-tests.md
 * @testFile apps/server/tests/catalog/catalog-sync.test.ts
 */
import { unwrap, type CardDefinitionInput } from '@manaforge/shared';
import { parseCatalogSources, type LoadedCatalog } from '../../src/catalog/card-catalog.js';

/** Tre carte di prova: una Fonte base, una creatura e un Rapido. */
export const TEST_CARDS: readonly CardDefinitionInput[] = Object.freeze([
  { id: 'TS1-001', name: 'Fonte di Prova', cost: '', type: 'Fonte base', subtypes: ['Fiamma'], rulesText: 'Esaurisci: aggiungi {F}.', rarity: 'comune', artSeed: 'fonte-di-prova' },
  { id: 'TS1-002', name: 'Drago di Prova', cost: '{3}{F}{F}', type: 'Creatura', subtypes: ['Drago'], power: 4, toughness: 4, keywords: ['ALATO'], rarity: 'rara', artSeed: 'drago-di-prova' },
  { id: 'TS1-003', name: 'Lampo di Prova', cost: '{F}', type: 'Rapido', rulesText: 'Infligge 3 danni a qualsiasi bersaglio.', rarity: 'comune', artSeed: 'lampo-di-prova' },
]);

/**
 * Costruisce il JSON di un blocco di prova.
 *
 * @param cards - Carte del blocco.
 * @returns Il sorgente non validato.
 */
export const testCatalogSource = (cards: readonly CardDefinitionInput[] = TEST_CARDS): unknown => ({
  schemaVersion: 1,
  block: { code: 'TS1', name: 'Blocco di Prova' },
  cards,
});

/**
 * Carica e valida un catalogo di prova.
 *
 * @param cards - Carte del blocco; default {@link TEST_CARDS}.
 * @returns Il catalogo caricato.
 * @throws Error se le carte non sono valide.
 */
export const loadTestCatalog = (cards: readonly CardDefinitionInput[] = TEST_CARDS): LoadedCatalog =>
  unwrap(parseCatalogSources([testCatalogSource(cards)]));
