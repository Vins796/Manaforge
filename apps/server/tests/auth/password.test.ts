/**
 * @nature [TEST]
 * @module PasswordTest
 * @description Verifica hashing Argon2id, verifica corretta/errata e gestione di hash malformati.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/auth/password.test.ts
 */
import { describe, expect, it } from 'vitest';
import { burnPasswordVerification, hashPassword, verifyPassword } from '../../src/auth/password.js';

describe('password', () => {
  it('produce hash Argon2id con salt casuale e parametri OWASP', async () => {
    const a = await hashPassword('correct horse');
    const b = await hashPassword('correct horse');
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(a).not.toBe(b);
  });

  it('verifica la password corretta e rifiuta quella errata', async () => {
    const stored = await hashPassword('correct horse');
    expect(await verifyPassword(stored, 'correct horse')).toBe(true);
    expect(await verifyPassword(stored, 'wrong horse')).toBe(false);
  });

  it('tratta un hash malformato come password errata', async () => {
    expect(await verifyPassword('non-un-hash', 'qualcosa')).toBe(false);
  });

  it('burnPasswordVerification completa senza errori', async () => {
    await expect(burnPasswordVerification('x')).resolves.toBeUndefined();
    await expect(burnPasswordVerification('y')).resolves.toBeUndefined();
  });
});
