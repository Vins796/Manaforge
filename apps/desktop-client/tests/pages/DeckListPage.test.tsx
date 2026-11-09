/**
 * @nature [TEST]
 * @module DeckListPageTest
 * @description Verifica la pagina Mazzi: elenco con conteggi e stato, copertina, stato vuoto, errore ed eliminazione con conferma.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/pages/DeckListPage.test.tsx
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ok, type DeckSummary } from '@manaforge/shared';
import { DeckListPage } from '../../src/pages/DeckListPage.js';
import { apiError } from '../helpers/fake-api.js';
import { renderPage } from '../helpers/render-page.js';

const summary = (overrides: Partial<DeckSummary>): DeckSummary => ({
  id: 'd1',
  name: 'Fuoco',
  format: 'standard',
  coverCardId: null,
  updatedAt: '2026-11-09T10:00:00.000Z',
  mainCount: 60,
  sideboardCount: 2,
  isValid: true,
  ...overrides,
});

/** Monta la pagina e attende il caricamento iniziale (elenco vuoto), così i test controllano lo stato successivo. */
const open = async () => {
  const view = await renderPage(<DeckListPage />, { path: '/decks', url: '/decks' });
  await waitFor(() => expect(view.deckStore.getState().decksStatus).toBe('ready'));
  return view;
};

describe('DeckListPage', () => {
  it('elenca i mazzi con conteggi, stato e copertina', async () => {
    const view = await open();
    view.api.listDecks.mockResolvedValueOnce(ok({ decks: [summary({}), summary({ id: 'd2', name: 'Bozza', coverCardId: 'TS1-005', mainCount: 12, isValid: false })] }));
    await view.deckStore.getState().loadDecks();
    expect(await screen.findByRole('heading', { name: 'Fuoco' })).toBeInTheDocument();
    expect(screen.getByText('60/60 Mazzo · 2 Riserva')).toBeInTheDocument();
    expect(screen.getByText('Valido')).toBeInTheDocument();
    expect(screen.getByText('Incompleto')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Bozza/ })).toHaveAttribute('href', '/decks/d2');
    expect(document.querySelector('img[src="http://api.test/api/cards/TS1-005/image/crop"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Nuovo mazzo' })).toHaveAttribute('href', '/decks/new');
  });

  it('mostra lo stato vuoto dopo il caricamento', async () => {
    await open();
    expect(await screen.findByText(/Non hai ancora mazzi/)).toBeInTheDocument();
  });

  it('mostra il caricamento e l\'errore', async () => {
    const view = await open();
    view.deckStore.setState({ decks: [], decksStatus: 'loading' });
    expect(await screen.findByRole('status')).toHaveTextContent('Caricamento dei mazzi…');
    view.api.listDecks.mockResolvedValueOnce(apiError(0, 'NETWORK_ERROR', 'Server non raggiungibile'));
    await view.deckStore.getState().loadDecks();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server non raggiungibile');
  });

  it('elimina un mazzo solo dopo la conferma', async () => {
    const view = await open();
    view.deckStore.setState({ decks: [summary({})], decksStatus: 'ready' });
    await userEvent.click(await screen.findByRole('button', { name: 'Elimina Fuoco' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(view.api.deleteDeck).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Elimina Fuoco' }));
    await userEvent.click(screen.getByRole('button', { name: 'Conferma eliminazione di Fuoco' }));
    expect(view.api.deleteDeck).toHaveBeenCalledWith('jwt-token', 'd1');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Fuoco' })).not.toBeInTheDocument());
  });
});
