/**
 * @nature [API]
 * @module App
 * @description Costruzione dell'istanza Fastify: CORS, rate limit, gestione errori uniforme e rotte (auth, carte, mazzi).
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/app.test.ts
 */
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ImageCache } from './catalog/image-cache.js';
import type { CardRepository } from './db/card-repository.js';
import type { DeckRepository } from './db/deck-repository.js';
import { registerAuthRoutes, sendError, type AuthRoutesDeps } from './routes/auth.js';
import { registerCardRoutes } from './routes/cards.js';
import { registerDeckRoutes } from './routes/decks.js';
import { createAuthGuard } from './routes/require-auth.js';

/** Dimensione massima del corpo delle richieste (64 KiB: basta per un mazzo o una lista testuale completa). */
export const BODY_LIMIT_BYTES = 64 * 1024;

/** Dipendenze di {@link buildApp}. */
export interface AppDeps extends AuthRoutesDeps {
  readonly cards: CardRepository;
  readonly decks: DeckRepository;
  readonly imageCache: ImageCache;
  readonly allowedOrigins: readonly string[];
  readonly logger?: boolean;
}

/**
 * Crea l'applicazione Fastify senza metterla in ascolto (testabile con `app.inject`).
 *
 * @param deps - Servizi e configurazione.
 * @returns L'istanza pronta (`ready()` già atteso).
 */
export const buildApp = async ({ allowedOrigins, logger = false, cards, decks, imageCache, ...authDeps }: AppDeps): Promise<FastifyInstance> => {
  const app = Fastify({ logger, bodyLimit: BODY_LIMIT_BYTES });

  await app.register(cors, {
    origin: [...allowedOrigins],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization'],
  });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      error: { code: 'RATE_LIMITED', message: 'Troppi tentativi, riprova tra poco.' },
    }),
  });

  app.setErrorHandler((error, request, reply) => {
    const status = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;
    if (status === 429) return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Troppi tentativi, riprova tra poco.' } });
    if (status >= 400 && status < 500) return sendError(reply, status, 'VALIDATION_ERROR');
    request.log.error(error);
    return sendError(reply, 500, 'INTERNAL_ERROR');
  });
  app.setNotFoundHandler((_request, reply) => sendError(reply, 404, 'NOT_FOUND'));

  const requireUser = createAuthGuard(authDeps);
  await registerAuthRoutes(app, authDeps);
  await registerCardRoutes(app, { cards, imageCache, requireUser });
  await registerDeckRoutes(app, { cards, decks, requireUser });
  await app.ready();
  return app;
};
