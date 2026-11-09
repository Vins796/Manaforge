/**
 * @nature [TEST]
 * @module AppTest
 * @description Verifica ripristino della sessione all'avvio, protezione di /home e rotte di fallback.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/App.test.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App.js';
import { SESSION_STORAGE_KEY } from '../src/store/use-auth-store.js';
import { AUTH, createMemoryStorage, createTestStore } from './helpers/fake-api.js';

describe('App', () => {
  it('senza sessione reindirizza /home a /login', async () => {
    const { store } = createTestStore();
    render(<App store={store} initialEntries={['/home']} />);
    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeInTheDocument();
  });

  it('mostra lo splash durante il ripristino e poi la Home con sessione valida', async () => {
    const storage = createMemoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify({ token: 't', expiresAt: AUTH.expiresAt }) });
    const { store } = createTestStore({ storage });
    render(<App store={store} initialEntries={['/']} />);
    expect(screen.getByRole('status')).toHaveTextContent('MANAFORGE');
    expect(await screen.findByRole('heading', { name: 'Benvenuto, Ada' })).toBeInTheDocument();
  });

  it('non ripete il ripristino se lo stato è già noto', async () => {
    const { store, api } = createTestStore();
    store.setState({ status: 'anonymous' });
    render(<App store={store} initialEntries={['/login']} />);
    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeInTheDocument();
    expect(api.me).not.toHaveBeenCalled();
  });

  it('usa la history del browser senza initialEntries', async () => {
    window.history.pushState({}, '', '/login');
    const { store } = createTestStore();
    render(<App store={store} />);
    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeInTheDocument();
  });
});
