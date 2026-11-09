/**
 * @nature [DATA]
 * @module CardSchemas
 * @description Schemi Zod del catalogo carte originale (definizione carta e blocco) e derivazione del record normalizzato.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile packages/shared/tests/schemas/card.test.ts
 */
import { z } from 'zod';
import { AFFINITY_CODES, type AffinityCode } from '../constants/affinities.js';
import { KEYWORD_CODES, type KeywordCode } from '../constants/keywords.js';
import { affinitiesInText, ManaCostSchema, parseManaCost } from './mana-cost.js';

/** Rarità ammesse per le carte del catalogo. */
export const CARD_RARITIES = ['comune', 'non_comune', 'rara', 'mitica'] as const;
export type CardRarity = (typeof CARD_RARITIES)[number];

/** Tipi di carta. */
export const CARD_TYPES = ['Creatura', 'Rituale', 'Rapido', 'Artefatto', 'Fonte', 'Fonte base'] as const;
export type CardType = (typeof CARD_TYPES)[number];

/** Tipi senza costo di mana (si giocano come risorsa, una per turno). */
export const SOURCE_TYPES: readonly CardType[] = ['Fonte', 'Fonte base'];

/** Versione del formato dei file di catalogo. */
export const CATALOG_SCHEMA_VERSION = 1;
/** Separatore tra tipo e sottotipi nella riga del tipo. */
export const TYPE_LINE_SEPARATOR = ' — ';
/** Lunghezza massima del nome di una carta. */
export const CARD_NAME_MAX_LENGTH = 40;
/** Lunghezza massima del testo delle regole. */
export const RULES_TEXT_MAX_LENGTH = 400;
/** Massimo numero di carte in un singolo file di catalogo. */
export const MAX_CARDS_PER_BLOCK = 1000;

/** Codice di blocco: lettera maiuscola seguita da 1–4 maiuscole o cifre (es. `MF1`). */
export const BlockCodeSchema = z.string().regex(/^[A-Z][A-Z0-9]{1,4}$/);
/** Identificativo carta: `<BLOCCO>-<NNN>` (es. `MF1-042`). Sicuro come nome di file. */
export const CardIdSchema = z.string().regex(/^[A-Z][A-Z0-9]{1,4}-\d{3}$/);

const CardNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(CARD_NAME_MAX_LENGTH)
  .regex(/^\p{L}[\p{L} '’,-]*$/u, 'Il nome ammette lettere, spazi, apostrofi, virgole e trattini');
const SubtypeSchema = z.string().regex(/^\p{Lu}\p{L}{1,23}$/u, 'Sottotipo: una parola con iniziale maiuscola');
const StatSchema = z.int().min(0).max(20);

/** Definizione di una carta come scritta nel file JSON del catalogo. */
export const CardDefinitionSchema = z
  .strictObject({
    id: CardIdSchema,
    name: CardNameSchema,
    cost: ManaCostSchema,
    type: z.enum(CARD_TYPES),
    subtypes: z.array(SubtypeSchema).max(3).default([]),
    rulesText: z.string().trim().max(RULES_TEXT_MAX_LENGTH).default(''),
    power: StatSchema.optional(),
    toughness: StatSchema.optional(),
    keywords: z.array(z.enum(KEYWORD_CODES)).max(KEYWORD_CODES.length).default([]),
    rarity: z.enum(CARD_RARITIES),
    artSeed: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'artSeed: minuscole, cifre e trattini (max 64)'),
  })
  .superRefine((card, ctx) => {
    const isCreature = card.type === 'Creatura';
    const isSource = SOURCE_TYPES.includes(card.type);
    if (isCreature && (card.power === undefined || card.toughness === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['power'], message: 'Le Creature richiedono Forza e Resistenza' });
    }
    if (!isCreature && (card.power !== undefined || card.toughness !== undefined)) {
      ctx.addIssue({ code: 'custom', path: ['toughness'], message: 'Solo le Creature hanno Forza e Resistenza' });
    }
    if (!isCreature && card.keywords.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['keywords'], message: 'Le parole chiave sono ammesse solo sulle Creature' });
    }
    if (new Set(card.keywords).size !== card.keywords.length) {
      ctx.addIssue({ code: 'custom', path: ['keywords'], message: 'Parole chiave duplicate' });
    }
    if (isSource !== (card.cost === '')) {
      ctx.addIssue({ code: 'custom', path: ['cost'], message: 'Le Fonti non hanno costo; tutte le altre carte sì' });
    }
    if (card.type === 'Fonte base' && (card.rarity !== 'comune' || card.subtypes.length !== 1)) {
      ctx.addIssue({ code: 'custom', path: ['type'], message: 'Una Fonte base è comune e ha esattamente un sottotipo' });
    }
  });
export type CardDefinitionInput = z.input<typeof CardDefinitionSchema>;
export type CardDefinition = z.output<typeof CardDefinitionSchema>;

/** File di catalogo: un blocco di carte con codice e nome. */
export const CardCatalogSchema = z
  .strictObject({
    schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
    block: z.strictObject({ code: BlockCodeSchema, name: z.string().trim().min(1).max(60) }),
    cards: z.array(CardDefinitionSchema).min(1).max(MAX_CARDS_PER_BLOCK),
  })
  .superRefine((catalog, ctx) => {
    const seen = { id: new Set<string>(), name: new Set<string>(), artSeed: new Set<string>() };
    catalog.cards.forEach((card, index) => {
      if (!card.id.startsWith(`${catalog.block.code}-`)) {
        ctx.addIssue({ code: 'custom', path: ['cards', index, 'id'], message: `L'id deve iniziare con "${catalog.block.code}-"` });
      }
      for (const field of ['id', 'name', 'artSeed'] as const) {
        const key = field === 'name' ? card.name.toLocaleLowerCase('it') : card[field];
        if (seen[field].has(key)) {
          ctx.addIssue({ code: 'custom', path: ['cards', index, field], message: `${field} duplicato: "${card[field]}"` });
        }
        seen[field].add(key);
      }
    });
  });
export type CardCatalogInput = z.input<typeof CardCatalogSchema>;
export type CardCatalog = z.output<typeof CardCatalogSchema>;

/** Carta normalizzata, con i campi derivati pronti per il database e le API. */
export interface CardRecord {
  readonly id: string;
  readonly name: string;
  readonly cost: string;
  readonly manaValue: number;
  readonly typeLine: string;
  readonly rulesText: string;
  readonly affinities: AffinityCode[];
  readonly affinityIdentity: AffinityCode[];
  readonly power: number | null;
  readonly toughness: number | null;
  readonly keywords: KeywordCode[];
  readonly rarity: CardRarity;
  readonly artSeed: string;
}

/**
 * Costruisce la riga del tipo (es. `Creatura — Drago Guerriero`).
 *
 * @param type - Tipo della carta.
 * @param subtypes - Sottotipi.
 * @returns La riga del tipo.
 */
export const formatTypeLine = (type: CardType, subtypes: readonly string[]): string =>
  subtypes.length === 0 ? type : `${type}${TYPE_LINE_SEPARATOR}${subtypes.join(' ')}`;

/**
 * Deriva il record normalizzato da una definizione già validata.
 * L'identità di affinità unisce le affinità del costo e quelle citate come simboli nel testo.
 *
 * @param card - Definizione validata con {@link CardDefinitionSchema}.
 * @returns Il {@link CardRecord}.
 * @throws Error se il costo non è valido (invariante: la definizione deve provenire dallo schema).
 */
export const toCardRecord = (card: CardDefinition): CardRecord => {
  const cost = parseManaCost(card.cost);
  if (!cost.ok) throw new Error(`Costo non valido per ${card.id}: ${cost.error}`);
  const identity = new Set<AffinityCode>([...cost.value.affinities, ...affinitiesInText(card.rulesText)]);
  return {
    id: card.id,
    name: card.name,
    cost: card.cost,
    manaValue: cost.value.manaValue,
    typeLine: formatTypeLine(card.type, card.subtypes),
    rulesText: card.rulesText,
    affinities: [...cost.value.affinities],
    affinityIdentity: AFFINITY_CODES.filter((code) => identity.has(code)),
    power: card.power ?? null,
    toughness: card.toughness ?? null,
    keywords: KEYWORD_CODES.filter((code) => card.keywords.includes(code)),
    rarity: card.rarity,
    artSeed: card.artSeed,
  };
};
