/**
 * @nature [TEST]
 * @module ArtGeneratorTest
 * @description Verifica determinismo, variazione per seed/affinità/tipo, soggetti e famiglie di sagome, ali, atmosfere, ritaglio 4:3 e assenza di contenuti non numerici negli SVG.
 * @relatedDocs docs/catalog/TEST/04-catalog-tests.md
 * @testFile apps/server/tests/catalog/art-generator.test.ts
 */
import { describe, expect, it } from 'vitest';
import { MANA_COLORS } from '@manaforge/shared';
import { MANA_COLORS as COLORS } from '@manaforge/shared';
import {
  ART_CROP,
  ART_SIZE,
  artFingerprint,
  artSubject,
  creatureFamily,
  generateCardArt,
  mixColors,
} from '../../src/catalog/art-generator.js';

describe('generateCardArt', () => {
  const dragon = { artSeed: 'drago-delle-fornaci', affinityIdentity: ['F'] as const };

  it('è deterministico: stesso input → stesso SVG e stessa impronta', () => {
    expect(generateCardArt(dragon)).toEqual(generateCardArt({ ...dragon }));
    expect(generateCardArt(dragon).fingerprint).toBe(artFingerprint(dragon));
    expect(artFingerprint(dragon)).toMatch(/^[0-9a-f]{12}$/);
  });

  it('cambia con il seed e con l\'identità di affinità', () => {
    const base = generateCardArt(dragon);
    expect(generateCardArt({ ...dragon, artSeed: 'altro-seed' }).normal).not.toBe(base.normal);
    const blue = generateCardArt({ ...dragon, affinityIdentity: ['M'] });
    expect(blue.fingerprint).not.toBe(base.fingerprint);
    expect(blue.normal).toContain(MANA_COLORS.M);
    expect(base.normal).toContain(MANA_COLORS.F);
  });

  it('produce la scena intera 63:88 e il ritaglio 4:3 della stessa scena', () => {
    const art = generateCardArt(dragon);
    expect(art.normal).toContain(`viewBox="0 0 ${ART_SIZE.width} ${ART_SIZE.height}"`);
    expect(art.crop).toContain(`viewBox="${ART_CROP.x} ${ART_CROP.y} ${ART_CROP.width} ${ART_CROP.height}"`);
    expect(ART_CROP.width / ART_CROP.height).toBeCloseTo(4 / 3, 2);
    const body = (svg: string) => svg.slice(svg.indexOf('>') + 1);
    expect(body(art.crop)).toBe(body(art.normal));
  });

  it('usa il grigio incolore senza identità e due colori per le multi-affinità', () => {
    expect(generateCardArt({ artSeed: 'automa', affinityIdentity: [] }).normal).toContain(MANA_COLORS.C);
    const multi = generateCardArt({ artSeed: 'chimera', affinityIdentity: ['M', 'F'] }).normal;
    expect(multi).toContain(MANA_COLORS.M);
    expect(multi).toMatch(/#[0-9a-f]{6}/);
  });

  it('non contiene script, riferimenti esterni o id non prefissati', () => {
    const { normal } = generateCardArt(dragon);
    expect(normal).not.toMatch(/<script|href="http|on[a-z]+=/i);
    const ids = [...normal.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id).toMatch(/^mf[0-9a-f]{12}-/);
  });
});

describe('soggetti e sagome', () => {
  it.each([
    ['Creatura — Drago', 'creature'],
    ['Fonte base — Fiamma', 'source'],
    ['Fonte', 'source'],
    ['Rituale', 'ritual'],
    ['Rapido', 'instant'],
    ['Artefatto', 'artifact'],
    ['Ignoto', 'sigil'],
    [undefined, 'sigil'],
  ] as const)('%s → %s', (typeLine, subject) => {
    expect(artSubject(typeLine)).toBe(subject);
    const art = generateCardArt({ artSeed: 'seme', affinityIdentity: ['A'], ...(typeLine ? { typeLine } : {}) });
    expect(art.normal).toContain(`data-subject="${subject}"`);
  });

  it.each([
    ['Creatura — Umano Cavaliere', 'humanoid'],
    ['Creatura — Lupo', 'beast'],
    ['Creatura — Umano Druido', 'humanoid'],
    ['Creatura — Leviatano', 'serpent'],
    ['Creatura — Uccello', 'bird'],
    ['Creatura — Costrutto', 'construct'],
    ['Creatura', 'humanoid'],
    [undefined, 'humanoid'],
  ] as const)('famiglia di %s → %s', (typeLine, family) => {
    expect(creatureFamily(typeLine)).toBe(family);
  });

  it('ogni famiglia e soggetto produce uno SVG diverso; le ali dipendono da Alato', () => {
    const svgs = ['Creatura — Umano', 'Creatura — Lupo', 'Creatura — Serpente', 'Creatura — Fenice', 'Creatura — Golem', 'Rituale', 'Rapido', 'Artefatto', 'Fonte']
      .map((typeLine) => generateCardArt({ artSeed: 'stesso-seme', affinityIdentity: ['S'], typeLine }).normal);
    expect(new Set(svgs).size).toBe(svgs.length);

    for (const typeLine of ['Creatura — Umano', 'Creatura — Lupo']) {
      const plain = { artSeed: 'ali', affinityIdentity: ['O'] as const, typeLine };
      const winged = generateCardArt({ ...plain, keywords: ['ALATO'] });
      expect(winged.normal).not.toBe(generateCardArt(plain).normal);
      expect(winged.fingerprint).not.toBe(artFingerprint(plain));
      expect(artFingerprint({ ...plain, keywords: ['SCATTO'] })).toBe(artFingerprint(plain));
    }
    // Seed diversi coprono le varianti della testa (tonda, cornuta, con cresta) e i versi delle bestie.
    for (const typeLine of ['Creatura — Umano', 'Creatura — Lupo']) {
      const variants = new Set(Array.from({ length: 16 }, (_, i) => generateCardArt({ artSeed: `variante-${i}`, affinityIdentity: ['F'], typeLine }).normal));
      expect(variants.size).toBe(16);
    }
    // Alato su una non-creatura non cambia nulla.
    const spell = { artSeed: 'ali', affinityIdentity: ['O'] as const, typeLine: 'Rituale' };
    expect(artFingerprint({ ...spell, keywords: ['ALATO'] })).toBe(artFingerprint(spell));
  });

  it('l\'atmosfera usa il colore dell\'affinità principale, incluse le schegge incolori', () => {
    for (const code of ['A', 'M', 'O', 'F', 'S'] as const) {
      for (const seedName of ['uno', 'due', 'tre']) {
        const art = generateCardArt({ artSeed: `${seedName}-${code}`, affinityIdentity: [code], typeLine: 'Creatura — Bestia' }).normal;
        expect(art).toContain(COLORS[code]);
      }
    }
    expect(generateCardArt({ artSeed: 'schegge', affinityIdentity: [], typeLine: 'Artefatto' }).normal).toContain(COLORS.C);
  });
});

describe('mixColors', () => {
  it('interpola i canali e limita amount a [0, 1]', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColors('#102030', '#ffffff', -1)).toBe('#102030');
    expect(mixColors('#102030', '#FFFFFF', 2)).toBe('#ffffff');
  });
});
