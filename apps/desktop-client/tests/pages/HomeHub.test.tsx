/**
 * @nature [TEST]
 * @module HomeHubTest
 * @description Verifica benvenuto con nome utente e logout con ritorno a /login.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/pages/HomeHub.test.tsx
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HomeHub } from '../../src/pages/HomeHub.js';
import { AuthStoreProvider } from '../../src/store/use-auth-store.js';
import { createTestStore } from '../helpers/fake-api.js';

describe('HomeHub', () => {
  it('saluta l\'utente e al logout torna a /login', async () => {
    const { store } = createTestStore();
    await store.getState().login({ email: 'ada@example.com', password: 'password-sicura' });
    const router = createMemoryRouter(
      [
        { path: '/home', element: <HomeHub /> },
        { path: '/login', element: <h1>Pagina login</h1> },
      ],
      { initialEntries: ['/home'] },
    );
    render(
      <AuthStoreProvider store={store}>
        <RouterProvider router={router} />
      </AuthStoreProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Benvenuto, Ada' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Esci' }));
    expect(await screen.findByRole('heading', { name: 'Pagina login' })).toBeInTheDocument();
    expect(store.getState().status).toBe('anonymous');
  });
});
