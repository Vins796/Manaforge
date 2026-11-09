/**
 * @nature [TEST]
 * @module UserRepositoryTest
 * @description Verifica le query del repository utenti e il riconoscimento delle violazioni UNIQUE.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/db/user-repository.test.ts
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isUniqueViolation } from '../../src/db/user-repository.js';
import { createTestContext, type TestContext } from '../helpers/test-context.js';

describe('UserRepository', () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = createTestContext();
  });
  afterEach(() => {
    ctx.conn.close();
  });

  it('inserisce e trova per id, email e googleId', () => {
    const user = ctx.users.insert({ email: 'a@b.it', username: 'Ada' });
    expect(ctx.users.findById(user.id)).toEqual(user);
    expect(ctx.users.findByEmail('a@b.it')).toEqual(user);
    expect(ctx.users.findByGoogleId('g-1')).toBeUndefined();

    const linked = ctx.users.setGoogleId(user.id, 'g-1');
    expect(linked?.googleId).toBe('g-1');
    expect(ctx.users.findByGoogleId('g-1')?.id).toBe(user.id);
    expect(ctx.users.setGoogleId('assente', 'g-2')).toBeUndefined();
  });

  it('isUniqueViolation riconosce solo SQLITE_CONSTRAINT_UNIQUE, anche annidato', () => {
    ctx.users.insert({ email: 'a@b.it', username: 'Ada' });
    let caught: unknown;
    try {
      ctx.users.insert({ email: 'a@b.it', username: 'Bis' });
    } catch (cause) {
      caught = cause;
    }
    expect(isUniqueViolation(caught)).toBe(true);
    expect(isUniqueViolation({ cause: { code: 'SQLITE_CONSTRAINT_UNIQUE' } })).toBe(true);
    expect(isUniqueViolation(new Error('altro'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('stringa')).toBe(false);
  });
});
