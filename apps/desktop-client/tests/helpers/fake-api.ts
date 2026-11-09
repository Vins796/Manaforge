/**
 * @nature [TEST]
 * @module FakeApi
 * @description Doppi di test del client: ApiClient con mock vitest, storage in memoria, catalogo e mazzi di esempio, store pronti.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/store/use-auth-store.test.tsx
 */
import { vi } from 'vitest';
import { err, ok, validateDeck, type AuthResponse, type CardView, type DeckDetail, type DeckEntry, type Result } from '@manaforge/shared';
import type { ApiClient, ApiError } from '../../src/services/api-client.js';
import { createAuthStore, type AuthStoreDeps } from '../../src/store/use-auth-store.js';
import { createDeckStore } from '../../src/store/use-deck-store.js';

/** Risposta di autenticazione di esempio. */
export const AUTH: AuthResponse = {
  token: 'jwt-token',
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: 'u1', email: 'ada@example.com', username: 'Ada', avatar: 'forgiatore', hasPassword: true, hasGoogle: false },
};

/** Costruisce un errore API. */
export const apiError = (status: number, code: string, message = `errore ${code}`): Result<never, ApiError> =>
  err({ status, code, message });

/** Costruisce una carta di prova. */
export const card = (overrides: Partial<CardView> & Pick<CardView, 'id' | 'name'>): CardView => ({
  cost: '{1}',
  manaValue: 1,
  typeLine: 'Artefatto',
  rulesText: '',
  affinities: [],
  affinityIdentity: [],
  power: null,
  toughness: null,
  keywords: [],
  rarity: 'comune',
  ...overrides,
});

/** Catalogo di prova: Fonte base, Fonte, creatura Fiamma, Rapido Fiamma, creatura multi, Rituale Selva da 6. */
export const CARDS: readonly CardView[] = [
  card({ id: 'TS1-001', name: 'Fucina di Prova', cost: '', manaValue: 0, typeLine: 'Fonte base — Fiamma', rulesText: 'Esaurisci: aggiungi {F}.' }),
  card({ id: 'TS1-002', name: 'Pietra di Prova', cost: '', manaValue: 0, typeLine: 'Fonte', rulesText: 'Esaurisci: aggiungi {C}.' }),
  card({ id: 'TS1-003', name: 'Folletto di Prova', cost: '{F}', typeLine: 'Creatura — Folletto', affinities: ['F'], affinityIdentity: ['F'], power: 1, toughness: 1, keywords: ['SCATTO'] }),
  card({ id: 'TS1-004', name: 'Lampo di Prova', cost: '{F}', typeLine: 'Rapido', rulesText: 'Infligge 3 danni a qualsiasi bersaglio.', affinities: ['F'], affinityIdentity: ['F'] }),
  card({ id: 'TS1-005', name: 'Chimera di Prova', cost: '{2}{M}{F}', manaValue: 4, typeLine: 'Creatura — Chimera', affinities: ['M', 'F'], affinityIdentity: ['M', 'F'], power: 3, toughness: 3, rarity: 'rara' }),
  card({ id: 'TS1-006', name: 'Crescita di Prova', cost: '{5}{S}', manaValue: 6, typeLine: 'Rituale', rulesText: 'Cerca una carta.', affinities: ['S'], affinityIdentity: ['S'] }),
];

/** Mazzo salvato di prova. */
export const deckDetail = (cards: DeckEntry[] = [{ cardId: 'TS1-003', quantity: 4, board: 'main' }], overrides: Partial<DeckDetail> = {}): DeckDetail => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Mazzo di Prova',
  format: 'standard',
  coverCardId: null,
  updatedAt: '2026-11-09T10:00:00.000Z',
  cards,
  validation: validateDeck(cards, (id) => CARDS.find((c) => c.id === id)),
  ...overrides,
});

/** ApiClient in cui ogni metodo è un mock. */
export const createFakeApi = () => ({
  register: vi.fn<ApiClient['register']>().mockResolvedValue(ok(AUTH)),
  login: vi.fn<ApiClient['login']>().mockResolvedValue(ok(AUTH)),
  me: vi.fn<ApiClient['me']>().mockResolvedValue(ok(AUTH.user)),
  googleStart: vi.fn<ApiClient['googleStart']>().mockResolvedValue(ok({ authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1', state: 'st' })),
  googleResult: vi.fn<ApiClient['googleResult']>().mockResolvedValue(ok({ status: 'complete', auth: AUTH })),
  listCards: vi.fn<ApiClient['listCards']>().mockResolvedValue(ok({ cards: [...CARDS] })),
  listDecks: vi.fn<ApiClient['listDecks']>().mockResolvedValue(ok({ decks: [] })),
  getDeck: vi.fn<ApiClient['getDeck']>().mockResolvedValue(ok(deckDetail())),
  createDeck: vi.fn<ApiClient['createDeck']>().mockImplementation(async (_token, body) =>
    ok(deckDetail([...body.cards], { name: body.name, coverCardId: body.coverCardId ?? null })),
  ),
  updateDeck: vi.fn<ApiClient['updateDeck']>().mockImplementation(async (_token, id, body) =>
    ok(deckDetail([...body.cards], { id, name: body.name, coverCardId: body.coverCardId ?? null })),
  ),
  deleteDeck: vi.fn<ApiClient['deleteDeck']>().mockResolvedValue(ok(undefined)),
  parseDeckList: vi.fn<ApiClient['parseDeckList']>().mockResolvedValue(ok({ entries: [], issues: [] })),
  cardImageUrl: vi.fn<ApiClient['cardImageUrl']>((id, variant) => `http://api.test/api/cards/${id}/image/${variant}`),
});

/** Storage in memoria compatibile con `localStorage`. */
export const createMemoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void data.set(key, value)),
    removeItem: vi.fn((key: string) => void data.delete(key)),
    data,
  };
};

/**
 * Crea uno store del deckbuilder con API finta.
 *
 * @param token - Token restituito da `getToken`.
 * @returns Store e API.
 */
export const createTestDeckStore = (token: string | null = 'jwt-token') => {
  const api = createFakeApi();
  const store = createDeckStore({ api, getToken: () => token });
  return { store, api };
};

/** Crea uno store con dipendenze finte (sleep istantaneo). */
export const createTestStore = (overrides: Partial<AuthStoreDeps> = {}) => {
  const api = createFakeApi();
  const storage = createMemoryStorage();
  const openExternal = vi.fn(() => true);
  const store = createAuthStore({ api, storage, openExternal, sleep: async () => undefined, ...overrides });
  return { store, api, storage, openExternal };
};
