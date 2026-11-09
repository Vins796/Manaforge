/**
 * @nature [TEST]
 * @module AuthStoreTest
 * @description Verifica transizioni di stato, persistenza della sessione, polling Google, annullamento e ripristino.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/store/use-auth-store.test.tsx
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ok } from '@manaforge/shared';
import { AuthStoreProvider, GOOGLE_POLL_TIMEOUT_MS, SESSION_STORAGE_KEY, useAuthStore } from '../../src/store/use-auth-store.js';
import { AUTH, apiError, createMemoryStorage, createTestStore } from '../helpers/fake-api.js';

const credentials = { email: 'ada@example.com', password: 'password-sicura' };

describe('createAuthStore', () => {
  it('parte in restoring e passa ad authenticated dopo il login, salvando la sessione', async () => {
    const { store, storage } = createTestStore();
    expect(store.getState().status).toBe('restoring');
    expect(await store.getState().login(credentials)).toBe(true);
    expect(store.getState()).toMatchObject({ status: 'authenticated', user: AUTH.user, token: AUTH.token, error: null });
    expect(JSON.parse(storage.data.get(SESSION_STORAGE_KEY) ?? '')).toEqual({ token: AUTH.token, expiresAt: AUTH.expiresAt });
  });

  it('mostra il messaggio del server su login o registrazione falliti', async () => {
    const { store, api } = createTestStore();
    api.login.mockResolvedValueOnce(apiError(401, 'INVALID_CREDENTIALS', 'Email o password non corretti.'));
    expect(await store.getState().login(credentials)).toBe(false);
    expect(store.getState()).toMatchObject({ status: 'anonymous', error: 'Email o password non corretti.' });

    api.register.mockResolvedValueOnce(apiError(409, 'EMAIL_TAKEN', 'Email già usata'));
    expect(await store.getState().register({ ...credentials, username: 'Ada' })).toBe(false);
    expect(store.getState().error).toBe('Email già usata');
    store.getState().clearError();
    expect(store.getState().error).toBeNull();
    expect(await store.getState().register({ ...credentials, username: 'Ada' })).toBe(true);
  });

  it('logout cancella stato e sessione salvata', async () => {
    const { store, storage } = createTestStore();
    await store.getState().login(credentials);
    store.getState().logout();
    expect(store.getState()).toMatchObject({ status: 'anonymous', user: null, token: null });
    expect(storage.data.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('continua a funzionare se lo storage lancia eccezioni', async () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const { store } = createTestStore({ storage: broken });
    await store.getState().restore();
    expect(store.getState().status).toBe('anonymous');
    expect(await store.getState().login(credentials)).toBe(true);
    store.getState().logout();
    expect(store.getState().status).toBe('anonymous');
  });

  describe('restore', () => {
    const stored = (session: unknown) => createMemoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify(session) });

    it('ripristina una sessione valida verificandola con /me', async () => {
      const { store, api } = createTestStore({ storage: stored({ token: 't', expiresAt: AUTH.expiresAt }) });
      await store.getState().restore();
      expect(api.me).toHaveBeenCalledWith('t');
      expect(store.getState()).toMatchObject({ status: 'authenticated', token: 't', user: AUTH.user });
    });

    it.each([
      ['assente', createMemoryStorage()],
      ['malformata', createMemoryStorage({ [SESSION_STORAGE_KEY]: '{non json' })],
      ['scaduta', stored({ token: 't', expiresAt: '2000-01-01T00:00:00.000Z' })],
    ])('passa ad anonymous con sessione %s', async (_c, storage) => {
      const { store, api } = createTestStore({ storage });
      await store.getState().restore();
      expect(store.getState().status).toBe('anonymous');
      expect(api.me).not.toHaveBeenCalled();
    });

    it('rimuove la sessione revocata (401) ma la conserva se il server non risponde', async () => {
      const revoked = stored({ token: 't', expiresAt: AUTH.expiresAt });
      const a = createTestStore({ storage: revoked });
      a.api.me.mockResolvedValueOnce(apiError(401, 'UNAUTHORIZED'));
      await a.store.getState().restore();
      expect(a.store.getState()).toMatchObject({ status: 'anonymous', error: 'Sessione scaduta, accedi di nuovo.' });
      expect(revoked.data.has(SESSION_STORAGE_KEY)).toBe(false);

      const offline = stored({ token: 't', expiresAt: AUTH.expiresAt });
      const b = createTestStore({ storage: offline });
      b.api.me.mockResolvedValueOnce(apiError(0, 'NETWORK_ERROR', 'offline'));
      await b.store.getState().restore();
      expect(b.store.getState().error).toBe('offline');
      expect(offline.data.has(SESSION_STORAGE_KEY)).toBe(true);
    });
  });

  describe('loginWithGoogle', () => {
    it('apre il browser e fa polling fino al completamento', async () => {
      const { store, api, openExternal } = createTestStore();
      api.googleResult.mockResolvedValueOnce(ok({ status: 'pending' }));
      expect(await store.getState().loginWithGoogle()).toBe(true);
      expect(openExternal).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1');
      expect(api.googleResult).toHaveBeenCalledTimes(2);
      expect(store.getState().status).toBe('authenticated');
    });

    it.each([
      ['start fallito', (api: ReturnType<typeof createTestStore>['api']) => api.googleStart.mockResolvedValueOnce(apiError(503, 'GOOGLE_NOT_CONFIGURED', 'non configurato')), 'non configurato'],
      ['polling fallito', (api: ReturnType<typeof createTestStore>['api']) => api.googleResult.mockResolvedValueOnce(apiError(404, 'GOOGLE_STATE_INVALID', 'scaduto')), 'scaduto'],
      ['errore Google', (api: ReturnType<typeof createTestStore>['api']) => api.googleResult.mockResolvedValueOnce(ok({ status: 'error', code: 'GOOGLE_DENIED' })), 'Accesso con Google non riuscito.'],
    ])('fallisce con %s', async (_case, arrange, message) => {
      const { store, api } = createTestStore();
      arrange(api);
      expect(await store.getState().loginWithGoogle()).toBe(false);
      expect(store.getState()).toMatchObject({ status: 'anonymous', error: message });
    });

    it('fallisce se il browser non si apre', async () => {
      const { store } = createTestStore({ openExternal: () => false });
      expect(await store.getState().loginWithGoogle()).toBe(false);
      expect(store.getState().error).toBe('Impossibile aprire il browser di sistema.');
    });

    it('va in timeout dopo 10 minuti di attesa', async () => {
      let now = 0;
      const { store, api } = createTestStore({ now: () => now, sleep: async (ms) => { now += ms; } });
      api.googleResult.mockResolvedValue(ok({ status: 'pending' }));
      expect(await store.getState().loginWithGoogle()).toBe(false);
      expect(store.getState().error).toMatch(/Tempo scaduto/);
      expect(api.googleResult.mock.calls.length).toBeGreaterThan(100);
      expect(now).toBeGreaterThanOrEqual(GOOGLE_POLL_TIMEOUT_MS);
    });

    it('cancelGoogle interrompe il polling durante l\'attesa o durante una richiesta', async () => {
      let release: () => void = () => undefined;
      const { store } = createTestStore({ sleep: () => new Promise<void>((resolve) => { release = resolve; }) });
      const pending = store.getState().loginWithGoogle();
      await vi.waitFor(() => expect(store.getState().status).toBe('awaiting-google'));
      store.getState().cancelGoogle();
      release();
      expect(await pending).toBe(false);
      expect(store.getState().status).toBe('anonymous');

      const slow = createTestStore();
      let answer: (v: Awaited<ReturnType<typeof slow.api.googleResult>>) => void = () => undefined;
      slow.api.googleResult.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
      const inFlight = slow.store.getState().loginWithGoogle();
      await vi.waitFor(() => expect(slow.api.googleResult).toHaveBeenCalled());
      slow.store.getState().cancelGoogle();
      answer(ok({ status: 'complete', auth: AUTH }));
      expect(await inFlight).toBe(false);
      expect(slow.store.getState().status).toBe('anonymous');
    });

    it('cancelGoogle non ha effetto se non c\'è un accesso in corso', async () => {
      const { store } = createTestStore();
      await store.getState().login(credentials);
      store.getState().cancelGoogle();
      expect(store.getState().status).toBe('authenticated');
    });
  });
});

describe('useAuthStore', () => {
  it('legge lo stato dal provider e lancia fuori dal provider', () => {
    const { store } = createTestStore();
    const { result } = renderHook(() => useAuthStore((s) => s.status), {
      wrapper: ({ children }) => <AuthStoreProvider store={store}>{children}</AuthStoreProvider>,
    });
    expect(result.current).toBe('restoring');
    expect(() => renderHook(() => useAuthStore((s) => s.status))).toThrow(/AuthStoreProvider/);
  });
});
