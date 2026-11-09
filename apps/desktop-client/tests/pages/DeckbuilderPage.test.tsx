/**
 * @nature [TEST]
 * @module DeckbuilderPageTest
 * @description Verifica il deckbuilder: aggiunta da griglia (clic e clic destro), limiti, colonna del mazzo (+/−/sposta), curva e problemi, import, export negli appunti, salvataggio con cambio di rotta, apertura di un mazzo esistente.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/pages/DeckbuilderPage.test.tsx
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ok } from '@manaforge/shared';
import { DeckbuilderPage } from '../../src/pages/DeckbuilderPage.js';
import { apiError, deckDetail } from '../helpers/fake-api.js';
import { renderPage } from '../helpers/render-page.js';

const open = async (url = '/decks/new', props: Parameters<typeof DeckbuilderPage>[0] = {}) => {
  const view = await renderPage(<DeckbuilderPage {...props} />, { path: '/decks/:deckId', url });
  await screen.findByRole('list', { name: 'Carte' });
  return view;
};
const column = () => screen.getByRole('complementary', { name: 'Mazzo in costruzione' });
const section = (name: 'Mazzo' | 'Riserva') => within(column()).getByRole('region', { name });

describe('DeckbuilderPage', () => {
  it('aggiunge carte con clic (mazzo) e clic destro (riserva) rispettando il limite di 4 copie', async () => {
    const { deckStore } = await open();
    const folletto = screen.getByRole('button', { name: 'Aggiungi Folletto di Prova al mazzo' });
    for (let i = 0; i < 3; i += 1) await userEvent.click(folletto);
    fireEvent.contextMenu(folletto);
    await userEvent.click(folletto);
    expect(within(column()).getByText('Folletto di Prova: hai già 4 copie.')).toBeInTheDocument();
    expect(screen.getByLabelText('4 nel mazzo')).toBeInTheDocument();
    expect(within(section('Mazzo')).getByText('Folletto di Prova')).toBeInTheDocument();
    expect(within(section('Riserva')).getByText('Folletto di Prova')).toBeInTheDocument();
    expect(column()).toHaveTextContent('3/60 Mazzo');
    expect(column()).toHaveTextContent('1/15 Riserva');
    expect(within(column()).getByLabelText('Valore 1: 3')).toBeInTheDocument();
    expect(within(column()).getByRole('list', { name: 'Problemi del mazzo' })).toHaveTextContent('Il mazzo ha 3 carte: ne servono almeno 60.');
    expect(deckStore.getState().dirty).toBe(true);
    expect(screen.getByRole('button', { name: 'Salva *' })).toBeEnabled();
  });

  it('i pulsanti della colonna aggiungono, rimuovono e spostano le copie', async () => {
    const { deckStore } = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi Lampo di Prova al mazzo' }));
    const mazzo = section('Mazzo');
    await userEvent.click(within(mazzo).getByRole('button', { name: 'Aggiungi una copia di Lampo di Prova' }));
    await userEvent.click(within(mazzo).getByRole('button', { name: 'Sposta Lampo di Prova in riserva' }));
    expect(deckStore.getState().draft.cards).toEqual([
      { cardId: 'TS1-004', board: 'main', quantity: 1 },
      { cardId: 'TS1-004', board: 'sideboard', quantity: 1 },
    ]);
    await userEvent.click(within(section('Riserva')).getByRole('button', { name: 'Sposta Lampo di Prova nel mazzo' }));
    await userEvent.click(within(section('Mazzo')).getByRole('button', { name: 'Rimuovi una copia di Lampo di Prova' }));
    expect(deckStore.getState().draft.cards).toEqual([{ cardId: 'TS1-004', board: 'main', quantity: 1 }]);
    expect(within(section('Riserva')).getByText('Vuota.')).toBeInTheDocument();
  });

  it('un mazzo da 60 Fonti base è valido; il nome vuoto blocca il salvataggio', async () => {
    const { deckStore } = await open();
    for (let i = 0; i < 60; i += 1) deckStore.getState().addCard('TS1-001');
    expect(await within(column()).findByText('Mazzo valido.')).toBeInTheDocument();
    const name = within(column()).getByRole('textbox', { name: 'Nome del mazzo' });
    await userEvent.clear(name);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Salva *' })).toBeDisabled();
  });

  it('salva un nuovo mazzo e passa alla rotta con l\'id senza ricaricarlo', async () => {
    const { api, router } = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi Chimera di Prova al mazzo' }));
    const name = within(column()).getByRole('textbox', { name: 'Nome del mazzo' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Chimere');
    await userEvent.selectOptions(within(column()).getByRole('combobox', { name: 'Copertina' }), 'TS1-005');
    await userEvent.click(screen.getByRole('button', { name: 'Salva *' }));
    expect(api.createDeck).toHaveBeenCalledWith('jwt-token', { name: 'Chimere', coverCardId: 'TS1-005', cards: [{ cardId: 'TS1-005', board: 'main', quantity: 1 }] });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/decks/${deckDetail().id}`));
    expect(api.getDeck).not.toHaveBeenCalled();
    expect(within(column()).getByText('Mazzo salvato come bozza incompleta.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument();

    await userEvent.selectOptions(within(column()).getByRole('combobox', { name: 'Copertina' }), '');
    await userEvent.click(screen.getByRole('button', { name: 'Salva *' }));
    expect(api.updateDeck).toHaveBeenCalled();
  });

  it('mostra l\'errore del server se il salvataggio fallisce', async () => {
    const { api } = await open();
    api.createDeck.mockResolvedValueOnce(apiError(422, 'DECK_INVALID', 'Mazzo rifiutato'));
    await userEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await within(column()).findByText('Mazzo rifiutato')).toBeInTheDocument();
  });

  it('apre un mazzo esistente dalla rotta', async () => {
    const { api } = await open('/decks/abc');
    expect(api.getDeck).toHaveBeenCalledWith('jwt-token', 'abc');
    expect(await within(column()).findByDisplayValue('Mazzo di Prova')).toBeInTheDocument();
    expect(within(section('Mazzo')).getByText('Folletto di Prova')).toBeInTheDocument();
  });

  it('mostra caricamento ed errore del mazzo', async () => {
    const view = await renderPage(<DeckbuilderPage />, { path: '/decks/:deckId', url: '/decks/new' });
    view.deckStore.setState({ draftStatus: 'loading' });
    expect(await screen.findByText('Caricamento del mazzo…')).toBeInTheDocument();
    view.api.getDeck.mockResolvedValueOnce(apiError(404, 'NOT_FOUND', 'Risorsa non trovata.'));
    await view.deckStore.getState().openDeck('zzz');
    expect(await within(column()).findByRole('alert')).toHaveTextContent('Risorsa non trovata.');
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
  });

  it('importa dagli appunti tramite il dialogo', async () => {
    const readClipboard = vi.fn(async () => '');
    const { api } = await open('/decks/new', { readClipboard });
    api.parseDeckList.mockResolvedValueOnce(ok({ entries: [{ cardId: 'TS1-006', quantity: 2, board: 'main' }], issues: [] }));
    await userEvent.click(screen.getByRole('button', { name: 'Importa dagli Appunti' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Lista mazzo' }), '2 Crescita di Prova');
    await userEvent.click(screen.getByRole('button', { name: 'Importa' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(readClipboard).toHaveBeenCalled();
    expect(within(section('Mazzo')).getByText('Crescita di Prova')).toBeInTheDocument();
    expect(within(column()).getByLabelText('Valore 6+: 2')).toBeInTheDocument();
  });

  it('esporta la lista negli appunti, ordinata per curva; segnala gli appunti non disponibili', async () => {
    const writeClipboard = vi.fn(async () => undefined);
    const { deckStore } = await open('/decks/new', { writeClipboard });
    expect(screen.getByRole('button', { name: 'Esporta' })).toBeDisabled();
    deckStore.getState().addCard('TS1-005');
    deckStore.getState().addCard('TS1-003');
    deckStore.getState().addCard('TS1-001');
    deckStore.getState().addCard('TS1-004', 'sideboard');
    deckStore.setState({ draft: { ...deckStore.getState().draft, cards: [...deckStore.getState().draft.cards, { cardId: 'XX1-001', board: 'main', quantity: 1 }] } });
    await userEvent.click(screen.getByRole('button', { name: 'Esporta' }));
    expect(writeClipboard).toHaveBeenCalledWith('Mazzo\n1 Fucina di Prova\n1 Folletto di Prova\n1 Chimera di Prova\n\nRiserva\n1 Lampo di Prova\n');
    expect(within(column()).getByText('Lista copiata negli appunti.')).toBeInTheDocument();

    writeClipboard.mockRejectedValueOnce(new Error('negato'));
    await userEvent.click(screen.getByRole('button', { name: 'Esporta' }));
    expect(await within(column()).findByText('Impossibile accedere agli appunti.')).toBeInTheDocument();
  });

  it('senza writeClipboard iniettato usa navigator.clipboard (assente → errore)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const { deckStore } = await open();
    deckStore.getState().addCard('TS1-003');
    await userEvent.click(screen.getByRole('button', { name: 'Esporta' }));
    expect(await within(column()).findByText('Impossibile accedere agli appunti.')).toBeInTheDocument();
  });
});
