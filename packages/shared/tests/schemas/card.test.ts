/**
 * @nature [TEST]
 * @module CardSchemasTest
 * @description Verifica gli schemi Zod del catalogo carte (vincoli per tipo, unicità nel blocco) e la derivazione del record.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile packages/shared/tests/schemas/card.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  CardCatalogSchema,
  CardDefinitionSchema,
  formatTypeLine,
  toCardRecord,
  type CardDefinition,
  type CardDefinitionInput,
} from '../../src/schemas/card.js';

const creature = (overrides: Partial<CardDefinitionInput> = {}): CardDefinitionInput => ({
  id: 'TS1-001',
  name: 'Lupo di Prova',
  cost: '{1}{S}',
  type: 'Creatura',
  subtypes: ['Lupo'],
  power: 2,
  toughness: 2,
  keywords: ['VEDETTA'],
  rarity: 'comune',
  artSeed: 'lupo-di-prova',
  ...overrides,
});

const issues = (input: unknown): string[] => {
  const parsed = CardDefinitionSchema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
};

describe('CardDefinitionSchema', () => {
  it('accetta una creatura valida applicando i default', () => {
    const parsed = CardDefinitionSchema.parse(creature({ subtypes: undefined, keywords: undefined }));
    expect(parsed).toMatchObject({ subtypes: [], keywords: [], rulesText: '' });
  });

  it('accetta una Fonte base senza costo e con un sottotipo', () => {
    expect(
      issues({ id: 'TS1-002', name: 'Bosco', cost: '', type: 'Fonte base', subtypes: ['Selva'], rulesText: 'Esaurisci: aggiungi {S}.', rarity: 'comune', artSeed: 'bosco' }),
    ).toEqual([]);
  });

  it.each<[string, Partial<CardDefinitionInput>, string]>([
    ['creatura senza Forza', { power: undefined }, 'Forza e Resistenza'],
    ['non creatura con Forza', { type: 'Rapido', keywords: [], toughness: undefined }, 'Solo le Creature'],
    ['parole chiave su un Rituale', { type: 'Rituale', power: undefined, toughness: undefined }, 'solo sulle Creature'],
    ['parole chiave duplicate', { keywords: ['ALATO', 'ALATO'] }, 'duplicate'],
    ['Fonte con costo', { type: 'Fonte', cost: '{1}', power: undefined, toughness: undefined, keywords: [] }, 'Le Fonti non hanno costo'],
    ['magia senza costo', { cost: '' }, 'Le Fonti non hanno costo'],
    ['Fonte base rara', { type: 'Fonte base', cost: '', rarity: 'rara', power: undefined, toughness: undefined, keywords: [] }, 'Fonte base'],
    ['costo malformato', { cost: '{F}{1}' }, 'Costo di mana non valido'],
  ])('rifiuta: %s', (_label, overrides, message) => {
    expect(issues(creature(overrides)).join('\n')).toContain(message);
  });

  it.each([
    ['id', 'mf1-1'],
    ['name', 'Nome<script>'],
    ['artSeed', 'Seed Con Spazi'],
    ['rarity', 'leggendaria'],
  ])('rifiuta il campo %s non valido', (field, value) => {
    expect(issues(creature({ [field]: value }))).not.toEqual([]);
  });

  it('rifiuta campi sconosciuti (strict)', () => {
    expect(issues({ ...creature(), flavor: 'x' })).not.toEqual([]);
  });
});

describe('CardCatalogSchema', () => {
  const catalog = (cards: CardDefinitionInput[]) => ({ schemaVersion: 1, block: { code: 'TS1', name: 'Test' }, cards });

  it('accetta un blocco coerente', () => {
    expect(CardCatalogSchema.safeParse(catalog([creature()])).success).toBe(true);
  });

  it('rifiuta id fuori blocco, duplicati di id/nome (case-insensitive)/artSeed e blocchi vuoti', () => {
    const result = CardCatalogSchema.safeParse(
      catalog([
        creature(),
        creature({ id: 'XX1-002', name: 'Altro', artSeed: 'altro' }),
        creature({ id: 'TS1-001', name: 'LUPO DI PROVA', artSeed: 'lupo-di-prova' }),
      ]),
    );
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('deve iniziare con "TS1-"'),
        expect.stringContaining('id duplicato'),
        expect.stringContaining('name duplicato'),
        expect.stringContaining('artSeed duplicato'),
      ]),
    );
    expect(CardCatalogSchema.safeParse(catalog([])).success).toBe(false);
    expect(CardCatalogSchema.safeParse({ ...catalog([creature()]), schemaVersion: 2 }).success).toBe(false);
  });
});

describe('toCardRecord', () => {
  it('deriva valore di mana, riga del tipo, affinità e identità (costo + simboli nel testo)', () => {
    const card: CardDefinition = CardDefinitionSchema.parse(
      creature({ cost: '{2}{F}', rulesText: 'Esaurisci: aggiungi {S}.', keywords: ['SCATTO', 'ALATO'], subtypes: ['Drago', 'Antico'] }),
    );
    expect(toCardRecord(card)).toEqual({
      id: 'TS1-001',
      name: 'Lupo di Prova',
      cost: '{2}{F}',
      manaValue: 3,
      typeLine: 'Creatura — Drago Antico',
      rulesText: 'Esaurisci: aggiungi {S}.',
      affinities: ['F'],
      affinityIdentity: ['F', 'S'],
      power: 2,
      toughness: 2,
      keywords: ['ALATO', 'SCATTO'],
      rarity: 'comune',
      artSeed: 'lupo-di-prova',
    });
  });

  it('usa null per Forza/Resistenza assenti', () => {
    const spell = CardDefinitionSchema.parse({ id: 'TS1-003', name: 'Lampo', cost: '{F}', type: 'Rapido', rarity: 'comune', artSeed: 'lampo' });
    expect(toCardRecord(spell)).toMatchObject({ power: null, toughness: null, typeLine: 'Rapido', affinityIdentity: ['F'] });
  });

  it('lancia se riceve una definizione con costo non valido (invariante)', () => {
    const invalid = { ...CardDefinitionSchema.parse(creature()), cost: '{Z}' };
    expect(() => toCardRecord(invalid)).toThrow(/Costo non valido per TS1-001/);
  });

  it('formatTypeLine omette il separatore senza sottotipi', () => {
    expect(formatTypeLine('Artefatto', [])).toBe('Artefatto');
    expect(formatTypeLine('Fonte base', ['Alba'])).toBe('Fonte base — Alba');
  });
});
