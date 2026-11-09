/**
 * @nature [TEST]
 * @module AppTest
 * @description Verifica ripristino della sessione all'avvio, protezione di /home e rotte di fallback.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/App.test.tsx
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App.js';
import { SESSION_STORAGE_KEY } from '../src/store/use-auth-store.js';
import { AUTH, createMemoryStorage, createTestDeckStore, createTestStore } from './helpers/fake-api.js';

const deckStore = () => createTestDeckStore().store;

describe('App', () => {
  it('senza sessione reindirizza /home a /login', async () => {
    const { store } = createTestStore();
    render(<App store={store} deckStore={deckStore()} initialEntries={['/home']} />);
    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeInTheDocument();
  });

  it('mostra lo splash durante il ripristino e poi la Home con sessione valida', async () => {
    const storage = createMemoryStorage({ [SESSION_STORAGE_KEY]: JSON.stringify({ token: 't', expiresAt: AUTH.expiresAt }) });
    const { store } = createTestStore({ storage });
    render(<App store={store} deckStore={deckStore()} initialEntries={['/']} />);
    expect(screen.getByRole('status')).toHaveTextContent('MANAFORGE');
    expect(await screen.findByRole('heading', { name: 'Benvenuto, Ada' })).toBeInTheDocument();
  });

  it('non ripete il ripristino se lo stato è già noto', async () => {
    const { store, api } = createTestStore();
    store.setState({ status: 'anonymous' });
    render(<App store={store} deckStore={deckStore()} initialEntries={['/login']} />);
    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeInTheDocument();
    expect(api.me).not.toHaveBeenCalled();
  });

  it('usa la history del browser senza initialEntries', async () => {
    window.history.pushState({}, '', '/login');
    const { store } = createTestStore();
    render(<App store={store} deckStore={deckStore()} />);
    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeInTheDocument();
  });

  it.each([
    ['/decks', 'I miei mazzi'],
    ['/collection', 'Collezione'],
  ])('con sessione valida %s mostra la pagina "%s"', async (url, heading) => {
    const { store } = createTestStore();
    await store.getState().login({ email: 'ada@example.com', password: 'password-sicura' });
    render(<App store={store} deckStore={deckStore()} initialEntries={[url]} />);
    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  });

  it('/decks/new apre il deckbuilder e al logout i dati dei mazzi vengono azzerati', async () => {
    const { store } = createTestStore();
    await store.getState().login({ email: 'ada@example.com', password: 'password-sicura' });
    const decks = createTestDeckStore().store;
    render(<App store={store} deckStore={decks} initialEntries={['/decks/new']} />);
    expect(await screen.findByRole('complementary', { name: 'Mazzo in costruzione' })).toBeInTheDocument();
    await waitFor(() => expect(decks.getState().catalogStatus).toBe('ready'));
    decks.getState().addCard('TS1-003');

    await userEvent.click(screen.getByRole('button', { name: 'Esci' }));
    expect(await screen.findByRole('tab', { name: 'Accedi' })).toBeInTheDocument();
    expect(decks.getState()).toMatchObject({ catalogStatus: 'idle', catalog: [], draft: { cards: [] } });
  });
});
