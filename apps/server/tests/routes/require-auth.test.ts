/**
 * @nature [TEST]
 * @module RequireAuthTest
 * @description Verifica l'estrazione del Bearer token e la guardia di sessione (token mancante, malformato, non valido, utente rimosso).
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/routes/require-auth.test.ts
 */
import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '../../src/db/db-schema.js';
import { bearerToken, createAuthGuard } from '../../src/routes/require-auth.js';
import { createTestContext, type TestContext } from '../helpers/test-context.js';

const request = (authorization?: string) => ({ headers: authorization === undefined ? {} : { authorization } }) as FastifyRequest;

describe('bearerToken', () => {
  it('estrae il token solo da un header Bearer ben formato', () => {
    expect(bearerToken(request('Bearer abc.def'))).toBe('abc.def');
    expect(bearerToken(request('bearer xyz'))).toBe('xyz');
    expect(bearerToken(request('Basic abc'))).toBeUndefined();
    expect(bearerToken(request('Bearer a b'))).toBeUndefined();
    expect(bearerToken(request())).toBeUndefined();
  });
});

describe('createAuthGuard', () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = createTestContext();
  });
  afterEach(() => ctx.conn.close());

  it('restituisce l\'id utente con un token valido e undefined altrimenti', async () => {
    const guard = createAuthGuard(ctx);
    const user = ctx.users.insert({ email: 'ada@example.com', username: 'Ada' });
    const { token } = await ctx.tokens.issue(user.id);

    expect(await guard(request(`Bearer ${token}`))).toBe(user.id);
    expect(await guard(request('Bearer non-valido'))).toBeUndefined();
    expect(await guard(request())).toBeUndefined();

    ctx.conn.db.delete(users).where(eq(users.id, user.id)).run();
    expect(await guard(request(`Bearer ${token}`))).toBeUndefined();
  });
});
