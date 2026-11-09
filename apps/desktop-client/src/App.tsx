/**
 * @nature [UI]
 * @module App
 * @description Radice dell'interfaccia: provider dello store, ripristino della sessione e rotte protette (`/login`, `/home`).
 * @relatedDocs docs/catalog/UI/01-login-page.md
 * @testFile apps/desktop-client/tests/App.test.tsx
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, RouterProvider, createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { HomeHub } from './pages/HomeHub.js';
import { LoginPage } from './pages/LoginPage.js';
import { AuthStoreProvider, useAuthStore, type AuthState } from './store/use-auth-store.js';

const Splash = () => (
  <div role="status" className="flex min-h-full items-center justify-center font-display tracking-[0.3em] text-text-muted">
    MANAFORGE
  </div>
);

/** Consente l'accesso solo con sessione attiva, altrimenti reindirizza a `/login`. */
const RequireAuth = ({ children }: { readonly children: ReactNode }) => {
  const status = useAuthStore((s) => s.status);
  if (status === 'restoring') return <Splash />;
  return status === 'authenticated' ? children : <Navigate to="/login" replace />;
};

/** Rotte dell'applicazione. */
export const APP_ROUTES: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/home', element: <RequireAuth><HomeHub /></RequireAuth> },
  { path: '*', element: <Navigate to="/home" replace /> },
];

/** Props di {@link App}. */
export interface AppProps {
  readonly store: StoreApi<AuthState>;
  /** Percorsi iniziali: se presenti usa un router in memoria (test), altrimenti la history del browser. */
  readonly initialEntries?: string[];
}

/**
 * Componente radice.
 *
 * @param props - Store di autenticazione e, nei test, la rotta iniziale.
 * @returns L'applicazione.
 */
export const App = ({ store, initialEntries }: AppProps) => {
  useEffect(() => {
    if (store.getState().status === 'restoring') void store.getState().restore();
  }, [store]);

  // Il router va creato una sola volta: ricrearlo a ogni render azzererebbe la navigazione.
  const router = useMemo(
    () => (initialEntries ? createMemoryRouter(APP_ROUTES, { initialEntries }) : createBrowserRouter(APP_ROUTES)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le rotte iniziali contano solo al primo montaggio
    [],
  );
  return (
    <AuthStoreProvider store={store}>
      <RouterProvider router={router} />
    </AuthStoreProvider>
  );
};
