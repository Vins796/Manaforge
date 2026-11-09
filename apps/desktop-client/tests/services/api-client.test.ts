/**
 * @nature [TEST]
 * @module ApiClientTest
 * @description Verifica richieste, validazione delle risposte e mappatura degli errori del client REST.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/services/api-client.test.ts
 */
import { describe, expect, it, vi } from 'vitest';
import { createApiClient, DEFAULT_API_BASE_URL } from '../../src/services/api-client.js';
import { AUTH } from '../helpers/fake-api.js';

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
});
