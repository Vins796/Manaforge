/**
 * @nature [TEST]
 * @module DeckRoutesTest
 * @description Test API dei mazzi: CRUD con proprietà per utente, regole di costruzione (bloccanti vs incompleto) e parsing dell'import testuale.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/server/tests/routes/decks.test.ts
 */
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DeckDetailSchema,
  DeckListResponseSchema,
  ParseDeckListResponseSchema,
  unwrap,
  type SaveDeckRequest,
} from '@manaforge/shared';
import { buildApp } from '../../src/app.js';
import { syncCatalog } from '../../src/catalog/catalog-sync.js';
import { loadTestCatalog } from '../helpers/catalog-fixtures.js';
import { appDeps, createTestContext, type TestContext } from '../helpers/test-context.js';

/** Mazzo valido: 56 Fonti base + 4 Drago = 60, riserva 3. */
const VALID_DECK: SaveDeckRequest = {
  name: 'Drago e Fonti',
  cards: [
    { cardId: 'TS1-001', quantity: 56, board: 'main' },
    { cardId: 'TS1-002', quantity: 4, board: 'main' },
    { cardId: 'TS1-003', quantity: 3, board: 'sideboard' },
  ],
};

describe('rotte /api/decks', () => {
  let ctx: TestContext;
  let app: FastifyInstance;
  let adaAuth: { authorization: string };
  let brunoAuth: { authorization: string };

  beforeEach(async () => {
    ctx = createTestContext();
    unwrap(syncCatalog(ctx.conn.db, loadTestCatalog()));
    app = await buildApp({ ...appDeps(ctx), google: null, allowedOrigins: [] });
    const bearer = async (email: string) => {
      const user = ctx.users.insert({ email, username: email.split('@')[0] ?? 'x' });
      return { authorization: `Bearer ${(await ctx.tokens.issue(user.id)).token}` };
    };
    adaAuth = await bearer('ada@example.com');
    brunoAuth = await bearer('bruno@example.com');
  });

  afterEach(async () => {
    await app.close();
    ctx.conn.close();
  });

  const create = (body: unknown, headers = adaAuth) => app.inject({ method: 'POST', url: '/api/decks', headers, payload: body as object });

  it('tutte le rotte richiedono la sessione (401)', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const calls = [
      app.inject({ method: 'GET', url: '/api/decks' }),
      app.inject({ method: 'POST', url: '/api/decks', payload: VALID_DECK }),
      app.inject({ method: 'POST', url: '/api/decks/parse', payload: { text: '' } }),
      app.inject({ method: 'GET', url: `/api/decks/${id}` }),
      app.inject({ method: 'PUT', url: `/api/decks/${id}`, payload: VALID_DECK }),
      app.inject({ method: 'DELETE', url: `/api/decks/${id}` }),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHORIZED');
    }
  });

  it('POST crea un mazzo valido (201) e GET lo rilegge', async () => {
    const res = await create({ ...VALID_DECK, coverCardId: 'TS1-002' });
    expect(res.statusCode).toBe(201);
    const deck = DeckDetailSchema.parse(res.json());
    expect(deck).toMatchObject({ name: 'Drago e Fonti', format: 'standard', coverCardId: 'TS1-002' });
    expect(deck.validation).toEqual({ isValid: true, mainCount: 60, sideboardCount: 3, issues: [] });

    const read = await app.inject({ method: 'GET', url: `/api/decks/${deck.id}`, headers: adaAuth });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual(deck);
  });

  it('salva un mazzo incompleto (meno di 60 carte) segnalandolo', async () => {
    const res = await create({ name: 'Bozza', cards: [{ cardId: 'TS1-002', quantity: 2, board: 'main' }] });
    expect(res.statusCode).toBe(201);
    expect(DeckDetailSchema.parse(res.json()).validation).toMatchObject({ isValid: false, issues: [{ code: 'MAIN_TOO_SMALL', count: 2 }] });
  });

  it('rifiuta con 422 le violazioni bloccanti: 5 copie, riserva oltre 15, carte o copertina sconosciute', async () => {
    const fiveCopies = await create({ name: 'X', cards: [{ cardId: 'TS1-002', quantity: 4, board: 'main' }, { cardId: 'TS1-002', quantity: 1, board: 'sideboard' }] });
    expect(fiveCopies.statusCode).toBe(422);
    expect(fiveCopies.json().error).toEqual({ code: 'DECK_INVALID', message: 'Drago di Prova: 5 copie, al massimo 4.' });

    const bigSideboard = await create({ name: 'X', cards: [{ cardId: 'TS1-001', quantity: 16, board: 'sideboard' }] });
    expect(bigSideboard.statusCode).toBe(422);
    expect(bigSideboard.json().error.message).toBe('La riserva ha 16 carte: al massimo 15.');

    const unknown = await create({ name: 'X', cards: [{ cardId: 'XX1-001', quantity: 1, board: 'main' }] });
    expect(unknown.statusCode).toBe(422);
    expect(unknown.json().error.message).toBe('Carta sconosciuta: XX1-001.');

    const cover = await create({ ...VALID_DECK, coverCardId: 'XX1-001' });
    expect(cover.statusCode).toBe(422);
    expect(cover.json().error.message).toBe('Carta di copertina sconosciuta: XX1-001.');

    const list = await app.inject({ method: 'GET', url: '/api/decks', headers: adaAuth });
    expect(list.json()).toEqual({ decks: [] });
  });

  it('rifiuta con 400 i corpi malformati', async () => {
    const res = await create({ name: '', cards: 'tutte' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/decks elenca solo i mazzi dell\'utente con i conteggi', async () => {
    await create(VALID_DECK);
    await create({ name: 'Di Bruno', cards: [] }, brunoAuth);
    const res = await app.inject({ method: 'GET', url: '/api/decks', headers: adaAuth });
    const { decks } = DeckListResponseSchema.parse(res.json());
    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({ name: 'Drago e Fonti', mainCount: 60, sideboardCount: 3, isValid: true });
    expect(decks[0]).not.toHaveProperty('cards');
  });

  it('PUT aggiorna il mazzo; DELETE lo elimina (204)', async () => {
    const { id } = DeckDetailSchema.parse((await create(VALID_DECK)).json());
    const put = await app.inject({ method: 'PUT', url: `/api/decks/${id}`, headers: adaAuth, payload: { name: 'Rinominato', cards: [] } });
    expect(put.statusCode).toBe(200);
    expect(DeckDetailSchema.parse(put.json())).toMatchObject({ id, name: 'Rinominato', cards: [] });

    const badPut = await app.inject({ method: 'PUT', url: `/api/decks/${id}`, headers: adaAuth, payload: { name: 'X', cards: [{ cardId: 'TS1-003', quantity: 5, board: 'main' }] } });
    expect(badPut.statusCode).toBe(422);

    const del = await app.inject({ method: 'DELETE', url: `/api/decks/${id}`, headers: adaAuth });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/api/decks/${id}`, headers: adaAuth })).statusCode).toBe(404);
  });

  it('un mazzo altrui o un id malformato risponde 404 su GET, PUT e DELETE', async () => {
    const { id } = DeckDetailSchema.parse((await create(VALID_DECK)).json());
    for (const url of [`/api/decks/${id}`, '/api/decks/non-un-uuid']) {
      const get = await app.inject({ method: 'GET', url, headers: brunoAuth });
      const put = await app.inject({ method: 'PUT', url, headers: brunoAuth, payload: VALID_DECK });
      const del = await app.inject({ method: 'DELETE', url, headers: brunoAuth });
      expect([get.statusCode, put.statusCode, del.statusCode], url).toEqual([404, 404, 404]);
    }
    expect((await app.inject({ method: 'GET', url: `/api/decks/${id}`, headers: adaAuth })).json().name).toBe('Drago e Fonti');
  });

  it('POST /api/decks/parse risolve i nomi del catalogo e segnala righe e nomi non validi', async () => {
    const text = 'Mazzo\n4 drago di prova\n20 Fonte di Prova\nboh\n2 Carta Inventata\n\nRiserva\n2 Lampo di Prova';
    const res = await app.inject({ method: 'POST', url: '/api/decks/parse', headers: adaAuth, payload: { text } });
    expect(res.statusCode).toBe(200);
    expect(ParseDeckListResponseSchema.parse(res.json())).toEqual({
      entries: [
        { cardId: 'TS1-002', quantity: 4, board: 'main' },
        { cardId: 'TS1-001', quantity: 20, board: 'main' },
        { cardId: 'TS1-003', quantity: 2, board: 'sideboard' },
      ],
      issues: [
        { code: 'INVALID_LINE', line: 4, text: 'boh' },
        { code: 'UNKNOWN_CARD', line: 5, text: 'Carta Inventata' },
      ],
    });

    const bad = await app.inject({ method: 'POST', url: '/api/decks/parse', headers: adaAuth, payload: { text: 42 } });
    expect(bad.statusCode).toBe(400);
  });
});
