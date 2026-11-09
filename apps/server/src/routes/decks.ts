/**
 * @nature [API]
 * @module DeckRoutes
 * @description Rotte REST `/api/decks`: CRUD dei mazzi dell'utente autenticato, validazione delle regole di costruzione e parsing dell'import testuale.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/server/tests/routes/decks.test.ts
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  DECK_FORMATS,
  ParseDeckListRequestSchema,
  SaveDeckRequestSchema,
  describeDeckIssue,
  hasBlockingIssues,
  normalizeCardName,
  parseDeckList,
  resolveDeckList,
  validateDeck,
  type DeckDetail,
  type DeckFormat,
  type DeckListResponse,
  type DeckRuleCard,
  type DeckSummary,
  type ParseDeckListResponse,
  type SaveDeckInput,
} from '@manaforge/shared';
import type { CardRepository } from '../db/card-repository.js';
import type { DeckRecord, DeckRepository } from '../db/deck-repository.js';
import { sendError } from './auth.js';
import type { AuthGuard } from './require-auth.js';

/** Dipendenze delle rotte dei mazzi. */
export interface DeckRoutesDeps {
  readonly cards: CardRepository;
  readonly decks: DeckRepository;
  readonly requireUser: AuthGuard;
}

const DeckParamsSchema = z.object({ id: z.uuid() });

/** Indice del catalogo per id e per nome normalizzato, costruito per richiesta (il catalogo è piccolo e locale). */
const catalogIndex = (cards: CardRepository) => {
  const all = cards.listAll();
  return {
    byId: new Map<string, DeckRuleCard>(all.map((card) => [card.id, card])),
    byName: new Map(all.map((card) => [normalizeCardName(card.name), card.id])),
  };
};

const toFormat = (format: string): DeckFormat => DECK_FORMATS.find((known) => known === format) ?? 'standard';

/**
 * Converte un mazzo letto dal DB nella risposta dettagliata, con l'esito delle regole di costruzione.
 *
 * @param record - Mazzo e righe.
 * @param lookup - Risoluzione delle carte del catalogo.
 * @returns Il {@link DeckDetail}.
 */
export const toDeckDetail = ({ deck, cards }: DeckRecord, lookup: (id: string) => DeckRuleCard | undefined): DeckDetail => ({
  id: deck.id,
  name: deck.name,
  format: toFormat(deck.format),
  coverCardId: deck.coverCardId,
  updatedAt: deck.updatedAt.toISOString(),
  cards,
  validation: validateDeck(cards, lookup),
});

/**
 * Riduce un {@link DeckDetail} al riepilogo dell'elenco.
 *
 * @param detail - Mazzo completo.
 * @returns Il {@link DeckSummary}.
 */
export const toDeckSummary = ({ cards: _cards, validation, ...deck }: DeckDetail): DeckSummary => ({
  ...deck,
  mainCount: validation.mainCount,
  sideboardCount: validation.sideboardCount,
  isValid: validation.isValid,
});

/**
 * Registra le rotte dei mazzi. Ogni rotta richiede una sessione valida; un mazzo di un altro utente
 * risponde 404 (non 403) per non rivelarne l'esistenza.
 *
 * @param app - Istanza Fastify.
 * @param deps - Repository e guardia di autenticazione.
 */
export const registerDeckRoutes = async (app: FastifyInstance, { cards, decks, requireUser }: DeckRoutesDeps): Promise<void> => {
  /** Valida il corpo e le regole bloccanti; restituisce l'input pronto o invia l'errore. */
  const readDeckBody = (body: unknown, index: ReturnType<typeof catalogIndex>):
    | { ok: true; input: SaveDeckInput }
    | { ok: false; status: 400 | 422; code: 'VALIDATION_ERROR' | 'DECK_INVALID'; message: string } => {
    const parsed = SaveDeckRequestSchema.safeParse(body);
    if (!parsed.success) return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: z.prettifyError(parsed.error) };
    const lookup = (id: string) => index.byId.get(id);
    const validation = validateDeck(parsed.data.cards, lookup);
    if (hasBlockingIssues(validation)) {
      const message = validation.issues.filter((issue) => issue.code !== 'MAIN_TOO_SMALL').map(describeDeckIssue).join(' ');
      return { ok: false, status: 422, code: 'DECK_INVALID', message };
    }
    if (parsed.data.coverCardId !== null && !index.byId.has(parsed.data.coverCardId)) {
      return { ok: false, status: 422, code: 'DECK_INVALID', message: `Carta di copertina sconosciuta: ${parsed.data.coverCardId}.` };
    }
    return { ok: true, input: parsed.data };
  };

  app.get('/api/decks', async (request, reply) => {
    const userId = await requireUser(request);
    if (!userId) return sendError(reply, 401, 'UNAUTHORIZED');
    const index = catalogIndex(cards);
    const lookup = (id: string) => index.byId.get(id);
    const list = decks.listByUser(userId).map((record) => toDeckSummary(toDeckDetail(record, lookup)));
    return reply.send({ decks: list } satisfies DeckListResponse);
  });

  app.post('/api/decks', async (request, reply) => {
    const userId = await requireUser(request);
    if (!userId) return sendError(reply, 401, 'UNAUTHORIZED');
    const index = catalogIndex(cards);
    const body = readDeckBody(request.body, index);
    if (!body.ok) return sendError(reply, body.status, body.code, body.message);
    const record = decks.create(userId, body.input);
    return reply.code(201).send(toDeckDetail(record, (id) => index.byId.get(id)));
  });

  app.post('/api/decks/parse', async (request, reply) => {
    if (!(await requireUser(request))) return sendError(reply, 401, 'UNAUTHORIZED');
    const body = ParseDeckListRequestSchema.safeParse(request.body);
    if (!body.success) return sendError(reply, 400, 'VALIDATION_ERROR', z.prettifyError(body.error));
    const index = catalogIndex(cards);
    const result = resolveDeckList(parseDeckList(body.data.text), (name) => index.byName.get(name));
    return reply.send(result satisfies ParseDeckListResponse);
  });

  app.get('/api/decks/:id', async (request, reply) => {
    const userId = await requireUser(request);
    if (!userId) return sendError(reply, 401, 'UNAUTHORIZED');
    const params = DeckParamsSchema.safeParse(request.params);
    const record = params.success ? decks.findOwned(params.data.id, userId) : undefined;
    if (!record) return sendError(reply, 404, 'NOT_FOUND');
    const index = catalogIndex(cards);
    return reply.send(toDeckDetail(record, (id) => index.byId.get(id)));
  });

  app.put('/api/decks/:id', async (request, reply) => {
    const userId = await requireUser(request);
    if (!userId) return sendError(reply, 401, 'UNAUTHORIZED');
    const params = DeckParamsSchema.safeParse(request.params);
    if (!params.success) return sendError(reply, 404, 'NOT_FOUND');
    const index = catalogIndex(cards);
    const body = readDeckBody(request.body, index);
    if (!body.ok) return sendError(reply, body.status, body.code, body.message);
    const record = decks.update(params.data.id, userId, body.input);
    if (!record) return sendError(reply, 404, 'NOT_FOUND');
    return reply.send(toDeckDetail(record, (id) => index.byId.get(id)));
  });

  app.delete('/api/decks/:id', async (request, reply) => {
    const userId = await requireUser(request);
    if (!userId) return sendError(reply, 401, 'UNAUTHORIZED');
    const params = DeckParamsSchema.safeParse(request.params);
    if (!params.success || !decks.remove(params.data.id, userId)) return sendError(reply, 404, 'NOT_FOUND');
    return reply.code(204).send();
  });
};
