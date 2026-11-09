/**
 * @nature [UI]
 * @module App
 * @description Radice dell'interfaccia: provider degli store, ripristino della sessione, azzeramento dei dati al logout e rotte protette (`/home`, `/decks`, `/collection`).
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/App.test.tsx
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, RouterProvider, createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import type { StoreApi } from 'zustand/vanilla';
import { CollectionPage } from './pages/CollectionPage.js';
import { DeckListPage } from './pages/DeckListPage.js';
import { DeckbuilderPage } from './pages/DeckbuilderPage.js';
import { HomeHub } from './pages/HomeHub.js';
import { LoginPage } from './pages/LoginPage.js';
import { AuthStoreProvider, useAuthStore, type AuthState } from './store/use-auth-store.js';
import { DeckStoreProvider, type DeckState } from './store/use-deck-store.js';

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
  { path: '/decks', element: <RequireAuth><DeckListPage /></RequireAuth> },
  { path: '/decks/:deckId', element: <RequireAuth><DeckbuilderPage /></RequireAuth> },
  { path: '/collection', element: <RequireAuth><CollectionPage /></RequireAuth> },
  { path: '*', element: <Navigate to="/home" replace /> },
];

/** Props di {@link App}. */
export interface AppProps {
  readonly store: StoreApi<AuthState>;
  readonly deckStore: StoreApi<DeckState>;
  /** Percorsi iniziali: se presenti usa un router in memoria (test), altrimenti la history del browser. */
  readonly initialEntries?: string[];
}

/**
 * Componente radice.
 *
 * @param props - Store di autenticazione e del deckbuilder e, nei test, la rotta iniziale.
 * @returns L'applicazione.
 */
export const App = ({ store, deckStore, initialEntries }: AppProps) => {
  useEffect(() => {
    if (store.getState().status === 'restoring') void store.getState().restore();
  }, [store]);

  // Al logout (o al cambio di utente) catalogo, mazzi e bozza dell'utente precedente vengono scartati.
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.user?.id !== previous.user?.id && previous.user !== null) deckStore.getState().reset();
      }),
    [store, deckStore],
  );

  // Il router va creato una sola volta: ricrearlo a ogni render azzererebbe la navigazione.
  const router = useMemo(
    () => (initialEntries ? createMemoryRouter(APP_ROUTES, { initialEntries }) : createBrowserRouter(APP_ROUTES)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le rotte iniziali contano solo al primo montaggio
    [],
  );
  return (
    <AuthStoreProvider store={store}>
      <DeckStoreProvider store={deckStore}>
        <RouterProvider router={router} />
      </DeckStoreProvider>
    </AuthStoreProvider>
  );
};
