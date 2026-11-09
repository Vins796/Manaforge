/**
 * @nature [DATA]
 * @module ArtGenerator
 * @description Illustrazioni procedurali SVG deterministiche: soggetto per tipo di carta (sagoma della creatura per famiglia di sottotipo, cristalli, cerchio runico, fulmini, ingranaggio), atmosfera per affinità; stesso input → stesso SVG.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile apps/server/tests/catalog/art-generator.test.ts
 */
import { createHash } from 'node:crypto';
import { COLORLESS_CODE, MANA_COLORS, TYPE_LINE_SEPARATOR, type AffinityCode, type KeywordCode } from '@manaforge/shared';

/** Versione dell'algoritmo: incrementarla invalida tutte le immagini in cache. */
export const ART_GENERATOR_VERSION = 2;
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
  /** Riga del tipo (es. `Creatura — Drago`): sceglie il soggetto. Senza, viene disegnato un sigillo generico. */
  readonly typeLine?: string;
  /** Parole chiave: `ALATO` aggiunge le ali alle creature. */
  readonly keywords?: readonly KeywordCode[];
}

/** Soggetti disponibili, derivati dal tipo di carta. */
export const ART_SUBJECTS = ['creature', 'source', 'ritual', 'instant', 'artifact', 'sigil'] as const;
export type ArtSubject = (typeof ART_SUBJECTS)[number];

const SUBJECT_BY_TYPE: Readonly<Record<string, ArtSubject>> = {
  Creatura: 'creature',
  Fonte: 'source',
  'Fonte base': 'source',
  Rituale: 'ritual',
  Rapido: 'instant',
  Artefatto: 'artifact',
};

/**
 * Soggetto dell'illustrazione per una riga del tipo.
 *
 * @param typeLine - Riga del tipo, opzionale.
 * @returns Il soggetto (`sigil` se il tipo manca o non è noto).
 */
export const artSubject = (typeLine: string | undefined): ArtSubject =>
  (typeLine && SUBJECT_BY_TYPE[typeLine.split(TYPE_LINE_SEPARATOR)[0] ?? '']) || 'sigil';

const hasWings = (input: CardArtInput): boolean => artSubject(input.typeLine) === 'creature' && (input.keywords ?? []).includes('ALATO');

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
    .update(`${ART_GENERATOR_VERSION}:${input.artSeed}:${input.affinityIdentity.join('')}:${input.typeLine ?? ''}:${hasWings(input) ? 'w' : ''}`)
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

/** Contesto di disegno condiviso dai livelli della scena. */
interface Scene {
  readonly random: Random;
  readonly id: (name: string) => string;
  readonly primary: string;
  readonly secondary: string;
  readonly dark: string;
  /** Centro del soggetto (al centro del ritaglio 4:3, così resta visibile anche in `crop`). */
  readonly cx: number;
  readonly cy: number;
}

/** Atmosfera per affinità principale: raggi, onde, nebbia e luna, braci, foglie o schegge. */
const renderAtmosphere = (scene: Scene, affinity: AffinityCode | undefined): string[] => {
  const { random, primary } = scene;
  const count = intBetween(random, 14, 26);
  const x = () => fmt(between(random, 0, ART_SIZE.width));
  const y = () => fmt(between(random, 40, 640));
  const opacity = () => fmt(between(random, 0.25, 0.8));
  switch (affinity) {
    case 'A':
    {
      const rays = intBetween(random, 7, 12);
      return Array.from({ length: rays }, (_, i) => {
        const angle = Math.PI * (0.15 + (0.7 * i) / rays);
        const length = between(random, 380, 620);
        return `<line x1="${fmt(scene.cx)}" y1="0" x2="${fmt(scene.cx + Math.cos(angle) * length * (i % 2 ? 1 : -1))}" y2="${fmt(Math.sin(angle) * length)}" stroke="${primary}" stroke-width="${fmt(between(random, 2, 9))}" opacity="0.18"/>`;
      });
    }
    case 'M':
      return Array.from({ length: count }, () => {
        if (random() < 0.5) return `<circle cx="${x()}" cy="${y()}" r="${fmt(between(random, 3, 11))}" fill="none" stroke="${primary}" stroke-width="1.5" opacity="${opacity()}"/>`;
        const wx = between(random, -40, ART_SIZE.width);
        const wy = between(random, 80, 640);
        return `<path d="M${fmt(wx)},${fmt(wy)} q30,-14 60,0 t60,0" fill="none" stroke="${primary}" stroke-width="2" opacity="${opacity()}"/>`;
      });
    case 'O':
      return [
        `<circle cx="${fmt(between(random, 90, 540))}" cy="${fmt(between(random, 90, 200))}" r="44" fill="${primary}" opacity="0.7"/>`,
        `<circle cx="${fmt(between(random, 90, 540))}" cy="${fmt(between(random, 70, 180))}" r="40" fill="${scene.dark}" opacity="0.9"/>`,
        ...Array.from({ length: intBetween(random, 4, 7) }, () =>
          `<ellipse cx="${x()}" cy="${fmt(between(random, 420, 700))}" rx="${fmt(between(random, 120, 260))}" ry="${fmt(between(random, 10, 26))}" fill="${primary}" opacity="0.12"/>`),
      ];
    case 'F':
      return Array.from({ length: count + 10 }, () => {
        const ex = between(random, 0, ART_SIZE.width);
        const ey = between(random, 120, 760);
        return random() < 0.6
          ? `<circle cx="${fmt(ex)}" cy="${fmt(ey)}" r="${fmt(between(random, 1.5, 4.5))}" fill="${primary}" opacity="${opacity()}"/>`
          : `<line x1="${fmt(ex)}" y1="${fmt(ey)}" x2="${fmt(ex + between(random, -8, 8))}" y2="${fmt(ey - between(random, 14, 34))}" stroke="${primary}" stroke-width="2" stroke-linecap="round" opacity="${opacity()}"/>`;
      });
    case 'S':
      return Array.from({ length: count }, () => {
        const [lx, ly] = [x(), y()];
        return `<ellipse cx="${lx}" cy="${ly}" rx="${fmt(between(random, 5, 11))}" ry="${fmt(between(random, 2, 4))}" transform="rotate(${fmt(between(random, 0, 180))} ${lx} ${ly})" fill="${primary}" opacity="${opacity()}"/>`;
      });
    default:
      return Array.from({ length: count }, () =>
        `<polygon points="${polygonPoints(between(random, 0, ART_SIZE.width), between(random, 40, 640), between(random, 3, 9), intBetween(random, 3, 6), between(random, 0, 6.3))}" fill="${primary}" opacity="${opacity()}"/>`);
  }
};

/** Famiglie di sagome delle creature, scelte dal primo sottotipo riconosciuto. */
export const CREATURE_FAMILIES = ['humanoid', 'beast', 'serpent', 'bird', 'construct'] as const;
export type CreatureFamily = (typeof CREATURE_FAMILIES)[number];

const FAMILY_BY_SUBTYPE: Readonly<Record<string, CreatureFamily>> = {
  Bestia: 'beast', Lupo: 'beast', Orso: 'beast', Cinghiale: 'beast', Segugio: 'beast', Cervo: 'beast', Ratto: 'beast',
  Scoiattolo: 'beast', Salamandra: 'beast', Ragno: 'beast', Chimera: 'beast', Drago: 'beast', Diavolo: 'beast', Orrore: 'beast',
  Serpente: 'serpent', Leviatano: 'serpent', Idra: 'serpent', Medusa: 'serpent',
  Uccello: 'bird', Grifone: 'bird', Fenice: 'bird', Pipistrello: 'bird',
  Costrutto: 'construct', Golem: 'construct', Elementale: 'construct',
};

/**
 * Famiglia della sagoma per una riga del tipo di creatura.
 *
 * @param typeLine - Riga del tipo (es. `Creatura — Lupo`).
 * @returns La famiglia (`humanoid` se nessun sottotipo è riconosciuto).
 */
export const creatureFamily = (typeLine: string | undefined): CreatureFamily => {
  const subtypes = (typeLine?.split(TYPE_LINE_SEPARATOR)[1] ?? '').split(' ');
  for (const subtype of subtypes) {
    const family = FAMILY_BY_SUBTYPE[subtype];
    if (family) return family;
  }
  return 'humanoid';
};

const eyes = (scene: Scene, x: number, y: number, gap: number, size: number): string[] =>
  [-1, 1].map((side) => `<ellipse cx="${fmt(x + side * gap)}" cy="${fmt(y)}" rx="${fmt(size)}" ry="${fmt(size * 0.65)}" fill="${scene.primary}"/>`);

const wingPair = (scene: Scene, x: number, y: number, span: number, rise: number): string[] =>
  [-1, 1].map((side) => {
    const s = side;
    return `<path d="M${fmt(x + s * 18)},${fmt(y)} Q${fmt(x + s * span * 0.5)},${fmt(y - rise * 1.4)} ${fmt(x + s * span)},${fmt(y - rise)} L${fmt(x + s * span * 0.78)},${fmt(y - rise * 0.25)} L${fmt(x + s * span * 0.55)},${fmt(y - rise * 0.15)} L${fmt(x + s * span * 0.35)},${fmt(y + rise * 0.1)} L${fmt(x + s * 22)},${fmt(y + 30)} Z" fill="${scene.dark}" stroke="${scene.secondary}" stroke-width="3" opacity="0.95"/>`;
  });

/** Umanoide: busto, testa (tonda, cornuta o con cresta), occhi luminosi. */
const humanoid = (scene: Scene, ground: number, wings: boolean): string[] => {
  const { random, primary, secondary, dark, cx } = scene;
  const height = between(random, 280, 330);
  const width = between(random, 120, 180);
  const top = ground - height;
  const headR = between(random, 40, 54);
  const headY = top + headR * 0.6;
  const parts = wings ? wingPair(scene, cx, top + height * 0.35, between(random, 220, 280), between(random, 90, 130)) : [];
  parts.push(
    `<path d="M${fmt(cx - width / 2)},${fmt(ground)} C${fmt(cx - width * 0.55)},${fmt(top + height * 0.45)} ${fmt(cx - width * 0.3)},${fmt(headY + headR)} ${fmt(cx)},${fmt(headY + headR * 0.8)} C${fmt(cx + width * 0.3)},${fmt(headY + headR)} ${fmt(cx + width * 0.55)},${fmt(top + height * 0.45)} ${fmt(cx + width / 2)},${fmt(ground)} Z" fill="${dark}" stroke="${primary}" stroke-width="3"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(headY)}" r="${fmt(headR)}" fill="${dark}" stroke="${primary}" stroke-width="3"/>`,
  );
  const head = intBetween(random, 0, 2);
  if (head === 1) {
    for (const side of [-1, 1]) {
      parts.push(`<path d="M${fmt(cx + side * headR * 0.5)},${fmt(headY - headR * 0.7)} Q${fmt(cx + side * headR * 1.3)},${fmt(headY - headR * 1.4)} ${fmt(cx + side * headR * 1.1)},${fmt(headY - headR * 2.1)} Q${fmt(cx + side * headR * 0.9)},${fmt(headY - headR * 1.2)} ${fmt(cx + side * headR * 0.2)},${fmt(headY - headR * 0.9)} Z" fill="${secondary}"/>`);
    }
  } else if (head === 2) {
    parts.push(`<polygon points="${fmt(cx - headR * 0.6)},${fmt(headY - headR * 0.8)} ${fmt(cx)},${fmt(headY - headR * 1.9)} ${fmt(cx + headR * 0.6)},${fmt(headY - headR * 0.8)}" fill="${secondary}"/>`);
  }
  parts.push(...eyes(scene, cx, headY, headR * between(random, 0.3, 0.45), headR * 0.16));
  return parts;
};

/** Bestia quadrupede: corpo, zampe, coda, testa con orecchie o corna. */
const beast = (scene: Scene, ground: number, wings: boolean): string[] => {
  const { random, primary, secondary, dark, cx } = scene;
  const facing = random() < 0.5 ? -1 : 1;
  const bodyW = between(random, 230, 300);
  const bodyH = between(random, 95, 130);
  const legH = between(random, 50, 80);
  const bodyY = ground - legH - bodyH / 2;
  const parts = wings ? wingPair(scene, cx - facing * 20, bodyY - bodyH * 0.3, between(random, 200, 260), between(random, 100, 140)) : [];
  const tailX = cx - facing * bodyW / 2;
  parts.push(`<path d="M${fmt(tailX)},${fmt(bodyY)} Q${fmt(tailX - facing * 70)},${fmt(bodyY - between(random, 20, 90))} ${fmt(tailX - facing * between(random, 80, 120))},${fmt(bodyY - between(random, 60, 130))}" fill="none" stroke="${dark}" stroke-width="12" stroke-linecap="round"/>`);
  for (const offset of [-0.38, -0.18, 0.2, 0.38]) {
    const lx = cx + offset * bodyW;
    parts.push(`<rect x="${fmt(lx - 11)}" y="${fmt(bodyY)}" width="22" height="${fmt(bodyH / 2 + legH)}" rx="8" fill="${dark}" stroke="${primary}" stroke-width="2"/>`);
  }
  parts.push(`<ellipse cx="${fmt(cx)}" cy="${fmt(bodyY)}" rx="${fmt(bodyW / 2)}" ry="${fmt(bodyH / 2)}" fill="${dark}" stroke="${primary}" stroke-width="3"/>`);
  const headR = between(random, 42, 56);
  const headX = cx + facing * (bodyW / 2 + headR * 0.3);
  const headY = bodyY - bodyH * 0.45;
  if (random() < 0.5) {
    for (const side of [-1, 1]) parts.push(`<polygon points="${fmt(headX + side * headR * 0.7)},${fmt(headY - headR * 0.4)} ${fmt(headX + side * headR * 0.85)},${fmt(headY - headR * 1.5)} ${fmt(headX + side * headR * 0.2)},${fmt(headY - headR * 0.8)}" fill="${secondary}"/>`);
  } else {
    for (const side of [-1, 1]) parts.push(`<path d="M${fmt(headX + side * headR * 0.4)},${fmt(headY - headR * 0.8)} Q${fmt(headX + side * headR * 1.6)},${fmt(headY - headR * 1.3)} ${fmt(headX + side * headR * 1.5)},${fmt(headY - headR * 2.2)}" fill="none" stroke="${secondary}" stroke-width="9" stroke-linecap="round"/>`);
  }
  parts.push(
    `<ellipse cx="${fmt(headX + facing * headR * 0.55)}" cy="${fmt(headY + headR * 0.35)}" rx="${fmt(headR * 0.75)}" ry="${fmt(headR * 0.5)}" fill="${dark}" stroke="${primary}" stroke-width="3"/>`,
    `<circle cx="${fmt(headX)}" cy="${fmt(headY)}" r="${fmt(headR)}" fill="${dark}" stroke="${primary}" stroke-width="3"/>`,
    ...eyes(scene, headX + facing * headR * 0.15, headY - headR * 0.1, headR * 0.38, headR * 0.15),
  );
  return parts;
};

/** Serpente: spire ondulate che risalgono verso una testa allungata. */
const serpent = (scene: Scene, ground: number): string[] => {
  const { random, primary, dark, cx } = scene;
  const thickness = between(random, 38, 54);
  const amplitude = between(random, 90, 140);
  const top = ground - between(random, 280, 330);
  const d = `M${fmt(cx - 230)},${fmt(ground)} C${fmt(cx - 120)},${fmt(ground - 120)} ${fmt(cx + amplitude)},${fmt(ground - 40)} ${fmt(cx + amplitude * 0.6)},${fmt(ground - 160)} S${fmt(cx - amplitude)},${fmt(top + 140)} ${fmt(cx)},${fmt(top + 40)}`;
  const headR = thickness * 0.95;
  return [
    `<path d="${d}" fill="none" stroke="${primary}" stroke-width="${fmt(thickness + 6)}" stroke-linecap="round"/>`,
    `<path d="${d}" fill="none" stroke="${dark}" stroke-width="${fmt(thickness)}" stroke-linecap="round"/>`,
    `<ellipse cx="${fmt(cx)}" cy="${fmt(top + 20)}" rx="${fmt(headR * 1.25)}" ry="${fmt(headR * 0.85)}" fill="${dark}" stroke="${primary}" stroke-width="3"/>`,
    ...eyes(scene, cx, top + 10, headR * 0.5, headR * 0.17),
  ];
};

/** Volatile: corpo affusolato, grandi ali spiegate, becco. */
const bird = (scene: Scene): string[] => {
  const { random, primary, secondary, dark, cx, cy } = scene;
  const y = cy - between(random, 10, 40);
  const headR = between(random, 30, 40);
  return [
    ...wingPair(scene, cx, y, between(random, 240, 290), between(random, 110, 160)),
    `<ellipse cx="${fmt(cx)}" cy="${fmt(y + 40)}" rx="${fmt(between(random, 40, 55))}" ry="${fmt(between(random, 85, 110))}" fill="${dark}" stroke="${primary}" stroke-width="3"/>`,
    `<polygon points="${fmt(cx - 40)},${fmt(y + 130)} ${fmt(cx)},${fmt(y + 210)} ${fmt(cx + 40)},${fmt(y + 130)}" fill="${dark}" stroke="${primary}" stroke-width="3"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(y - 60)}" r="${fmt(headR)}" fill="${dark}" stroke="${primary}" stroke-width="3"/>`,
    `<polygon points="${fmt(cx - 10)},${fmt(y - 45)} ${fmt(cx)},${fmt(y - 10)} ${fmt(cx + 10)},${fmt(y - 45)}" fill="${secondary}"/>`,
    ...eyes(scene, cx, y - 65, headR * 0.45, headR * 0.17),
  ];
};

/** Costrutto: blocchi squadrati, spalle, testa a feritoia e nucleo luminoso. */
const construct = (scene: Scene, ground: number): string[] => {
  const { random, primary, secondary, dark, cx } = scene;
  const w = between(random, 150, 200);
  const h = between(random, 170, 210);
  const legH = between(random, 50, 70);
  const top = ground - legH - h;
  const head = between(random, 60, 80);
  return [
    ...[-1, 1].map((s) => `<rect x="${fmt(cx + s * w * 0.25 - 22)}" y="${fmt(ground - legH)}" width="44" height="${fmt(legH)}" fill="${dark}" stroke="${primary}" stroke-width="3"/>`),
    ...[-1, 1].map((s) => `<rect x="${fmt(cx + s * (w / 2 + 22) - 22)}" y="${fmt(top + 10)}" width="44" height="${fmt(h * 0.85)}" rx="10" fill="${dark}" stroke="${primary}" stroke-width="3"/>`),
    `<rect x="${fmt(cx - w / 2)}" y="${fmt(top)}" width="${fmt(w)}" height="${fmt(h)}" rx="14" fill="${dark}" stroke="${primary}" stroke-width="4"/>`,
    `<rect x="${fmt(cx - head / 2)}" y="${fmt(top - head * 0.9)}" width="${fmt(head)}" height="${fmt(head * 0.8)}" rx="8" fill="${dark}" stroke="${primary}" stroke-width="3"/>`,
    `<rect x="${fmt(cx - head * 0.32)}" y="${fmt(top - head * 0.6)}" width="${fmt(head * 0.64)}" height="8" fill="${primary}"/>`,
    `<polygon points="${polygonPoints(cx, top + h * 0.45, between(random, 22, 32), 6, Math.PI / 6)}" fill="${secondary}" stroke="${primary}" stroke-width="2"/>`,
  ];
};

/** Creatura: sagoma originale della famiglia del sottotipo; ali se ha Alato (i volatili le hanno sempre). */
const renderCreature = (scene: Scene, family: CreatureFamily, wings: boolean): string[] => {
  const ground = scene.cy + 170;
  const figure = {
    humanoid: () => humanoid(scene, ground, wings),
    beast: () => beast(scene, ground, wings),
    serpent: () => serpent(scene, ground),
    bird: () => bird(scene),
    construct: () => construct(scene, ground),
  }[family]();
  return [`<circle cx="${fmt(scene.cx)}" cy="${fmt(scene.cy - 40)}" r="230" fill="url(#${scene.id('glow')})" opacity="0.3"/>`, ...figure];
};

/** Fonte: grappolo di cristalli sul terreno con fascio di luce. */
const renderSource = (scene: Scene): string[] => {
  const { random, primary, secondary, cx } = scene;
  const ground = scene.cy + 160;
  const parts = [`<polygon points="${fmt(cx - 40)},0 ${fmt(cx + 40)},0 ${fmt(cx + 120)},${fmt(ground)} ${fmt(cx - 120)},${fmt(ground)}" fill="${primary}" opacity="0.12"/>`];
  const crystals = intBetween(random, 4, 7);
  for (let i = 0; i < crystals; i += 1) {
    const offset = (i - (crystals - 1) / 2) * between(random, 34, 46);
    const h = between(random, 90, 230) * (1 - Math.abs(offset) / 260);
    const w = between(random, 22, 36);
    const tilt = offset * 0.25;
    const x = cx + offset;
    parts.push(
      `<polygon points="${fmt(x - w / 2)},${fmt(ground)} ${fmt(x - w / 2 + tilt)},${fmt(ground - h * 0.8)} ${fmt(x + tilt)},${fmt(ground - h)} ${fmt(x + w / 2 + tilt)},${fmt(ground - h * 0.8)} ${fmt(x + w / 2)},${fmt(ground)}" fill="${i % 2 ? secondary : primary}" stroke="${mixColors(primary, '#ffffff', 0.5)}" stroke-width="2" opacity="0.9"/>`,
      `<line x1="${fmt(x + tilt)}" y1="${fmt(ground - h)}" x2="${fmt(x)}" y2="${fmt(ground)}" stroke="#ffffff" stroke-width="1.5" opacity="0.35"/>`,
    );
  }
  return parts;
};

/** Rituale: cerchio runico con stella poligonale e tacche radiali. */
const renderRitual = (scene: Scene): string[] => {
  const { random, primary, secondary, cx, cy } = scene;
  const r = between(random, 120, 160);
  const points = intBetween(random, 5, 9);
  const step = Math.floor(points / 2);
  const rotation = between(random, 0, Math.PI * 2);
  const star = Array.from({ length: points }, (_, i) => {
    const angle = rotation + (i * step * 2 * Math.PI) / points;
    return `${fmt(cx + r * 0.82 * Math.cos(angle))},${fmt(cy + r * 0.82 * Math.sin(angle))}`;
  }).join(' ');
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const angle = (i * Math.PI) / 12;
    const inner = i % 3 === 0 ? r * 1.05 : r * 1.1;
    return `<line x1="${fmt(cx + inner * Math.cos(angle))}" y1="${fmt(cy + inner * Math.sin(angle))}" x2="${fmt(cx + r * 1.2 * Math.cos(angle))}" y2="${fmt(cy + r * 1.2 * Math.sin(angle))}" stroke="${primary}" stroke-width="3"/>`;
  });
  return [
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r * 1.6)}" fill="url(#${scene.id('glow')})" opacity="0.5"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r * 1.2)}" fill="none" stroke="${primary}" stroke-width="3"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="none" stroke="${secondary}" stroke-width="2"/>`,
    ...ticks,
    `<polygon points="${star}" fill="none" stroke="${primary}" stroke-width="4" stroke-linejoin="round"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r * 0.18)}" fill="${primary}"/>`,
  ];
};

/** Rapido: fulmini a zig-zag con alone e schegge. */
const renderInstant = (scene: Scene): string[] => {
  const { random, primary, secondary, cx, cy } = scene;
  const bolts = intBetween(random, 1, 3);
  const parts: string[] = [];
  for (let b = 0; b < bolts; b += 1) {
    let x = cx + between(random, -120, 120);
    let y = cy - 230;
    const points = [`${fmt(x)},${fmt(y)}`];
    while (y < cy + 170) {
      x += between(random, -55, 55);
      y += between(random, 40, 75);
      points.push(`${fmt(x)},${fmt(y)}`);
    }
    const d = `M${points.join(' L')}`;
    parts.push(
      `<path d="${d}" fill="none" stroke="${primary}" stroke-width="16" opacity="0.25" stroke-linejoin="round"/>`,
      `<path d="${d}" fill="none" stroke="${mixColors(primary, '#ffffff', 0.6)}" stroke-width="${fmt(between(random, 4, 7))}" stroke-linejoin="round"/>`,
    );
  }
  parts.push(...Array.from({ length: intBetween(random, 6, 12) }, () =>
    `<polygon points="${polygonPoints(cx + between(random, -200, 200), cy + between(random, -150, 150), between(random, 6, 16), 3, between(random, 0, 6.3))}" fill="${secondary}" opacity="0.8"/>`));
  return parts;
};

/** Artefatto: ingranaggio con mozzo e gemma dell'affinità. */
const renderArtifact = (scene: Scene): string[] => {
  const { random, primary, secondary, dark, cx, cy } = scene;
  const teeth = intBetween(random, 8, 14);
  const outer = between(random, 120, 150);
  const inner = outer * 0.82;
  const rotation = between(random, 0, Math.PI);
  const path = Array.from({ length: teeth * 4 }, (_, i) => {
    const tooth = Math.floor(i / 4);
    const phase = i % 4;
    const angle = rotation + ((tooth + [0, 0.15, 0.5, 0.65][phase]!) * 2 * Math.PI) / teeth;
    const radius = phase === 1 || phase === 2 ? outer : inner;
    return `${i === 0 ? 'M' : 'L'}${fmt(cx + radius * Math.cos(angle))},${fmt(cy + radius * Math.sin(angle))}`;
  }).join(' ');
  return [
    `<path d="${path} Z" fill="${dark}" stroke="${mixColors(secondary, '#c9a45c', 0.5)}" stroke-width="4" stroke-linejoin="round"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(inner * 0.55)}" fill="none" stroke="#c9a45c" stroke-width="5"/>`,
    `<polygon points="${polygonPoints(cx, cy, inner * 0.3, 6, Math.PI / 6)}" fill="${primary}" stroke="#ffffff" stroke-opacity="0.5" stroke-width="2"/>`,
  ];
};

/** Sigillo generico (soggetto di ripiego, identico allo stile della versione 1). */
const renderSigil = (scene: Scene): string[] => {
  const { random, primary, secondary, cx, cy } = scene;
  const sides = intBetween(random, 3, 8);
  const radius = between(random, 70, 120);
  const rotation = between(random, 0, Math.PI * 2);
  return [
    `<polygon points="${polygonPoints(cx, cy, radius, sides, rotation)}" fill="none" stroke="${primary}" stroke-width="4"/>`,
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(radius * 0.55)}" fill="none" stroke="${secondary}" stroke-width="3"/>`,
    `<polygon points="${polygonPoints(cx, cy, radius * 0.3, sides, -rotation)}" fill="${primary}" opacity="0.6"/>`,
  ];
};

const renderScene = (random: Random, idPrefix: string, input: CardArtInput): string => {
  const identity = input.affinityIdentity;
  const { primary, secondary } = palette(identity);
  const id = (name: string): string => `${idPrefix}-${name}`;
  const { width, height } = ART_SIZE;
  const scene: Scene = {
    random,
    id,
    primary,
    secondary,
    dark: mixColors(secondary, ABYSS, 0.82),
    cx: width / 2 + between(random, -30, 30),
    cy: ART_CROP.y + ART_CROP.height / 2,
  };

  const glow = { x: between(random, 120, 510), y: between(random, 230, 420), r: between(random, 90, 170) };
  const ridges = [0, 1, 2].map((layer) => {
    const fill = mixColors(secondary, ABYSS, 0.55 + layer * 0.15);
    return `<path d="${ridgePath(random, 520 + layer * 110, 60 - layer * 12)}" fill="${fill}"/>`;
  });
  const atmosphere = renderAtmosphere(scene, identity[0]);
  const subject = artSubject(input.typeLine);
  const figure = {
    creature: () => renderCreature(scene, creatureFamily(input.typeLine), hasWings(input)),
    source: () => renderSource(scene),
    ritual: () => renderRitual(scene),
    instant: () => renderInstant(scene),
    artifact: () => renderArtifact(scene),
    sigil: () => renderSigil(scene),
  }[subject]();
  // Le creature e le Fonti poggiano sul terreno: il crinale più vicino va disegnato sopra di loro solo per gli altri soggetti.
  const grounded = subject === 'creature' || subject === 'source';

  return [
    '<defs>',
    `<linearGradient id="${id('sky')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mixColors(primary, ABYSS, 0.78)}"/><stop offset="1" stop-color="${mixColors(secondary, ABYSS, 0.35)}"/></linearGradient>`,
    `<radialGradient id="${id('glow')}"><stop offset="0" stop-color="${primary}" stop-opacity="0.85"/><stop offset="1" stop-color="${primary}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${id('vignette')}" r="0.75"><stop offset="0.55" stop-color="${ABYSS}" stop-opacity="0"/><stop offset="1" stop-color="${ABYSS}" stop-opacity="0.85"/></radialGradient>`,
    '</defs>',
    `<rect width="${width}" height="${height}" fill="url(#${id('sky')})"/>`,
    `<circle cx="${fmt(glow.x)}" cy="${fmt(glow.y)}" r="${fmt(glow.r)}" fill="url(#${id('glow')})"/>`,
    ...atmosphere,
    ...(grounded ? ridges : ridges.slice(0, 2)),
    `<g data-subject="${subject}">${figure.join('')}</g>`,
    ...(grounded ? [] : ridges.slice(2)),
    `<rect width="${width}" height="${height}" fill="url(#${id('vignette')})"/>`,
  ].join('');
};

const wrapSvg = (body: string, viewBox: { x: number; y: number; width: number; height: number }): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" width="${viewBox.width}" height="${viewBox.height}">${body}</svg>`;

/**
 * Genera l'illustrazione di una carta. Funzione pura: nessun testo della carta finisce nell'SVG
 * (solo numeri e colori fissi), quindi l'output non è soggetto a injection.
 *
 * @param input - Seed, identità di affinità, riga del tipo e parole chiave della carta.
 * @returns SVG intero (630×880) e ritaglio 4:3 (630×472) della stessa scena.
 */
export const generateCardArt = (input: CardArtInput): CardArt => {
  const fingerprint = artFingerprint(input);
  const digest = createHash('sha256').update(`${ART_GENERATOR_VERSION}:${input.artSeed}`).digest();
  const body = renderScene(createRandom(digest), `mf${fingerprint}`, input);
  return {
    fingerprint,
    normal: wrapSvg(body, { x: 0, y: 0, ...ART_SIZE }),
    crop: wrapSvg(body, ART_CROP),
  };
};
