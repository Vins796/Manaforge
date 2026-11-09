/**
 * @nature [API]
 * @module CardRoutes
 * @description Rotte REST del catalogo: `GET /api/cards` (protetta) e `GET /api/cards/:id/image/:variant` (SVG dalla cache su disco, generato on-demand).
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/server/tests/routes/cards.test.ts
 */
import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CardIdSchema, type CardListResponse, type CardView } from '@manaforge/shared';
import { IMAGE_VARIANTS, type ImageCache } from '../catalog/image-cache.js';
import type { CardRepository } from '../db/card-repository.js';
import type { Card } from '../db/db-schema.js';
import { sendError } from './auth.js';
import type { AuthGuard } from './require-auth.js';

/** Durata della cache HTTP delle immagini: il contenuto cambia solo con il catalogo. */
export const IMAGE_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Header di sicurezza per gli SVG serviti: nessuno script né risorsa esterna anche se aperti direttamente. */
const SVG_HEADERS = {
  'content-type': 'image/svg+xml; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
  'cache-control': `public, max-age=${IMAGE_MAX_AGE_SECONDS}`,
} as const;

/** Dipendenze delle rotte del catalogo. */
export interface CardRoutesDeps {
  readonly cards: CardRepository;
  readonly imageCache: ImageCache;
  readonly requireUser: AuthGuard;
}

const ImageParamsSchema = z.object({ id: CardIdSchema, variant: z.enum(IMAGE_VARIANTS) });

/**
 * Converte una riga `cards` nella rappresentazione pubblica (senza percorsi locali né versione).
 *
 * @param card - Riga del DB.
 * @returns La {@link CardView}.
 */
export const toCardView = (card: Card): CardView => ({
  id: card.id,
  name: card.name,
  cost: card.cost,
  manaValue: card.manaValue,
  typeLine: card.typeLine,
  rulesText: card.rulesText,
  affinities: card.affinities,
  affinityIdentity: card.affinityIdentity,
  power: card.power,
  toughness: card.toughness,
  keywords: card.keywords,
  rarity: card.rarity,
});

/**
 * Registra le rotte del catalogo carte.
 *
 * @param app - Istanza Fastify.
 * @param deps - Repository carte, cache immagini e guardia di autenticazione.
 */
export const registerCardRoutes = async (app: FastifyInstance, { cards, imageCache, requireUser }: CardRoutesDeps): Promise<void> => {
  app.get('/api/cards', async (request, reply) => {
    if (!(await requireUser(request))) return sendError(reply, 401, 'UNAUTHORIZED');
    return reply.send({ cards: cards.listAll().map(toCardView) } satisfies CardListResponse);
  });

  // Pubblica: un <img> non può inviare il Bearer token e le illustrazioni non contengono dati personali.
  app.get('/api/cards/:id/image/:variant', async (request, reply) => {
    const params = ImageParamsSchema.safeParse(request.params);
    if (!params.success) return sendError(reply, 404, 'NOT_FOUND');
    const images = imageCache.ensureCardImages(params.data.id);
    if (!images.ok) {
      if (images.error.code === 'CARD_NOT_FOUND') return sendError(reply, 404, 'NOT_FOUND');
      request.log.error(images.error, 'Generazione illustrazione fallita');
      return sendError(reply, 500, 'INTERNAL_ERROR');
    }
    const path = params.data.variant === 'normal' ? images.value.normalPath : images.value.cropPath;
    return reply.headers(SVG_HEADERS).send(await readFile(path, 'utf8'));
  });
};
