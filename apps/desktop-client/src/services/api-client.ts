/**
 * @nature [API]
 * @module ApiClient
 * @description Client REST tipizzato verso il server locale: valida ogni risposta con gli schemi Zod condivisi e restituisce `Result`.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/desktop-client/tests/services/api-client.test.ts
 */
import type { z } from 'zod';
import {
  ApiErrorResponseSchema,
  AuthResponseSchema,
  GoogleResultResponseSchema,
  GoogleStartResponseSchema,
  PublicUserSchema,
  err,
  ok,
  type AuthResponse,
  type GoogleResultResponse,
  type GoogleStartResponse,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
  type Result,
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

/** Operazioni REST di autenticazione. */
export interface ApiClient {
  register(body: RegisterRequest): Promise<Result<AuthResponse, ApiError>>;
  login(body: LoginRequest): Promise<Result<AuthResponse, ApiError>>;
  me(token: string): Promise<Result<PublicUser, ApiError>>;
  googleStart(): Promise<Result<GoogleStartResponse, ApiError>>;
  googleResult(state: string): Promise<Result<GoogleResultResponse, ApiError>>;
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

  return {
    register: (body) => request('/api/auth/register', AuthResponseSchema, postJson(body)),
    login: (body) => request('/api/auth/login', AuthResponseSchema, postJson(body)),
    me: (token) => request('/api/auth/me', PublicUserSchema, { headers: { authorization: `Bearer ${token}` } }),
    googleStart: () => request('/api/auth/google/start', GoogleStartResponseSchema),
    googleResult: (state) => request(`/api/auth/google/result?state=${encodeURIComponent(state)}`, GoogleResultResponseSchema),
  };
};
