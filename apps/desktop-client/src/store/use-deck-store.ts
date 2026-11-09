/**
 * @nature [UI]
 * @module DeckStore
 * @description Store Zustand di collezione e deckbuilder: catalogo carte, elenco mazzi e bozza in modifica (aggiunte con limiti, import testuale, salvataggio).
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/store/use-deck-store.test.tsx
 */
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  MAX_COPIES_PER_CARD,
  MAX_SIDEBOARD_SIZE,
  describeDeckIssue,
  isBasicSource,
  validateDeck,
  type CardView,
  type DeckBoard,
  type DeckEntry,
  type DeckListIssue,
  type DeckSummary,
  type DeckValidation,
} from '@manaforge/shared';
import type { ApiClient, ApiError } from '../services/api-client.js';

/** Nome proposto per un nuovo mazzo. */
export const NEW_DECK_NAME = 'Nuovo mazzo';

/** Stato di caricamento di una risorsa remota. */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Mazzo in modifica nel deckbuilder. */
export interface DeckDraft {
  /** `null` finché il mazzo non è stato salvato la prima volta. */
  readonly id: string | null;
  readonly name: string;
  readonly coverCardId: string | null;
  readonly cards: readonly DeckEntry[];
}

/** Stato e azioni dello store. */
export interface DeckState {
  readonly catalog: readonly CardView[];
  readonly catalogStatus: LoadStatus;
  readonly decks: readonly DeckSummary[];
  readonly decksStatus: LoadStatus;
  readonly draft: DeckDraft;
  readonly draftStatus: LoadStatus;
  /** La bozza ha modifiche non salvate. */
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  /** Messaggio informativo temporaneo (es. limite di copie raggiunto). */
  readonly notice: string | null;
  /** URL dell'illustrazione di una carta. */
  cardImageUrl: ApiClient['cardImageUrl'];
  loadCatalog(): Promise<void>;
  loadDecks(): Promise<void>;
  newDraft(): void;
  openDeck(deckId: string): Promise<boolean>;
  /** Aggiunge una copia; `false` (con `notice`) se un limite lo impedisce. */
  addCard(cardId: string, board?: DeckBoard): boolean;
  removeCard(cardId: string, board: DeckBoard): void;
  /** Sposta una copia tra mazzo e riserva; `false` se la riserva è piena. */
  moveCard(cardId: string, from: DeckBoard): boolean;
  rename(name: string): void;
  setCover(cardId: string | null): void;
  /** Importa una lista testuale sostituendo le righe della bozza; restituisce i problemi (vuoto = riuscito). */
  importList(text: string): Promise<readonly DeckListIssue[]>;
  /** Salva la bozza (crea o aggiorna); restituisce l'id del mazzo o `null`. */
  save(): Promise<string | null>;
  deleteDeck(deckId: string): Promise<boolean>;
  clearMessages(): void;
  /** Azzera tutto (es. al logout, per non mostrare i mazzi di un altro utente). */
  reset(): void;
}

/** Dipendenze dello store. */
export interface DeckStoreDeps {
  readonly api: ApiClient;
  /** Token della sessione corrente (letto a ogni chiamata). */
  readonly getToken: () => string | null;
}

const emptyDraft = (): DeckDraft => ({ id: null, name: NEW_DECK_NAME, coverCardId: null, cards: [] });

const NO_SESSION: ApiError = { status: 401, code: 'UNAUTHORIZED', message: 'Sessione mancante o scaduta.' };

/**
 * Valida la bozza rispetto al catalogo caricato.
 *
 * @param state - Stato con catalogo e bozza.
 * @returns L'esito delle regole di costruzione.
 */
export const selectValidation = (state: Pick<DeckState, 'catalog' | 'draft'>): DeckValidation => {
  const byId = new Map(state.catalog.map((card) => [card.id, card]));
  return validateDeck(state.draft.cards, (id) => byId.get(id));
};

/**
 * Copie totali di una carta nella bozza (mazzo + riserva).
 *
 * @param cards - Righe della bozza.
 * @param cardId - Carta.
 * @returns Il numero di copie.
 */
export const copiesOf = (cards: readonly DeckEntry[], cardId: string): number =>
  cards.reduce((total, entry) => (entry.cardId === cardId ? total + entry.quantity : total), 0);

/**
 * Copertina predefinita: la carta non-Fonte di valore di mana più alto nel mazzo principale (a parità, per nome).
 *
 * @param cards - Righe della bozza.
 * @param lookup - Risoluzione delle carte.
 * @returns L'id della carta, o `null` se il mazzo non ne contiene.
 */
export const defaultCoverCardId = (cards: readonly DeckEntry[], lookup: (cardId: string) => CardView | undefined): string | null => {
  const candidates = cards
    .filter((entry) => entry.board === 'main')
    .flatMap((entry) => {
      const card = lookup(entry.cardId);
      return card && !card.typeLine.startsWith('Fonte') ? [card] : [];
    })
    .sort((a, b) => b.manaValue - a.manaValue || a.name.localeCompare(b.name, 'it'));
  return candidates[0]?.id ?? null;
};

const boardCount = (cards: readonly DeckEntry[], board: DeckBoard): number =>
  cards.reduce((total, entry) => (entry.board === board ? total + entry.quantity : total), 0);

const changeQuantity = (cards: readonly DeckEntry[], cardId: string, board: DeckBoard, delta: number): DeckEntry[] => {
  const index = cards.findIndex((entry) => entry.cardId === cardId && entry.board === board);
  if (index === -1) return delta > 0 ? [...cards, { cardId, board, quantity: delta }] : [...cards];
  const quantity = (cards[index]?.quantity ?? 0) + delta;
  return quantity > 0
    ? cards.map((entry, i) => (i === index ? { ...entry, quantity } : entry))
    : cards.filter((_, i) => i !== index);
};

/**
 * Crea uno store del deckbuilder indipendente.
 *
 * @param deps - Client API e lettore del token.
 * @returns Lo store vanilla Zustand.
 */
export const createDeckStore = ({ api, getToken }: DeckStoreDeps): StoreApi<DeckState> =>
  createStore<DeckState>()((set, get) => {
    const withToken = async <T>(call: (token: string) => Promise<{ ok: true; value: T } | { ok: false; error: ApiError }>) => {
      const token = getToken();
      return token ? call(token) : ({ ok: false, error: NO_SESSION } as const);
    };
    const cardById = (cardId: string) => get().catalog.find((card) => card.id === cardId);
    const updateDraft = (cards: DeckEntry[]) => set({ draft: { ...get().draft, cards }, dirty: true, notice: null });

    const initial = () => ({
      catalog: [],
      catalogStatus: 'idle' as const,
      decks: [],
      decksStatus: 'idle' as const,
      draft: emptyDraft(),
      draftStatus: 'ready' as const,
      dirty: false,
      saving: false,
      error: null,
      notice: null,
    });

    return {
      ...initial(),
      cardImageUrl: (cardId, variant) => api.cardImageUrl(cardId, variant),

      async loadCatalog() {
        if (get().catalogStatus === 'loading' || get().catalogStatus === 'ready') return;
        set({ catalogStatus: 'loading' });
        const result = await withToken((token) => api.listCards(token));
        set(result.ok ? { catalog: result.value.cards, catalogStatus: 'ready' } : { catalogStatus: 'error', error: result.error.message });
      },

      async loadDecks() {
        set({ decksStatus: 'loading' });
        const result = await withToken((token) => api.listDecks(token));
        set(result.ok ? { decks: result.value.decks, decksStatus: 'ready' } : { decksStatus: 'error', error: result.error.message });
      },

      newDraft() {
        set({ draft: emptyDraft(), draftStatus: 'ready', dirty: false, error: null, notice: null });
      },

      async openDeck(deckId) {
        set({ draftStatus: 'loading', error: null, notice: null });
        const result = await withToken((token) => api.getDeck(token, deckId));
        if (!result.ok) {
          set({ draftStatus: 'error', error: result.error.message });
          return false;
        }
        const { id, name, coverCardId, cards } = result.value;
        set({ draft: { id, name, coverCardId, cards }, draftStatus: 'ready', dirty: false });
        return true;
      },

      addCard(cardId, board = 'main') {
        const card = cardById(cardId);
        if (!card) return false;
        const { cards } = get().draft;
        if (!isBasicSource(card) && copiesOf(cards, cardId) >= MAX_COPIES_PER_CARD) {
          set({ notice: `${card.name}: hai già ${MAX_COPIES_PER_CARD} copie.` });
          return false;
        }
        if (board === 'sideboard' && boardCount(cards, 'sideboard') >= MAX_SIDEBOARD_SIZE) {
          set({ notice: `La riserva è piena (${MAX_SIDEBOARD_SIZE} carte).` });
          return false;
        }
        updateDraft(changeQuantity(cards, cardId, board, 1));
        return true;
      },

      removeCard(cardId, board) {
        updateDraft(changeQuantity(get().draft.cards, cardId, board, -1));
      },

      moveCard(cardId, from) {
        const to: DeckBoard = from === 'main' ? 'sideboard' : 'main';
        const { cards } = get().draft;
        if (to === 'sideboard' && boardCount(cards, 'sideboard') >= MAX_SIDEBOARD_SIZE) {
          set({ notice: `La riserva è piena (${MAX_SIDEBOARD_SIZE} carte).` });
          return false;
        }
        updateDraft(changeQuantity(changeQuantity(cards, cardId, from, -1), cardId, to, 1));
        return true;
      },

      rename(name) {
        set({ draft: { ...get().draft, name }, dirty: true });
      },

      setCover(cardId) {
        set({ draft: { ...get().draft, coverCardId: cardId }, dirty: true });
      },

      async importList(text) {
        set({ error: null, notice: null });
        const result = await withToken((token) => api.parseDeckList(token, text));
        if (!result.ok) {
          set({ error: result.error.message });
          return [{ code: 'INVALID_LINE', line: 0, text: result.error.message }];
        }
        if (result.value.issues.length > 0) return result.value.issues;
        updateDraft(result.value.entries);
        return [];
      },

      async save() {
        const { draft } = get();
        const validation = selectValidation(get());
        const blocking = validation.issues.find((issue) => issue.code !== 'MAIN_TOO_SMALL');
        if (blocking) {
          set({ error: describeDeckIssue(blocking) });
          return null;
        }
        set({ saving: true, error: null, notice: null });
        const cover = draft.coverCardId ?? defaultCoverCardId(draft.cards, cardById);
        const body = { name: draft.name, coverCardId: cover, cards: [...draft.cards] };
        const result = await withToken((token) => (draft.id ? api.updateDeck(token, draft.id, body) : api.createDeck(token, body)));
        if (!result.ok) {
          set({ saving: false, error: result.error.message });
          return null;
        }
        const { id, name, coverCardId, cards } = result.value;
        set({
          saving: false,
          dirty: false,
          draft: { id, name, coverCardId, cards },
          notice: validation.isValid ? 'Mazzo salvato.' : 'Mazzo salvato come bozza incompleta.',
        });
        return id;
      },

      async deleteDeck(deckId) {
        const result = await withToken((token) => api.deleteDeck(token, deckId));
        if (!result.ok) {
          set({ error: result.error.message });
          return false;
        }
        set({ decks: get().decks.filter((deck) => deck.id !== deckId) });
        if (get().draft.id === deckId) get().newDraft();
        return true;
      },

      clearMessages() {
        set({ error: null, notice: null });
      },

      reset() {
        set(initial());
      },
    };
  });

const DeckStoreContext = createContext<StoreApi<DeckState> | null>(null);

/** Props di {@link DeckStoreProvider}. */
export interface DeckStoreProviderProps {
  readonly store: StoreApi<DeckState>;
  readonly children?: ReactNode;
}

/**
 * Rende disponibile lo store del deckbuilder ai componenti discendenti.
 *
 * @param props - Store da esporre e figli.
 * @returns Il provider React.
 */
export const DeckStoreProvider = ({ store, children }: DeckStoreProviderProps) =>
  createElement(DeckStoreContext.Provider, { value: store }, children);

/**
 * Legge una porzione dello stato del deckbuilder.
 *
 * @param selector - Selettore dello stato.
 * @returns Il valore selezionato.
 * @throws Error se usato fuori da {@link DeckStoreProvider}.
 */
export const useDeckStore = <T>(selector: (state: DeckState) => T): T => {
  const store = useContext(DeckStoreContext);
  if (!store) throw new Error('useDeckStore deve essere usato dentro <DeckStoreProvider>');
  return useStore(store, selector);
};
