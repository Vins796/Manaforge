/**
 * @nature [TEST]
 * @module TestContext
 * @description Fixture condivise dei test del server: DB in-memory, servizi reali e fetch Google simulato.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/routes/auth.test.ts
 */
import { unwrap } from '@manaforge/shared';
import { createAuthService, type AuthService } from '../../src/auth/auth-service.js';
import { createTokenService, type TokenService } from '../../src/auth/token-service.js';
import { IN_MEMORY, openDatabase, type DatabaseConnection } from '../../src/db/db-client.js';
import { createUserRepository, type UserRepository } from '../../src/db/user-repository.js';

/** Segreto JWT deterministico per i test (64 byte). */
export const TEST_SECRET = new Uint8Array(64).fill(7);

/** Servizi reali collegati a un DB in-memory. */
export interface TestContext {
  readonly conn: DatabaseConnection;
  readonly users: UserRepository;
  readonly tokens: TokenService;
  readonly auth: AuthService;
}

/**
 * Crea un contesto di test isolato.
 *
 * @returns DB in-memory migrato e servizi pronti; chiudere `conn` a fine test.
 */
export const createTestContext = (): TestContext => {
  const conn = unwrap(openDatabase({ filename: IN_MEMORY }));
  const users = createUserRepository(conn.db);
  const tokens = createTokenService({ secret: TEST_SECRET });
  return { conn, users, tokens, auth: createAuthService({ users, tokens }) };
};

/** Profilo restituito dal finto endpoint userinfo. */
export interface FakeGoogleUser {
  readonly sub: string;
  readonly email: string;
  readonly email_verified?: boolean;
  readonly name?: string;
}

/** Richiesta registrata dal finto `fetch`. */
export interface RecordedRequest {
  readonly url: string;
  readonly body: string | undefined;
  readonly authorization: string | undefined;
}

/**
 * Crea un `fetch` che simula gli endpoint token e userinfo di Google.
 *
 * @param user - Profilo da restituire; `undefined` simula il rifiuto del codice.
 * @returns Il finto `fetch` e l'elenco delle richieste ricevute.
 */
export const createFakeGoogleFetch = (user: FakeGoogleUser | undefined) => {
  const requests: RecordedRequest[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(init?.headers);
    requests.push({
      url,
      body: init?.body === undefined || init.body === null ? undefined : String(init.body),
      authorization: headers.get('authorization') ?? undefined,
    });
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return user
        ? Response.json({ access_token: 'google-access-token', token_type: 'Bearer' })
        : Response.json({ error: 'invalid_grant' }, { status: 400 });
    }
    if (url.startsWith('https://openidconnect.googleapis.com/v1/userinfo')) {
      return Response.json(user);
    }
    return new Response('not found', { status: 404 });
  };
  return { fetch, requests };
};
