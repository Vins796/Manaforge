/**
 * @nature [DATA]
 * @module ImageCache
 * @description Cache su disco delle illustrazioni procedurali (`~/.manaforge/cache/images`), generate on-demand e registrate in `cards`.
 * @relatedDocs docs/catalog/DATA/02-card-catalog-and-image-cache.md
 * @testFile apps/server/tests/catalog/image-cache.test.ts
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { CardIdSchema, err, ok, type Result } from '@manaforge/shared';
import type { CardImagePaths, CardRepository } from '../db/card-repository.js';
import { artFingerprint, generateCardArt } from './art-generator.js';

/** Varianti di immagine salvate per ogni carta. */
export const IMAGE_VARIANTS = ['normal', 'crop'] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

/** Errore della cache immagini. */
export type ImageCacheError =
  | { readonly code: 'CARD_NOT_FOUND'; readonly cardId: string }
  | { readonly code: 'IMAGE_WRITE_FAILED'; readonly message: string };

/** Cache delle illustrazioni. */
export interface ImageCache {
  /**
   * Restituisce i percorsi delle immagini della carta, generandole e salvandole solo se mancano o sono obsolete.
   *
   * @param cardId - Id della carta.
   */
  ensureCardImages(cardId: string): Result<CardImagePaths, ImageCacheError>;
}

/** Dipendenze di {@link createImageCache}. */
export interface ImageCacheDeps {
  readonly cards: CardRepository;
  /** Cartella assoluta della cache (da `resolveDataPaths().imageCacheDir`). */
  readonly cacheDir: string;
}

/**
 * Nome del file di una variante. L'impronta nel nome rende la cache auto-invalidante:
 * se cambiano seed, identità o algoritmo, il nome cambia e l'immagine viene rigenerata.
 *
 * @param cardId - Id carta validato (formato `MF1-042`, sicuro come nome file).
 * @param fingerprint - Impronta dell'illustrazione.
 * @param variant - Variante.
 * @returns Il nome del file `.svg`.
 */
export const imageFileName = (cardId: string, fingerprint: string, variant: ImageVariant): string =>
  `${cardId}-${fingerprint}-${variant}.svg`;

/** `true` solo se `path` è un file regolare (una cartella omonima non vale come cache valida). */
const isFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

/** Scrittura atomica: file temporaneo nella stessa cartella + rename, così un crash non lascia SVG troncati. */
const writeAtomic = (path: string, content: string): void => {
  const tmp = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o644 });
    renameSync(tmp, path);
  } catch (cause) {
    rmSync(tmp, { force: true });
    throw cause;
  }
};

/**
 * Crea la cache delle illustrazioni.
 *
 * @param deps - Repository carte e cartella di cache.
 * @returns L'{@link ImageCache}.
 * @throws Error se `cacheDir` non è un percorso assoluto (errore di configurazione).
 */
export const createImageCache = ({ cards, cacheDir }: ImageCacheDeps): ImageCache => {
  if (!isAbsolute(cacheDir)) throw new Error(`cacheDir deve essere assoluta: ${cacheDir}`);

  return {
    ensureCardImages: (cardId) => {
      const card = CardIdSchema.safeParse(cardId).success ? cards.findById(cardId) : undefined;
      if (!card) return err({ code: 'CARD_NOT_FOUND', cardId });

      const input = { artSeed: card.artSeed, affinityIdentity: card.affinityIdentity, typeLine: card.typeLine, keywords: card.keywords };
      const fingerprint = artFingerprint(input);
      const expected: CardImagePaths = {
        normalPath: join(cacheDir, imageFileName(card.id, fingerprint, 'normal')),
        cropPath: join(cacheDir, imageFileName(card.id, fingerprint, 'crop')),
      };

      const recorded = card.localImageNormalPath === expected.normalPath && card.localImageCropPath === expected.cropPath;
      if (recorded && isFile(expected.normalPath) && isFile(expected.cropPath)) return ok(expected);

      try {
        const art = generateCardArt(input);
        mkdirSync(cacheDir, { recursive: true });
        writeAtomic(expected.normalPath, art.normal);
        writeAtomic(expected.cropPath, art.crop);
        cards.setImagePaths(card.id, expected);
      } catch (cause) {
        return err({ code: 'IMAGE_WRITE_FAILED', message: cause instanceof Error ? cause.message : String(cause) });
      }
      return ok(expected);
    },
  };
};
