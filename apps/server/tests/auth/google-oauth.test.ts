/**
 * @nature [TEST]
 * @module GoogleOAuthTest
 * @description Verifica URL di autorizzazione PKCE, validazione dello state, scambio del codice e errori di Google (fetch simulato).
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/auth/google-oauth.test.ts
 */
import { describe, expect, it } from 'vitest';
import { OAUTH_FLOW_TTL_MS, createGoogleOAuth, pkceChallenge } from '../../src/auth/google-oauth.js';
import { createFakeGoogleFetch } from '../helpers/test-context.js';

const config = { clientId: 'client-123', clientSecret: 'desktop-secret', redirectUri: 'http://127.0.0.1:47821/api/auth/google/callback' };
const googleUser = { sub: 'g-1', email: 'gio@example.com', email_verified: true, name: 'Gio' };

describe('pkceChallenge', () => {
  it('calcola il vettore di esempio dell\'RFC 7636', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('createGoogleOAuth', () => {
  it('start genera un URL PKCE S256 con state univoco', () => {
    const google = createGoogleOAuth({ config, fetch: createFakeGoogleFetch(googleUser).fetch });
    const a = google.start();
    const b = google.start();
    const url = new URL(a.authUrl);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'client-123',
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: a.state,
      code_challenge_method: 'S256',
    });
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.state).not.toBe(b.state);
    expect(google.isPending(a.state)).toBe(true);
  });

  it('complete scambia il codice con verifier e secret e restituisce il profilo', async () => {
    const fake = createFakeGoogleFetch(googleUser);
    const google = createGoogleOAuth({ config, fetch: fake.fetch });
    const { authUrl, state } = google.start();
    const result = await google.complete({ state, code: 'auth-code' });

    expect(result).toEqual({ ok: true, value: { state, profile: { sub: 'g-1', email: 'gio@example.com', emailVerified: true, name: 'Gio' } } });
    const tokenBody = new URLSearchParams(fake.requests[0]?.body);
    expect(tokenBody.get('code')).toBe('auth-code');
    expect(tokenBody.get('client_secret')).toBe('desktop-secret');
    expect(tokenBody.get('grant_type')).toBe('authorization_code');
    expect(pkceChallenge(tokenBody.get('code_verifier') ?? '')).toBe(new URL(authUrl).searchParams.get('code_challenge'));
    expect(fake.requests[1]?.authorization).toBe('Bearer google-access-token');
    // lo state è a uso singolo
    expect(google.isPending(state)).toBe(false);
    expect(await google.complete({ state, code: 'auth-code' })).toEqual({ ok: false, error: 'GOOGLE_STATE_INVALID' });
  });

  it('omette client_secret se non configurato e considera non verificata un\'email senza flag', async () => {
    const fake = createFakeGoogleFetch({ sub: 'g-2', email: 'x@y.it' });
    const google = createGoogleOAuth({ config: { clientId: 'c', redirectUri: config.redirectUri }, fetch: fake.fetch });
    const { state } = google.start();
    const result = await google.complete({ state, code: 'c' });
    expect(new URLSearchParams(fake.requests[0]?.body).has('client_secret')).toBe(false);
    expect(result.ok && result.value.profile.emailVerified).toBe(false);
  });

  it('rifiuta state assente, sconosciuto o scaduto', async () => {
    let now = 0;
    const google = createGoogleOAuth({ config, fetch: createFakeGoogleFetch(googleUser).fetch, now: () => now });
    expect(await google.complete({ code: 'c' })).toEqual({ ok: false, error: 'GOOGLE_STATE_INVALID' });
    expect(await google.complete({ state: 'inventato', code: 'c' })).toEqual({ ok: false, error: 'GOOGLE_STATE_INVALID' });
    const { state } = google.start();
    now = OAUTH_FLOW_TTL_MS;
    expect(await google.complete({ state, code: 'c' })).toEqual({ ok: false, error: 'GOOGLE_STATE_INVALID' });
  });

  it('segnala l\'annullamento da parte dell\'utente', async () => {
    const google = createGoogleOAuth({ config, fetch: createFakeGoogleFetch(googleUser).fetch });
    expect(await google.complete({ state: google.start().state, error: 'access_denied' })).toEqual({ ok: false, error: 'GOOGLE_DENIED' });
    expect(await google.complete({ state: google.start().state })).toEqual({ ok: false, error: 'GOOGLE_DENIED' });
  });

  it.each<[string, typeof globalThis.fetch]>([
    ['codice rifiutato', createFakeGoogleFetch(undefined).fetch],
    ['token senza access_token', async () => Response.json({})],
    ['userinfo in errore', async (input) => (String(input).includes('/token') ? Response.json({ access_token: 't' }) : new Response('', { status: 500 }))],
    ['userinfo malformato', async (input) => (String(input).includes('/token') ? Response.json({ access_token: 't' }) : Response.json({ sub: 'x' }))],
    ['errore di rete', async () => { throw new TypeError('fetch failed'); }],
  ])('restituisce GOOGLE_EXCHANGE_FAILED se %s', async (_case, fetch) => {
    const google = createGoogleOAuth({ config, fetch });
    expect(await google.complete({ state: google.start().state, code: 'c' })).toEqual({ ok: false, error: 'GOOGLE_EXCHANGE_FAILED' });
  });
});
