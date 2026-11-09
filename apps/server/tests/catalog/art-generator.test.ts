/**
 * @nature [TEST]
 * @module ArtGeneratorTest
 * @description Verifica determinismo, variazione per seed/affinità, ritaglio 4:3 e assenza di contenuti non numerici negli SVG.
 * @relatedDocs docs/catalog/TEST/04-catalog-tests.md
 * @testFile apps/server/tests/catalog/art-generator.test.ts
 */
import { describe, expect, it } from 'vitest';
import { MANA_COLORS } from '@manaforge/shared';
import { ART_CROP, ART_SIZE, artFingerprint, generateCardArt, mixColors } from '../../src/catalog/art-generator.js';

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

describe('mixColors', () => {
  it('interpola i canali e limita amount a [0, 1]', () => {
    expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColors('#102030', '#ffffff', -1)).toBe('#102030');
    expect(mixColors('#102030', '#FFFFFF', 2)).toBe('#ffffff');
  });
});
