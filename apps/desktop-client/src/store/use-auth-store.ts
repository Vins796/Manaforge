/**
 * @nature [UI]
 * @module AuthStore
 * @description Store Zustand della sessione: login, registrazione, flusso Google con polling, ripristino e logout.
 * @relatedDocs docs/catalog/UI/01-login-page.md
 * @testFile apps/desktop-client/tests/store/use-auth-store.test.tsx
 */
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { z } from 'zod';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AuthResponse, LoginRequest, PublicUser, RegisterRequest } from '@manaforge/shared';
import type { ApiClient, ApiError } from '../services/api-client.js';
import type { OpenExternal } from '../services/external-browser.js';

/** Chiave di persistenza della sessione. */
export const SESSION_STORAGE_KEY = 'manaforge.session';
/** Intervallo di polling del risultato Google. */
export const GOOGLE_POLL_INTERVAL_MS = 1_500;
/** Tempo massimo di attesa del browser (coincide con la validità dello state lato server). */
export const GOOGLE_POLL_TIMEOUT_MS = 10 * 60 * 1000;

/** Fasi della sessione. */
export type AuthStatus = 'restoring' | 'anonymous' | 'authenticating' | 'awaiting-google' | 'authenticated';

/** Stato e azioni dello store. */
export interface AuthState {
  readonly status: AuthStatus;
  readonly user: PublicUser | null;
  readonly token: string | null;
  readonly expiresAt: string | null;
  readonly error: string | null;
  login(body: LoginRequest): Promise<boolean>;
  register(body: RegisterRequest): Promise<boolean>;
  loginWithGoogle(): Promise<boolean>;
  cancelGoogle(): void;
  restore(): Promise<void>;
  logout(): void;
  clearError(): void;
}

/** Dipendenze dello store (iniettabili nei test). */
export interface AuthStoreDeps {
  readonly api: ApiClient;
  readonly openExternal: OpenExternal;
  readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const StoredSessionSchema = z.object({ token: z.string().min(1), expiresAt: z.iso.datetime() });

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Crea uno store di autenticazione indipendente.
 *
 * @param deps - Client API, apertura browser, storage persistente e orologio.
 * @returns Lo store vanilla Zustand.
 */
export const createAuthStore = ({ api, openExternal, storage, now = Date.now, sleep = defaultSleep }: AuthStoreDeps): StoreApi<AuthState> => {
  let googleAttempt = 0;

  const safeStorage = {
    read(): unknown {
      try {
        const raw = storage.getItem(SESSION_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    write(value: { token: string; expiresAt: string }): void {
      try {
        storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
      } catch {
        // Storage non disponibile: la sessione resta valida solo in memoria.
      }
    },
    clear(): void {
      try {
        storage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Nulla da fare: non c'è niente da rimuovere.
      }
    },
  };

  return createStore<AuthState>()((set, get) => {
    const signedIn = (auth: AuthResponse): true => {
      safeStorage.write({ token: auth.token, expiresAt: auth.expiresAt });
      set({ status: 'authenticated', user: auth.user, token: auth.token, expiresAt: auth.expiresAt, error: null });
      return true;
    };
    const failed = (error: ApiError | string): false => {
      set({ status: 'anonymous', user: null, token: null, expiresAt: null, error: typeof error === 'string' ? error : error.message });
      return false;
    };

    return {
      status: 'restoring',
      user: null,
      token: null,
      expiresAt: null,
      error: null,

      async login(body) {
        set({ status: 'authenticating', error: null });
        const result = await api.login(body);
        return result.ok ? signedIn(result.value) : failed(result.error);
      },

      async register(body) {
        set({ status: 'authenticating', error: null });
        const result = await api.register(body);
        return result.ok ? signedIn(result.value) : failed(result.error);
      },

      async loginWithGoogle() {
        const attempt = ++googleAttempt;
        set({ status: 'authenticating', error: null });
        const start = await api.googleStart();
        if (!start.ok) return failed(start.error);
        if (!openExternal(start.value.authUrl)) return failed('Impossibile aprire il browser di sistema.');
        set({ status: 'awaiting-google' });

        const deadline = now() + GOOGLE_POLL_TIMEOUT_MS;
        while (now() < deadline) {
          await sleep(GOOGLE_POLL_INTERVAL_MS);
          if (attempt !== googleAttempt) return false;
          const poll = await api.googleResult(start.value.state);
          if (attempt !== googleAttempt) return false;
          if (!poll.ok) return failed(poll.error);
          if (poll.value.status === 'complete') return signedIn(poll.value.auth);
          if (poll.value.status === 'error') return failed('Accesso con Google non riuscito.');
        }
        return failed('Tempo scaduto in attesa dell\'accesso con Google.');
      },

      cancelGoogle() {
        if (get().status !== 'awaiting-google' && get().status !== 'authenticating') return;
        googleAttempt += 1;
        set({ status: 'anonymous', error: null });
      },

      async restore() {
        const stored = StoredSessionSchema.safeParse(safeStorage.read());
        if (!stored.success || Date.parse(stored.data.expiresAt) <= now()) {
          safeStorage.clear();
          set({ status: 'anonymous' });
          return;
        }
        const me = await api.me(stored.data.token);
        if (me.ok) {
          set({ status: 'authenticated', user: me.value, token: stored.data.token, expiresAt: stored.data.expiresAt, error: null });
          return;
        }
        if (me.error.status === 401) safeStorage.clear();
        failed(me.error.status === 401 ? 'Sessione scaduta, accedi di nuovo.' : me.error);
      },

      logout() {
        googleAttempt += 1;
        safeStorage.clear();
        set({ status: 'anonymous', user: null, token: null, expiresAt: null, error: null });
      },

      clearError() {
        set({ error: null });
      },
    };
  });
};

const AuthStoreContext = createContext<StoreApi<AuthState> | null>(null);

/** Props di {@link AuthStoreProvider}. */
export interface AuthStoreProviderProps {
  readonly store: StoreApi<AuthState>;
  readonly children?: ReactNode;
}

/**
 * Rende disponibile lo store di autenticazione ai componenti discendenti.
 *
 * @param props - Store da esporre e figli.
 * @returns Il provider React.
 */
export const AuthStoreProvider = ({ store, children }: AuthStoreProviderProps) =>
  createElement(AuthStoreContext.Provider, { value: store }, children);

/**
 * Legge una porzione dello stato di autenticazione.
 *
 * @param selector - Selettore dello stato.
 * @returns Il valore selezionato; il componente si aggiorna solo quando cambia.
 * @throws Error se usato fuori da {@link AuthStoreProvider}.
 */
export const useAuthStore = <T>(selector: (state: AuthState) => T): T => {
  const store = useContext(AuthStoreContext);
  if (!store) throw new Error('useAuthStore deve essere usato dentro <AuthStoreProvider>');
  return useStore(store, selector);
};
