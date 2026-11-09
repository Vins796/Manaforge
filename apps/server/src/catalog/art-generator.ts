/**
 * @nature [DATA]
 * @module ArtGenerator
 * @description Illustrazioni procedurali SVG deterministiche: stesso `artSeed` e stessa identità di affinità → stesso SVG.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile apps/server/tests/catalog/art-generator.test.ts
 */
import { createHash } from 'node:crypto';
import { COLORLESS_CODE, MANA_COLORS, type AffinityCode } from '@manaforge/shared';

/** Versione dell'algoritmo: incrementarla invalida tutte le immagini in cache. */
export const ART_GENERATOR_VERSION = 1;
/** Dimensioni dell'illustrazione intera (proporzione carta 63:88). */
export const ART_SIZE = Object.freeze({ width: 630, height: 880 });
/** Finestra 4:3 ritagliata al centro, usata da `CardCompactView`. */
export const ART_CROP = Object.freeze({ x: 0, y: 204, width: 630, height: 472 });

/** Colore di fondo (Nero/Blu Abisso del Design Brief). */
const ABYSS = '#0B0E14';

/** Dati necessari per generare un'illustrazione. */
export interface CardArtInput {
  readonly artSeed: string;
  readonly affinityIdentity: readonly AffinityCode[];
}

/** Coppia di SVG generati. */
export interface CardArt {
  /** Impronta stabile di seed, identità e versione dell'algoritmo (12 hex). */
  readonly fingerprint: string;
  readonly normal: string;
  readonly crop: string;
}

type Random = () => number;

/** PRNG sfc32: veloce, deterministico, 128 bit di stato inizializzati dal digest. */
const createRandom = (digest: Buffer): Random => {
  let a = digest.readUInt32LE(0);
  let b = digest.readUInt32LE(4);
  let c = digest.readUInt32LE(8);
  let d = digest.readUInt32LE(12);
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4_294_967_296;
  };
};

const between = (random: Random, min: number, max: number): number => min + random() * (max - min);
const intBetween = (random: Random, min: number, max: number): number => Math.floor(between(random, min, max + 1));
const fmt = (value: number): string => (Math.round(value * 10) / 10).toString();

/**
 * Miscela due colori esadecimali `#RRGGBB`.
 *
 * @param from - Colore di partenza.
 * @param to - Colore di arrivo.
 * @param amount - 0 = `from`, 1 = `to`.
 * @returns Il colore risultante in `#rrggbb`.
 */
export const mixColors = (from: string, to: string, amount: number): string => {
  const channel = (hex: string, index: number): number => Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const t = Math.min(1, Math.max(0, amount));
  const parts = [0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t));
  return `#${parts.map((p) => p.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Calcola l'impronta di un'illustrazione (usata anche come parte del nome file in cache).
 *
 * @param input - Seed e identità di affinità.
 * @returns 12 caratteri esadecimali.
 */
export const artFingerprint = (input: CardArtInput): string =>
  createHash('sha256')
    .update(`${ART_GENERATOR_VERSION}:${input.artSeed}:${input.affinityIdentity.join('')}`)
    .digest('hex')
    .slice(0, 12);

const palette = (identity: readonly AffinityCode[]): { primary: string; secondary: string } => {
  const [first, second] = identity;
  const primary = MANA_COLORS[first ?? COLORLESS_CODE];
  const secondary = second ? MANA_COLORS[second] : mixColors(primary, ABYSS, 0.35);
  return { primary, secondary };
};

const ridgePath = (random: Random, baseY: number, amplitude: number): string => {
  const segments = intBetween(random, 5, 9);
  const step = ART_SIZE.width / segments;
  const points = Array.from({ length: segments + 1 }, (_, i) => `L${fmt(i * step)},${fmt(baseY + between(random, -amplitude, amplitude))}`);
  return `M0,${ART_SIZE.height} ${points.join(' ')} L${ART_SIZE.width},${ART_SIZE.height} Z`;
};

const polygonPoints = (cx: number, cy: number, radius: number, sides: number, rotation: number): string =>
  Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    return `${fmt(cx + radius * Math.cos(angle))},${fmt(cy + radius * Math.sin(angle))}`;
  }).join(' ');

const renderScene = (random: Random, idPrefix: string, identity: readonly AffinityCode[]): string => {
  const { primary, secondary } = palette(identity);
  const id = (name: string): string => `${idPrefix}-${name}`;
  const { width, height } = ART_SIZE;
  const centerY = ART_CROP.y + ART_CROP.height / 2;

  const glow = { x: between(random, 120, 510), y: between(random, 230, 420), r: between(random, 90, 170) };
  const ridges = [0, 1, 2].map((layer) => {
    const fill = mixColors(secondary, ABYSS, 0.55 + layer * 0.15);
    return `<path d="${ridgePath(random, 520 + layer * 110, 60 - layer * 12)}" fill="${fill}"/>`;
  });
  const particles = Array.from({ length: intBetween(random, 24, 48) }, () => {
    const opacity = fmt(between(random, 0.25, 0.9));
    return `<circle cx="${fmt(between(random, 0, width))}" cy="${fmt(between(random, 0, 700))}" r="${fmt(between(random, 1, 3.5))}" fill="${primary}" opacity="${opacity}"/>`;
  });
  const sides = intBetween(random, 3, 8);
  const radius = between(random, 70, 120);
  const rotation = between(random, 0, Math.PI * 2);
  const sigil = [
    `<polygon points="${polygonPoints(width / 2, centerY, radius, sides, rotation)}" fill="none" stroke="${primary}" stroke-width="4"/>`,
    `<circle cx="${width / 2}" cy="${fmt(centerY)}" r="${fmt(radius * 0.55)}" fill="none" stroke="${secondary}" stroke-width="3"/>`,
    `<polygon points="${polygonPoints(width / 2, centerY, radius * 0.3, sides, -rotation)}" fill="${primary}" opacity="0.6"/>`,
  ];

  return [
    '<defs>',
    `<linearGradient id="${id('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mixColors(primary, ABYSS, 0.78)}"/><stop offset="1" stop-color="${mixColors(secondary, ABYSS, 0.35)}"/></linearGradient>`,
    `<radialGradient id="${id('glow')}"><stop offset="0" stop-color="${primary}" stop-opacity="0.85"/><stop offset="1" stop-color="${primary}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${id('vignette')}" r="0.75"><stop offset="0.55" stop-color="${ABYSS}" stop-opacity="0"/><stop offset="1" stop-color="${ABYSS}" stop-opacity="0.85"/></radialGradient>`,
    '</defs>',
    `<rect width="${width}" height="${height}" fill="url(#${id('sky')})"/>`,
    `<circle cx="${fmt(glow.x)}" cy="${fmt(glow.y)}" r="${fmt(glow.r)}" fill="url(#${id('glow')})"/>`,
    ...particles,
    ...ridges,
    `<g opacity="0.85">${sigil.join('')}</g>`,
    `<rect width="${width}" height="${height}" fill="url(#${id('vignette')})"/>`,
  ].join('');
};

const wrapSvg = (body: string, viewBox: { x: number; y: number; width: number; height: number }): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" width="${viewBox.width}" height="${viewBox.height}">${body}</svg>`;

/**
 * Genera l'illustrazione di una carta. Funzione pura: nessun testo della carta finisce nell'SVG
 * (solo numeri e colori fissi), quindi l'output non è soggetto a injection.
 *
 * @param input - Seed e identità di affinità della carta.
 * @returns SVG intero (630×880) e ritaglio 4:3 (630×472) della stessa scena.
 */
export const generateCardArt = (input: CardArtInput): CardArt => {
  const fingerprint = artFingerprint(input);
  const digest = createHash('sha256').update(`${ART_GENERATOR_VERSION}:${input.artSeed}`).digest();
  const body = renderScene(createRandom(digest), `mf${fingerprint}`, input.affinityIdentity);
  return {
    fingerprint,
    normal: wrapSvg(body, { x: 0, y: 0, ...ART_SIZE }),
    crop: wrapSvg(body, ART_CROP),
  };
};
