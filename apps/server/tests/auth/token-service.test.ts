/**
 * @nature [TEST]
 * @module TokenServiceTest
 * @description Verifica emissione, scadenza, firma e validazione della configurazione dei JWT.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/auth/token-service.test.ts
 */
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { JWT_AUDIENCE, JWT_ISSUER, createTokenService } from '../../src/auth/token-service.js';
import { TEST_SECRET } from '../helpers/test-context.js';

const fixedNow = new Date('2026-11-09T10:00:00Z');

describe('createTokenService', () => {
  it('emette un token verificabile con scadenza a ttlSeconds', async () => {
    const tokens = createTokenService({ secret: TEST_SECRET, ttlSeconds: 60, now: () => fixedNow });
    const issued = await tokens.issue('user-1');
    expect(issued.expiresAt.toISOString()).toBe('2026-11-09T10:01:00.000Z');
    expect(await tokens.verify(issued.token)).toEqual({ ok: true, value: { userId: 'user-1' } });
  });

  it('rifiuta token scaduti, manomessi o firmati con un altro segreto', async () => {
    let now = fixedNow;
    const tokens = createTokenService({ secret: TEST_SECRET, ttlSeconds: 60, now: () => now });
    const { token } = await tokens.issue('user-1');

    const other = createTokenService({ secret: new Uint8Array(64).fill(9) });
    expect((await other.verify(token)).ok).toBe(false);
    expect((await tokens.verify(`${token}x`)).ok).toBe(false);
    expect((await tokens.verify('garbage')).ok).toBe(false);

    now = new Date(fixedNow.getTime() + 61_000);
    expect(await tokens.verify(token)).toEqual({ ok: false, error: 'INVALID_TOKEN' });
  });

  it('rifiuta token senza subject', async () => {
    const tokens = createTokenService({ secret: TEST_SECRET });
    const noSub = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime('1h')
      .sign(TEST_SECRET);
    expect((await tokens.verify(noSub)).ok).toBe(false);
  });

  it('rifiuta configurazioni non sicure', () => {
    expect(() => createTokenService({ secret: new Uint8Array(16) })).toThrow(/32 byte/);
    expect(() => createTokenService({ secret: TEST_SECRET, ttlSeconds: 0 })).toThrow(/ttlSeconds/);
    expect(() => createTokenService({ secret: TEST_SECRET, ttlSeconds: 1.5 })).toThrow(/ttlSeconds/);
  });
});
