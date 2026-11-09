/**
 * @nature [API]
 * @module ApiClient
 * @description Client REST tipizzato verso il server locale (auth, catalogo, mazzi): valida ogni risposta con gli schemi Zod condivisi e restituisce `Result`.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/desktop-client/tests/services/api-client.test.ts
 */
import { z } from 'zod';
import {
  ApiErrorResponseSchema,
  AuthResponseSchema,
  CardListResponseSchema,
  DeckDetailSchema,
  DeckListResponseSchema,
  ParseDeckListResponseSchema,
  GoogleResultResponseSchema,
  GoogleStartResponseSchema,
  PublicUserSchema,
  err,
  ok,
  type AuthResponse,
  type CardListResponse,
  type DeckDetail,
  type DeckListResponse,
  type GoogleResultResponse,
  type GoogleStartResponse,
  type LoginRequest,
  type ParseDeckListResponse,
  type PublicUser,
  type RegisterRequest,
  type Result,
  type SaveDeckRequest,
} from '@manaforge/shared';

/** URL predefinito del server locale (sovrascrivibile con `VITE_API_URL`). */
export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:47821';
/** Timeout di ogni richiesta. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Errore di una chiamata API. `status` vale 0 per errori di rete. */
export interface ApiError {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

/** Varianti delle illustrazioni servite dal server. */
export type CardImageVariant = 'normal' | 'crop';

/** Operazioni REST verso il server locale (autenticazione, catalogo, mazzi). */
export interface ApiClient {
  register(body: RegisterRequest): Promise<Result<AuthResponse, ApiError>>;
  login(body: LoginRequest): Promise<Result<AuthResponse, ApiError>>;
  me(token: string): Promise<Result<PublicUser, ApiError>>;
  googleStart(): Promise<Result<GoogleStartResponse, ApiError>>;
  googleResult(state: string): Promise<Result<GoogleResultResponse, ApiError>>;
  listCards(token: string): Promise<Result<CardListResponse, ApiError>>;
  listDecks(token: string): Promise<Result<DeckListResponse, ApiError>>;
  getDeck(token: string, deckId: string): Promise<Result<DeckDetail, ApiError>>;
  createDeck(token: string, body: SaveDeckRequest): Promise<Result<DeckDetail, ApiError>>;
  updateDeck(token: string, deckId: string, body: SaveDeckRequest): Promise<Result<DeckDetail, ApiError>>;
  deleteDeck(token: string, deckId: string): Promise<Result<undefined, ApiError>>;
  parseDeckList(token: string, text: string): Promise<Result<ParseDeckListResponse, ApiError>>;
  /** URL dell'illustrazione di una carta (rotta pubblica, usabile in `<img src>`). */
  cardImageUrl(cardId: string, variant: CardImageVariant): string;
}

/** Opzioni di {@link createApiClient}. */
export interface ApiClientOptions {
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
}

const NETWORK_ERROR: ApiError = {
  status: 0,
  code: 'NETWORK_ERROR',
  message: 'Server locale non raggiungibile. Riavvia Manaforge e riprova.',
};

const readJson = async (res: Response): Promise<unknown> => {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
};

/**
 * Crea il client API.
 *
 * @param options - URL base e `fetch` iniettabile.
 * @returns L'{@link ApiClient}.
 */
export const createApiClient = ({ baseUrl = DEFAULT_API_BASE_URL, fetch = globalThis.fetch.bind(globalThis) }: ApiClientOptions = {}): ApiClient => {
  const request = async <S extends z.ZodType>(
    path: string,
    schema: S,
    init: RequestInit = {},
  ): Promise<Result<z.infer<S>, ApiError>> => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      return err(NETWORK_ERROR);
    }
    const json = await readJson(res);
    if (!res.ok) {
      const apiError = ApiErrorResponseSchema.safeParse(json);
      return err(
        apiError.success
          ? { status: res.status, ...apiError.data.error }
          : { status: res.status, code: 'HTTP_ERROR', message: `Errore del server (${res.status}).` },
      );
    }
    const parsed = schema.safeParse(json);
    return parsed.success
      ? ok(parsed.data)
      : err({ status: res.status, code: 'INVALID_RESPONSE', message: 'Risposta del server non valida.' });
  };

  const postJson = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  const withToken = (token: string, method: string, body?: unknown): RequestInit =>
    body === undefined
      ? { method, headers: bearer(token) }
      : { method, headers: { ...bearer(token), 'content-type': 'application/json' }, body: JSON.stringify(body) };
  const deckPath = (deckId: string) => `/api/decks/${encodeURIComponent(deckId)}`;

  return {
    register: (body) => request('/api/auth/register', AuthResponseSchema, postJson(body)),
    login: (body) => request('/api/auth/login', AuthResponseSchema, postJson(body)),
    me: (token) => request('/api/auth/me', PublicUserSchema, { headers: bearer(token) }),
    googleStart: () => request('/api/auth/google/start', GoogleStartResponseSchema),
    googleResult: (state) => request(`/api/auth/google/result?state=${encodeURIComponent(state)}`, GoogleResultResponseSchema),
    listCards: (token) => request('/api/cards', CardListResponseSchema, withToken(token, 'GET')),
    listDecks: (token) => request('/api/decks', DeckListResponseSchema, withToken(token, 'GET')),
    getDeck: (token, deckId) => request(deckPath(deckId), DeckDetailSchema, withToken(token, 'GET')),
    createDeck: (token, body) => request('/api/decks', DeckDetailSchema, withToken(token, 'POST', body)),
    updateDeck: (token, deckId, body) => request(deckPath(deckId), DeckDetailSchema, withToken(token, 'PUT', body)),
    deleteDeck: (token, deckId) => request(deckPath(deckId), z.undefined(), withToken(token, 'DELETE')),
    parseDeckList: (token, text) => request('/api/decks/parse', ParseDeckListResponseSchema, withToken(token, 'POST', { text })),
    cardImageUrl: (cardId, variant) => `${baseUrl}/api/cards/${encodeURIComponent(cardId)}/image/${variant}`,
  };
};
