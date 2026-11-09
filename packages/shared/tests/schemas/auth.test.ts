/**
 * @nature [TEST]
 * @module AuthSchemasTest
 * @description Verifica normalizzazione e regole di validazione dei payload di autenticazione.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile packages/shared/tests/schemas/auth.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  ApiErrorResponseSchema,
  AuthResponseSchema,
  GoogleResultResponseSchema,
  GoogleStartResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
} from '../../src/schemas/auth.js';

const user = { id: 'u1', email: 'a@b.it', username: 'Ada', avatar: 'forgiatore', hasPassword: true, hasGoogle: false };

describe('RegisterRequestSchema', () => {
  it('normalizza email e nome utente', () => {
    const parsed = RegisterRequestSchema.parse({ email: '  Ada@Example.COM ', username: '  Ada_99 ', password: 'password1' });
    expect(parsed).toEqual({ email: 'ada@example.com', username: 'Ada_99', password: 'password1' });
  });

  it.each([
    [{ email: 'non-email', username: 'Ada', password: 'password1' }, 'email'],
    [{ email: 'a@b.it', username: 'Al', password: 'password1' }, 'username'],
    [{ email: 'a@b.it', username: 'A'.repeat(25), password: 'password1' }, 'username'],
    [{ email: 'a@b.it', username: 'Ada<script>', password: 'password1' }, 'username'],
    [{ email: 'a@b.it', username: 'Ada', password: 'corta' }, 'password'],
    [{ email: 'a@b.it', username: 'Ada', password: 'x'.repeat(129) }, 'password'],
  ])('rifiuta %j sul campo %s', (input, field) => {
    const result = RegisterRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it('rifiuta campi sconosciuti', () => {
    expect(RegisterRequestSchema.safeParse({ email: 'a@b.it', username: 'Ada', password: 'password1', admin: true }).success).toBe(false);
  });
});

describe('LoginRequestSchema', () => {
  it('accetta qualsiasi password non vuota entro il limite', () => {
    expect(LoginRequestSchema.parse({ email: 'A@B.IT', password: 'x' })).toEqual({ email: 'a@b.it', password: 'x' });
    expect(LoginRequestSchema.safeParse({ email: 'a@b.it', password: '' }).success).toBe(false);
  });
});

describe('schemi di risposta', () => {
  it('validano risposte di autenticazione, Google ed errori', () => {
    const auth = { token: 't', expiresAt: '2026-11-16T10:00:00.000Z', user };
    expect(AuthResponseSchema.parse(auth)).toEqual(auth);
    expect(AuthResponseSchema.safeParse({ ...auth, expiresAt: 'domani' }).success).toBe(false);
    expect(GoogleStartResponseSchema.safeParse({ authUrl: 'https://accounts.google.com/x', state: 's' }).success).toBe(true);
    expect(GoogleResultResponseSchema.parse({ status: 'pending' })).toEqual({ status: 'pending' });
    expect(GoogleResultResponseSchema.parse({ status: 'complete', auth }).status).toBe('complete');
    expect(GoogleResultResponseSchema.safeParse({ status: 'error', code: 'BOH' }).success).toBe(false);
    expect(ApiErrorResponseSchema.safeParse({ error: { code: 'X', message: 'm' } }).success).toBe(true);
  });
});
