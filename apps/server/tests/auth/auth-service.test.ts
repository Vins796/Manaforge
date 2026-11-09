/**
 * @nature [TEST]
 * @module AuthServiceTest
 * @description Verifica registrazione, login, login/collegamento Google e lettura del profilo.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/auth/auth-service.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unwrap } from '@manaforge/shared';
import { FALLBACK_USERNAME, createAuthService, deriveUsername } from '../../src/auth/auth-service.js';
import { createTestContext, type TestContext } from '../helpers/test-context.js';

const credentials = { email: 'ada@example.com', username: 'Ada', password: 'password-sicura' };

describe('AuthService', () => {
  let ctx: TestContext;
  beforeEach(() => {
    ctx = createTestContext();
  });
  afterEach(() => {
    ctx.conn.close();
  });

  it('registra un utente con password hashata e restituisce un token valido', async () => {
    const res = unwrap(await ctx.auth.register(credentials));
    expect(res.user).toMatchObject({ email: 'ada@example.com', username: 'Ada', hasPassword: true, hasGoogle: false });
    expect(ctx.users.findByEmail('ada@example.com')?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await ctx.tokens.verify(res.token)).toEqual({ ok: true, value: { userId: res.user.id } });
  });

  it('rifiuta una seconda registrazione con la stessa email', async () => {
    await ctx.auth.register(credentials);
    expect(await ctx.auth.register(credentials)).toEqual({ ok: false, error: 'EMAIL_TAKEN' });
  });

  it('mappa la violazione UNIQUE in EMAIL_TAKEN e rilancia altri errori di inserimento', async () => {
    const raceUsers = { ...ctx.users, findByEmail: () => undefined };
    const race = createAuthService({ users: raceUsers, tokens: ctx.tokens });
    await ctx.auth.register(credentials);
    expect(await race.register(credentials)).toEqual({ ok: false, error: 'EMAIL_TAKEN' });

    const broken = createAuthService({
      users: { ...ctx.users, insert: () => { throw new Error('disco pieno'); } },
      tokens: ctx.tokens,
    });
    await expect(broken.register({ ...credentials, email: 'z@z.it' })).rejects.toThrow('disco pieno');
  });

  it('esegue il login con le credenziali corrette', async () => {
    await ctx.auth.register(credentials);
    const res = unwrap(await ctx.auth.login({ email: credentials.email, password: credentials.password }));
    expect(res.user.email).toBe(credentials.email);
  });

  it('rifiuta password errata, email sconosciuta e account solo-Google con lo stesso errore', async () => {
    await ctx.auth.register(credentials);
    ctx.users.insert({ email: 'g@example.com', username: 'Gio', googleId: 'g-1' });
    for (const attempt of [
      { email: credentials.email, password: 'sbagliata' },
      { email: 'nessuno@example.com', password: 'qualsiasi' },
      { email: 'g@example.com', password: 'qualsiasi' },
    ]) {
      expect(await ctx.auth.login(attempt)).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
    }
  });

  describe('loginWithGoogle', () => {
    const profile = { sub: 'g-123', email: 'Gio@Example.com', emailVerified: true, name: 'Gio Rossi' };

    it('crea un nuovo utente al primo accesso e lo ritrova per googleId', async () => {
      const first = unwrap(await ctx.auth.loginWithGoogle(profile));
      expect(first.user).toMatchObject({ email: 'gio@example.com', username: 'Gio Rossi', hasPassword: false, hasGoogle: true });
      const second = unwrap(await ctx.auth.loginWithGoogle({ ...profile, emailVerified: false }));
      expect(second.user.id).toBe(first.user.id);
    });

    it('collega Google a un account manuale esistente solo con email verificata', async () => {
      const manual = unwrap(await ctx.auth.register({ ...credentials, email: 'gio@example.com' }));
      expect(await ctx.auth.loginWithGoogle({ ...profile, emailVerified: false })).toEqual({
        ok: false,
        error: 'GOOGLE_EMAIL_NOT_VERIFIED',
      });
      const linked = unwrap(await ctx.auth.loginWithGoogle(profile));
      expect(linked.user).toMatchObject({ id: manual.user.id, hasPassword: true, hasGoogle: true });
    });

    it('segnala conflitto se l\'email è già collegata a un altro account Google', async () => {
      ctx.users.insert({ email: 'gio@example.com', username: 'Gio', googleId: 'g-altro' });
      expect(await ctx.auth.loginWithGoogle(profile)).toEqual({ ok: false, error: 'GOOGLE_ACCOUNT_CONFLICT' });
    });

    it('gestisce corse sull\'inserimento e rilancia errori inattesi', async () => {
      const findByEmail = vi.fn().mockReturnValue(undefined);
      ctx.users.insert({ email: 'gio@example.com', username: 'Gio', googleId: 'g-altro' });
      const race = createAuthService({ users: { ...ctx.users, findByEmail }, tokens: ctx.tokens });
      expect(await race.loginWithGoogle(profile)).toEqual({ ok: false, error: 'GOOGLE_ACCOUNT_CONFLICT' });

      const broken = createAuthService({
        users: { ...ctx.users, findByEmail, insert: () => { throw new Error('boom'); } },
        tokens: ctx.tokens,
      });
      await expect(broken.loginWithGoogle({ ...profile, sub: 'g-new' })).rejects.toThrow('boom');
    });

    it('usa l\'utente esistente se setGoogleId non restituisce la riga aggiornata', async () => {
      await ctx.auth.register({ ...credentials, email: 'gio@example.com' });
      const svc = createAuthService({ users: { ...ctx.users, setGoogleId: () => undefined }, tokens: ctx.tokens });
      expect(unwrap(await svc.loginWithGoogle(profile)).user.email).toBe('gio@example.com');
    });
  });

  it('getProfile restituisce l\'utente pubblico o USER_NOT_FOUND', async () => {
    const res = unwrap(await ctx.auth.register(credentials));
    expect(ctx.auth.getProfile(res.user.id)).toEqual({ ok: true, value: res.user });
    expect(ctx.auth.getProfile('assente')).toEqual({ ok: false, error: 'USER_NOT_FOUND' });
  });
});

describe('deriveUsername', () => {
  it.each([
    [{ email: 'x@y.it', name: 'Gio Rossi' }, 'Gio Rossi'],
    [{ email: 'x@y.it', name: '  Ana<b>!!  ' }, 'Ana b'],
    [{ email: 'mario.bianchi@y.it', name: '' }, 'mario bianchi'],
    [{ email: 'mario@y.it', name: 'A'.repeat(40) }, 'A'.repeat(24)],
    [{ email: 'ab@y.it' }, FALLBACK_USERNAME],
    [{ email: '!!@y.it', name: '??' }, FALLBACK_USERNAME],
  ])('%j → %s', (profile, expected) => {
    expect(deriveUsername(profile)).toBe(expected);
  });
});
