/**
 * @nature [TEST]
 * @module FakeApi
 * @description Doppi di test del client: ApiClient con mock vitest, storage in memoria e risposte di esempio.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/store/use-auth-store.test.tsx
 */
import { vi } from 'vitest';
import { err, ok, type AuthResponse, type Result } from '@manaforge/shared';
import type { ApiClient, ApiError } from '../../src/services/api-client.js';
import { createAuthStore, type AuthStoreDeps } from '../../src/store/use-auth-store.js';

/** Risposta di autenticazione di esempio. */
export const AUTH: AuthResponse = {
  token: 'jwt-token',
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: 'u1', email: 'ada@example.com', username: 'Ada', avatar: 'forgiatore', hasPassword: true, hasGoogle: false },
};

/** Costruisce un errore API. */
export const apiError = (status: number, code: string, message = `errore ${code}`): Result<never, ApiError> =>
  err({ status, code, message });

/** ApiClient in cui ogni metodo è un mock. */
export const createFakeApi = () => ({
  register: vi.fn<ApiClient['register']>().mockResolvedValue(ok(AUTH)),
  login: vi.fn<ApiClient['login']>().mockResolvedValue(ok(AUTH)),
  me: vi.fn<ApiClient['me']>().mockResolvedValue(ok(AUTH.user)),
  googleStart: vi.fn<ApiClient['googleStart']>().mockResolvedValue(ok({ authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1', state: 'st' })),
  googleResult: vi.fn<ApiClient['googleResult']>().mockResolvedValue(ok({ status: 'complete', auth: AUTH })),
});

/** Storage in memoria compatibile con `localStorage`. */
export const createMemoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void data.set(key, value)),
    removeItem: vi.fn((key: string) => void data.delete(key)),
    data,
  };
};

/** Crea uno store con dipendenze finte (sleep istantaneo). */
export const createTestStore = (overrides: Partial<AuthStoreDeps> = {}) => {
  const api = createFakeApi();
  const storage = createMemoryStorage();
  const openExternal = vi.fn(() => true);
  const store = createAuthStore({ api, storage, openExternal, sleep: async () => undefined, ...overrides });
  return { store, api, storage, openExternal };
};
