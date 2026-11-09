/**
 * @nature [TEST]
 * @module ApiClientTest
 * @description Verifica richieste, validazione delle risposte e mappatura degli errori del client REST.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/services/api-client.test.ts
 */
import { describe, expect, it, vi } from 'vitest';
import { createApiClient, DEFAULT_API_BASE_URL } from '../../src/services/api-client.js';
import { AUTH, CARDS, deckDetail } from '../helpers/fake-api.js';

const fetchReturning = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => (typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status })));

describe('createApiClient', () => {
  it('invia login come JSON e valida la risposta', async () => {
    const fetch = fetchReturning(AUTH);
    const api = createApiClient({ baseUrl: 'http://api.test', fetch });
    expect(await api.login({ email: 'a@b.it', password: 'x' })).toEqual({ ok: true, value: AUTH });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/api/auth/login');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'a@b.it', password: 'x' });
  });

  it('usa gli endpoint corretti per register, me, googleStart e googleResult', async () => {
    const fetch = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/me')) return Response.json(AUTH.user);
      if (url.endsWith('/google/start')) return Response.json({ authUrl: 'https://accounts.google.com/x', state: 's' });
      if (url.includes('/google/result')) return Response.json({ status: 'pending' });
      return Response.json(AUTH, { status: 201 });
    });
    const api = createApiClient({ fetch });
    expect((await api.register({ email: 'a@b.it', username: 'Ada', password: 'password1' })).ok).toBe(true);
    expect(await api.me('tok')).toEqual({ ok: true, value: AUTH.user });
    expect((await api.googleStart()).ok).toBe(true);
    expect(await api.googleResult('a b')).toEqual({ ok: true, value: { status: 'pending' } });
    expect(fetch.mock.calls.map(([u]) => String(u))).toEqual([
      `${DEFAULT_API_BASE_URL}/api/auth/register`,
      `${DEFAULT_API_BASE_URL}/api/auth/me`,
      `${DEFAULT_API_BASE_URL}/api/auth/google/start`,
      `${DEFAULT_API_BASE_URL}/api/auth/google/result?state=a%20b`,
    ]);
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get('authorization')).toBe('Bearer tok');
  });

  it('propaga gli errori standard del server con lo status HTTP', async () => {
    const api = createApiClient({ fetch: fetchReturning({ error: { code: 'INVALID_CREDENTIALS', message: 'No' } }, 401) });
    expect(await api.login({ email: 'a@b.it', password: 'x' })).toEqual({
      ok: false,
      error: { status: 401, code: 'INVALID_CREDENTIALS', message: 'No' },
    });
  });

  it('gestisce errori non standard, risposte invalide e assenza di rete', async () => {
    expect((await createApiClient({ fetch: fetchReturning('<html>', 502) }).me('t')).ok ? null : 'HTTP_ERROR').toBe('HTTP_ERROR');
    const invalid = await createApiClient({ fetch: fetchReturning({ token: 1 }) }).login({ email: 'a@b.it', password: 'x' });
    expect(invalid).toMatchObject({ ok: false, error: { code: 'INVALID_RESPONSE' } });
    const offline = await createApiClient({ fetch: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) }).me('t');
    expect(offline).toMatchObject({ ok: false, error: { status: 0, code: 'NETWORK_ERROR' } });
  });

  it('chiama le rotte di carte e mazzi con il Bearer token, metodo e corpo corretti', async () => {
    const detail = deckDetail();
    const fetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      if (url.endsWith('/api/cards')) return Response.json({ cards: CARDS });
      if (url.endsWith('/api/decks') && init?.method === 'GET') return Response.json({ decks: [] });
      if (url.endsWith('/api/decks/parse')) return Response.json({ entries: [], issues: [] });
      return Response.json(detail);
    });
    const api = createApiClient({ baseUrl: 'http://api.test', fetch });
    const body = { name: 'X', cards: [] };
    expect(await api.listCards('tok')).toEqual({ ok: true, value: { cards: CARDS } });
    expect(await api.listDecks('tok')).toEqual({ ok: true, value: { decks: [] } });
    expect(await api.getDeck('tok', 'a/b')).toEqual({ ok: true, value: detail });
    expect((await api.createDeck('tok', body)).ok).toBe(true);
    expect((await api.updateDeck('tok', 'id1', body)).ok).toBe(true);
    expect(await api.deleteDeck('tok', 'id1')).toEqual({ ok: true, value: undefined });
    expect(await api.parseDeckList('tok', '4 X')).toEqual({ ok: true, value: { entries: [], issues: [] } });

    const calls = fetch.mock.calls.map(([url, init]) => [String(url), init?.method, init?.body === undefined ? undefined : JSON.parse(String(init.body))]);
    expect(calls).toEqual([
      ['http://api.test/api/cards', 'GET', undefined],
      ['http://api.test/api/decks', 'GET', undefined],
      ['http://api.test/api/decks/a%2Fb', 'GET', undefined],
      ['http://api.test/api/decks', 'POST', body],
      ['http://api.test/api/decks/id1', 'PUT', body],
      ['http://api.test/api/decks/id1', 'DELETE', undefined],
      ['http://api.test/api/decks/parse', 'POST', { text: '4 X' }],
    ]);
    for (const [, init] of fetch.mock.calls) expect(new Headers(init?.headers).get('authorization')).toBe('Bearer tok');
    expect(new Headers(fetch.mock.calls[3]?.[1]?.headers).get('content-type')).toBe('application/json');
    expect(api.cardImageUrl('MF1-001', 'crop')).toBe('http://api.test/api/cards/MF1-001/image/crop');
  });
});
