/**
 * @nature [TEST]
 * @module AppTest
 * @description Verifica CORS, 404 uniforme, limite del corpo e mascheramento degli errori interni.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/app.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { BODY_LIMIT_BYTES, buildApp } from '../src/app.js';
import { createTestContext, type TestContext } from './helpers/test-context.js';

describe('buildApp', () => {
  let ctx: TestContext;
  let app: FastifyInstance;

  const setup = async (overrides: Partial<TestContext['auth']> = {}) => {
    ctx = createTestContext();
    app = await buildApp({ auth: { ...ctx.auth, ...overrides }, tokens: ctx.tokens, google: null, allowedOrigins: ['http://localhost:5173'] });
  };

  afterEach(async () => {
    await app.close();
    ctx.conn.close();
  });

  it('consente CORS solo alle origini configurate', async () => {
    await setup();
    const preflight = (origin: string) =>
      app.inject({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: { origin, 'access-control-request-method': 'POST' },
      });
    expect((await preflight('http://localhost:5173')).headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect((await preflight('https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
  });

  it('risponde 404 nel formato standard', async () => {
    await setup();
    const res = await app.inject({ method: 'GET', url: '/non-esiste' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Risorsa non trovata.' } });
  });

  it('rifiuta corpi oltre il limite con 413', async () => {
    await setup();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'a@b.it', password: 'x'.repeat(BODY_LIMIT_BYTES) }),
    });
    expect(res.statusCode).toBe(413);
  });

  it('non espone i dettagli degli errori interni (500)', async () => {
    await setup({ login: async () => { throw new Error('dettaglio segreto'); } });
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.it', password: 'x' } });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Errore interno del server.' } });
    expect(res.body).not.toContain('segreto');
  });
});
