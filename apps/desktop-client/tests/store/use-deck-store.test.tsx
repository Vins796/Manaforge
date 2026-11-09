/**
 * @nature [TEST]
 * @module DeckStoreTest
 * @description Verifica lo store del deckbuilder: caricamenti, limiti di copie e riserva, spostamenti, import, salvataggio (creazione/aggiornamento, copertina predefinita), eliminazione e reset.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/store/use-deck-store.test.tsx
 */
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ok } from '@manaforge/shared';
import {
  DeckStoreProvider,
  NEW_DECK_NAME,
  copiesOf,
  defaultCoverCardId,
  selectValidation,
  useDeckStore,
} from '../../src/store/use-deck-store.js';
import { CARDS, apiError, createTestDeckStore, deckDetail } from '../helpers/fake-api.js';

const ready = async (token: string | null = 'jwt-token') => {
  const ctx = createTestDeckStore(token);
  await ctx.store.getState().loadCatalog();
  return ctx;
};

describe('createDeckStore — caricamenti', () => {
  it('carica il catalogo una sola volta', async () => {
    const { store, api } = await ready();
    expect(store.getState()).toMatchObject({ catalogStatus: 'ready', catalog: CARDS });
    await store.getState().loadCatalog();
    expect(api.listCards).toHaveBeenCalledTimes(1);
    expect(api.listCards).toHaveBeenCalledWith('jwt-token');
  });

  it('senza sessione o con errore API segnala l\'errore', async () => {
    const { store, api } = createTestDeckStore(null);
    await store.getState().loadCatalog();
    expect(store.getState()).toMatchObject({ catalogStatus: 'error', error: 'Sessione mancante o scaduta.' });
    expect(api.listCards).not.toHaveBeenCalled();

    const other = createTestDeckStore();
    other.api.listDecks.mockResolvedValueOnce(apiError(0, 'NETWORK_ERROR', 'Server non raggiungibile'));
    await other.store.getState().loadDecks();
    expect(other.store.getState()).toMatchObject({ decksStatus: 'error', error: 'Server non raggiungibile' });
  });

  it('carica l\'elenco dei mazzi', async () => {
    const { store, api } = createTestDeckStore();
    const summary = { id: 'd1', name: 'A', format: 'standard' as const, coverCardId: null, updatedAt: '2026-11-09T10:00:00.000Z', mainCount: 60, sideboardCount: 0, isValid: true };
    api.listDecks.mockResolvedValueOnce(ok({ decks: [summary] }));
    await store.getState().loadDecks();
    expect(store.getState()).toMatchObject({ decksStatus: 'ready', decks: [summary] });
  });

  it('apre un mazzo esistente e gestisce il 404', async () => {
    const { store, api } = await ready();
    expect(await store.getState().openDeck('id-1')).toBe(true);
    expect(store.getState().draft).toEqual({ id: deckDetail().id, name: 'Mazzo di Prova', coverCardId: null, cards: deckDetail().cards });
    expect(store.getState().dirty).toBe(false);

    api.getDeck.mockResolvedValueOnce(apiError(404, 'NOT_FOUND', 'Risorsa non trovata.'));
    expect(await store.getState().openDeck('x')).toBe(false);
    expect(store.getState()).toMatchObject({ draftStatus: 'error', error: 'Risorsa non trovata.' });
  });
});

describe('createDeckStore — modifica della bozza', () => {
  it('aggiunge copie fino a 4 sommando mazzo e riserva', async () => {
    const { store } = await ready();
    const { addCard } = store.getState();
    expect([addCard('TS1-003'), addCard('TS1-003'), addCard('TS1-003', 'sideboard'), addCard('TS1-003')]).toEqual([true, true, true, true]);
    expect(addCard('TS1-003', 'sideboard')).toBe(false);
    expect(store.getState().notice).toBe('Folletto di Prova: hai già 4 copie.');
    expect(copiesOf(store.getState().draft.cards, 'TS1-003')).toBe(4);
    expect(store.getState().dirty).toBe(true);
  });

  it('le Fonti base sono illimitate, le altre Fonti no; carte sconosciute ignorate', async () => {
    const { store } = await ready();
    for (let i = 0; i < 30; i += 1) store.getState().addCard('TS1-001');
    expect(store.getState().draft.cards).toEqual([{ cardId: 'TS1-001', board: 'main', quantity: 30 }]);
    for (let i = 0; i < 5; i += 1) store.getState().addCard('TS1-002');
    expect(copiesOf(store.getState().draft.cards, 'TS1-002')).toBe(4);
    expect(store.getState().addCard('XX1-001')).toBe(false);
  });

  it('la riserva si ferma a 15 carte, anche negli spostamenti', async () => {
    const { store } = await ready();
    for (let i = 0; i < 15; i += 1) store.getState().addCard('TS1-001', 'sideboard');
    expect(store.getState().addCard('TS1-001', 'sideboard')).toBe(false);
    expect(store.getState().notice).toBe('La riserva è piena (15 carte).');
    store.getState().addCard('TS1-003');
    expect(store.getState().moveCard('TS1-003', 'main')).toBe(false);
    expect(store.getState().moveCard('TS1-001', 'sideboard')).toBe(true);
    expect(store.getState().draft.cards).toEqual([
      { cardId: 'TS1-001', board: 'sideboard', quantity: 14 },
      { cardId: 'TS1-003', board: 'main', quantity: 1 },
      { cardId: 'TS1-001', board: 'main', quantity: 1 },
    ]);
  });

  it('rimuove copie fino a eliminare la riga; rinomina e copertina segnano la bozza come modificata', async () => {
    const { store } = await ready();
    store.getState().addCard('TS1-003');
    store.getState().addCard('TS1-003');
    store.getState().removeCard('TS1-003', 'main');
    expect(store.getState().draft.cards).toEqual([{ cardId: 'TS1-003', board: 'main', quantity: 1 }]);
    store.getState().removeCard('TS1-003', 'main');
    store.getState().removeCard('TS1-003', 'main');
    expect(store.getState().draft.cards).toEqual([]);

    store.getState().newDraft();
    store.getState().rename('Fuoco');
    store.getState().setCover('TS1-005');
    expect(store.getState()).toMatchObject({ dirty: true, draft: { name: 'Fuoco', coverCardId: 'TS1-005' } });
    store.getState().newDraft();
    expect(store.getState()).toMatchObject({ dirty: false, draft: { id: null, name: NEW_DECK_NAME, coverCardId: null, cards: [] } });
  });

  it('selectValidation valida la bozza rispetto al catalogo', async () => {
    const { store } = await ready();
    store.getState().addCard('TS1-003');
    expect(selectValidation(store.getState())).toMatchObject({ isValid: false, mainCount: 1, issues: [{ code: 'MAIN_TOO_SMALL' }] });
  });
});

describe('createDeckStore — import, salvataggio, eliminazione', () => {
  it('importa una lista valida sostituendo le righe; con problemi non cambia la bozza', async () => {
    const { store, api } = await ready();
    store.getState().addCard('TS1-004');
    api.parseDeckList.mockResolvedValueOnce(ok({ entries: [], issues: [{ code: 'UNKNOWN_CARD', line: 2, text: 'Boh' }] }));
    expect(await store.getState().importList('2 Boh')).toEqual([{ code: 'UNKNOWN_CARD', line: 2, text: 'Boh' }]);
    expect(store.getState().draft.cards).toEqual([{ cardId: 'TS1-004', board: 'main', quantity: 1 }]);

    api.parseDeckList.mockResolvedValueOnce(ok({ entries: [{ cardId: 'TS1-003', quantity: 4, board: 'main' }], issues: [] }));
    expect(await store.getState().importList('4 Folletto di Prova')).toEqual([]);
    expect(store.getState().draft.cards).toEqual([{ cardId: 'TS1-003', quantity: 4, board: 'main' }]);
    expect(api.parseDeckList).toHaveBeenLastCalledWith('jwt-token', '4 Folletto di Prova');

    api.parseDeckList.mockResolvedValueOnce(apiError(500, 'INTERNAL_ERROR', 'Errore interno'));
    expect(await store.getState().importList('x')).toEqual([{ code: 'INVALID_LINE', line: 0, text: 'Errore interno' }]);
    expect(store.getState().error).toBe('Errore interno');
  });

  it('crea il mazzo al primo salvataggio con copertina predefinita, poi lo aggiorna', async () => {
    const { store, api } = await ready();
    store.getState().addCard('TS1-001');
    store.getState().addCard('TS1-003');
    store.getState().addCard('TS1-005');
    const id = await store.getState().save();
    expect(api.createDeck).toHaveBeenCalledWith('jwt-token', {
      name: NEW_DECK_NAME,
      coverCardId: 'TS1-005',
      cards: [
        { cardId: 'TS1-001', board: 'main', quantity: 1 },
        { cardId: 'TS1-003', board: 'main', quantity: 1 },
        { cardId: 'TS1-005', board: 'main', quantity: 1 },
      ],
    });
    expect(id).toBe(deckDetail().id);
    expect(store.getState()).toMatchObject({ dirty: false, saving: false, notice: 'Mazzo salvato come bozza incompleta.', draft: { id, coverCardId: 'TS1-005' } });

    store.getState().rename('Rinominato');
    await store.getState().save();
    expect(api.updateDeck).toHaveBeenCalledWith('jwt-token', id, expect.objectContaining({ name: 'Rinominato', coverCardId: 'TS1-005' }));
  });

  it('un mazzo da 60 valido viene salvato come valido', async () => {
    const { store } = await ready();
    for (let i = 0; i < 60; i += 1) store.getState().addCard('TS1-001');
    await store.getState().save();
    expect(store.getState().notice).toBe('Mazzo salvato.');
  });

  it('non salva con problemi bloccanti né quando il server rifiuta', async () => {
    const { store, api } = await ready();
    store.setState({ draft: { id: null, name: 'X', coverCardId: null, cards: [{ cardId: 'TS1-003', board: 'main', quantity: 5 }] } });
    expect(await store.getState().save()).toBeNull();
    expect(store.getState().error).toBe('Folletto di Prova: 5 copie, al massimo 4.');
    expect(api.createDeck).not.toHaveBeenCalled();

    store.getState().newDraft();
    api.createDeck.mockResolvedValueOnce(apiError(422, 'DECK_INVALID', 'Mazzo non valido'));
    expect(await store.getState().save()).toBeNull();
    expect(store.getState()).toMatchObject({ saving: false, error: 'Mazzo non valido' });
  });

  it('elimina un mazzo, azzerando la bozza se era aperta', async () => {
    const { store, api } = await ready();
    const summary = { id: deckDetail().id, name: 'A', format: 'standard' as const, coverCardId: null, updatedAt: '2026-11-09T10:00:00.000Z', mainCount: 4, sideboardCount: 0, isValid: false };
    store.setState({ decks: [summary] });
    await store.getState().openDeck(summary.id);
    expect(await store.getState().deleteDeck(summary.id)).toBe(true);
    expect(store.getState()).toMatchObject({ decks: [], draft: { id: null } });

    api.deleteDeck.mockResolvedValueOnce(apiError(404, 'NOT_FOUND', 'Risorsa non trovata.'));
    expect(await store.getState().deleteDeck('x')).toBe(false);
    expect(store.getState().error).toBe('Risorsa non trovata.');
    store.getState().clearMessages();
    expect(store.getState().error).toBeNull();
  });

  it('reset azzera catalogo, mazzi e bozza; cardImageUrl delega all\'API', async () => {
    const { store } = await ready();
    store.getState().addCard('TS1-003');
    store.getState().reset();
    expect(store.getState()).toMatchObject({ catalog: [], catalogStatus: 'idle', decks: [], dirty: false, draft: { cards: [] } });
    expect(store.getState().cardImageUrl('TS1-003', 'crop')).toBe('http://api.test/api/cards/TS1-003/image/crop');
  });
});

describe('defaultCoverCardId', () => {
  it('sceglie la carta non-Fonte più costosa del mazzo principale, o null', () => {
    const lookup = (id: string) => CARDS.find((c) => c.id === id);
    expect(defaultCoverCardId([{ cardId: 'TS1-003', board: 'main', quantity: 1 }, { cardId: 'TS1-004', board: 'main', quantity: 1 }], lookup)).toBe('TS1-003');
    expect(defaultCoverCardId([{ cardId: 'TS1-006', board: 'sideboard', quantity: 1 }, { cardId: 'TS1-001', board: 'main', quantity: 9 }, { cardId: 'XX1-001', board: 'main', quantity: 1 }], lookup)).toBeNull();
  });
});

describe('useDeckStore', () => {
  it('legge lo stato dentro il provider e lancia fuori', () => {
    const { store } = createTestDeckStore();
    const wrapper = ({ children }: { children: ReactNode }) => <DeckStoreProvider store={store}>{children}</DeckStoreProvider>;
    expect(renderHook(() => useDeckStore((s) => s.draft.name), { wrapper }).result.current).toBe(NEW_DECK_NAME);
    expect(() => renderHook(() => useDeckStore((s) => s.draft))).toThrow('useDeckStore deve essere usato dentro <DeckStoreProvider>');
  });
});
