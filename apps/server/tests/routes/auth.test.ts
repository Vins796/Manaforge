/**
 * @nature [TEST]
 * @module AuthRoutesTest
 * @description Test API delle rotte di autenticazione: registrazione, login valido, password errata (401), sessione e callback Google simulata.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/routes/auth.test.ts
 */
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthResponseSchema, GoogleResultResponseSchema, type AuthResponse } from '@manaforge/shared';
import { buildApp } from '../../src/app.js';
import { createGoogleOAuth } from '../../src/auth/google-oauth.js';
import { AUTH_RATE_LIMIT_PER_MINUTE } from '../../src/routes/auth.js';
import { createFakeGoogleFetch, createTestContext, type FakeGoogleUser, type TestContext } from '../helpers/test-context.js';

const ORIGIN = 'http://localhost:5173';
const credentials = { email: 'ada@example.com', username: 'Ada', password: 'password-sicura' };
const googleUser: FakeGoogleUser = { sub: 'g-1', email: 'gio@example.com', email_verified: true, name: 'Gio' };

describe('rotte /api/auth', () => {
  let ctx: TestContext;
  let app: FastifyInstance;

  const setup = async (options: { google?: FakeGoogleUser | undefined | null } = {}) => {
    ctx = createTestContext();
    const google =
      options.google === null
        ? null
        : createGoogleOAuth({
            config: { clientId: 'cid', redirectUri: 'http://127.0.0.1:47821/api/auth/google/callback' },
            fetch: createFakeGoogleFetch('google' in options ? options.google : googleUser).fetch,
          });
    app = await buildApp({ auth: ctx.auth, tokens: ctx.tokens, google, allowedOrigins: [ORIGIN] });
  };

  afterEach(async () => {
    await app.close();
    ctx.conn.close();
  });

  const register = (body: unknown = credentials) => app.inject({ method: 'POST', url: '/api/auth/register', payload: body as object });
  const login = (body: unknown) => app.inject({ method: 'POST', url: '/api/auth/login', payload: body as object });

  describe('registrazione e login manuale', () => {
    beforeEach(() => setup());

    it('POST /register crea l\'utente (201) e restituisce un AuthResponse valido', async () => {
      const res = await register({ ...credentials, email: ' ADA@example.com ' });
      expect(res.statusCode).toBe(201);
      const body = AuthResponseSchema.parse(res.json());
      expect(body.user.email).toBe('ada@example.com');
      expect(JSON.stringify(body)).not.toContain('argon2');
    });

    it('POST /register: 409 per email duplicata, 400 per dati non validi', async () => {
      await register();
      const dup = await register();
      expect(dup.statusCode).toBe(409);
      expect(dup.json()).toMatchObject({ error: { code: 'EMAIL_TAKEN' } });

      const bad = await register({ email: 'x', username: 'A', password: '1' });
      expect(bad.statusCode).toBe(400);
      expect(bad.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /login con credenziali valide restituisce 200 e un token utilizzabile su /me', async () => {
      await register();
      const res = await login({ email: credentials.email, password: credentials.password });
      expect(res.statusCode).toBe(200);
      const { token, user } = AuthResponseSchema.parse(res.json());

      const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${token}` } });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual(user);
    });

    it('POST /login con password errata restituisce 401 senza rivelare se l\'email esiste', async () => {
      await register();
      const wrong = await login({ email: credentials.email, password: 'sbagliata!' });
      const unknown = await login({ email: 'nessuno@example.com', password: 'sbagliata!' });
      expect(wrong.statusCode).toBe(401);
      expect(unknown.statusCode).toBe(401);
      expect(wrong.json()).toEqual(unknown.json());
      expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS');
    });

    it('POST /login: 400 su payload non valido o JSON malformato', async () => {
      expect((await login({ email: 'a@b.it' })).statusCode).toBe(400);
      const malformed = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: '{"email":',
      });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /me: 401 senza token, con token non valido o per utente cancellato', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: 'Bearer x.y.z' } })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: 'Basic abc' } })).statusCode).toBe(401);

      const { token } = (await ctx.tokens.issue('utente-cancellato'));
      const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(401);
    });

    it(`limita i tentativi di login a ${AUTH_RATE_LIMIT_PER_MINUTE} al minuto per IP (429)`, async () => {
      const attempt = () => login({ email: 'x@y.it', password: 'nope' });
      for (let i = 0; i < AUTH_RATE_LIMIT_PER_MINUTE; i += 1) expect((await attempt()).statusCode).toBe(401);
      const limited = await attempt();
      expect(limited.statusCode).toBe(429);
      expect(limited.json().error.code).toBe('RATE_LIMITED');
    });
  });

  describe('Google OAuth (callback simulata)', () => {
    const startFlow = async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/google/start' });
      expect(res.statusCode).toBe(200);
      return res.json() as { authUrl: string; state: string };
    };
    const callback = (query: string) => app.inject({ method: 'GET', url: `/api/auth/google/callback?${query}` });
    const result = async (state: string) =>
      app.inject({ method: 'GET', url: `/api/auth/google/result?state=${encodeURIComponent(state)}` });

    it('start → pending → callback → complete (una sola volta)', async () => {
      await setup();
      const { authUrl, state } = await startFlow();
      expect(new URL(authUrl).searchParams.get('state')).toBe(state);
      expect((await result(state)).json()).toEqual({ status: 'pending' });

      const cb = await callback(`state=${state}&code=auth-code`);
      expect(cb.statusCode).toBe(200);
      expect(cb.headers['content-type']).toContain('text/html');
      expect(cb.body).toContain('Accesso completato');

      const done = GoogleResultResponseSchema.parse((await result(state)).json());
      expect(done.status).toBe('complete');
      const auth = (done as { auth: AuthResponse }).auth;
      expect(auth.user).toMatchObject({ email: 'gio@example.com', hasGoogle: true });
      expect((await result(state)).statusCode).toBe(404);
    });

    it('registra l\'errore se l\'utente annulla su Google', async () => {
      await setup();
      const { state } = await startFlow();
      const cb = await callback(`state=${state}&error=access_denied`);
      expect(cb.statusCode).toBe(400);
      expect((await result(state)).json()).toEqual({ status: 'error', code: 'GOOGLE_DENIED' });
    });

    it('registra l\'errore di login (email non verificata)', async () => {
      await setup({ google: { ...googleUser, email_verified: false } });
      const { state } = await startFlow();
      expect((await callback(`state=${state}&code=c`)).statusCode).toBe(400);
      expect((await result(state)).json()).toEqual({ status: 'error', code: 'GOOGLE_EMAIL_NOT_VERIFIED' });
    });

    it('rifiuta callback con state sconosciuto o parametri non validi', async () => {
      await setup();
      const unknown = await callback('state=inventato&code=c');
      expect(unknown.statusCode).toBe(400);
      expect((await result('inventato')).statusCode).toBe(404);
      expect((await callback(`state=${'x'.repeat(200)}`)).statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/api/auth/google/result' })).statusCode).toBe(400);
    });

    it('risponde 503 se Google non è configurato', async () => {
      await setup({ google: null });
      expect((await app.inject({ method: 'GET', url: '/api/auth/google/start' })).json().error.code).toBe('GOOGLE_NOT_CONFIGURED');
      expect((await result('s')).statusCode).toBe(503);
      expect((await callback('state=s&code=c')).statusCode).toBe(400);
    });
  });
});
