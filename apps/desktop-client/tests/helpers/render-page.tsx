/**
 * @nature [TEST]
 * @module RenderPage
 * @description Monta una pagina dentro router in memoria e provider degli store (autenticazione già completata, deckbuilder con API finta).
 * @relatedDocs docs/catalog/TEST/05-deckbuilder-tests.md
 * @testFile apps/desktop-client/tests/pages/DeckbuilderPage.test.tsx
 */
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AuthStoreProvider } from '../../src/store/use-auth-store.js';
import { DeckStoreProvider } from '../../src/store/use-deck-store.js';
import { createTestDeckStore, createTestStore } from './fake-api.js';

/** Opzioni di {@link renderPage}. */
export interface RenderPageOptions {
  readonly path: string;
  readonly url: string;
  /** Rotte aggiuntive (es. destinazioni di navigazione). */
  readonly extraRoutes?: { path: string; element: ReactElement }[];
}

/**
 * Monta `element` sulla rotta `path`, partendo da `url`, con utente autenticato.
 *
 * @param element - Pagina da montare.
 * @param options - Rotta, URL iniziale e rotte aggiuntive.
 * @returns Store, API finta del deckbuilder, router e risultato del render.
 */
export const renderPage = async (element: ReactElement, { path, url, extraRoutes = [] }: RenderPageOptions) => {
  const auth = createTestStore();
  await auth.store.getState().login({ email: 'ada@example.com', password: 'password-sicura' });
  const deck = createTestDeckStore();
  const router = createMemoryRouter(
    [{ path, element }, { path: '/login', element: <h1>Pagina login</h1> }, ...extraRoutes],
    { initialEntries: [url] },
  );
  const view = render(
    <AuthStoreProvider store={auth.store}>
      <DeckStoreProvider store={deck.store}>
        <RouterProvider router={router} />
      </DeckStoreProvider>
    </AuthStoreProvider>,
  );
  return { ...view, router, authStore: auth.store, deckStore: deck.store, api: deck.api };
};
