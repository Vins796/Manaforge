# [API] 01 — Autenticazione (manuale + Google OAuth2)

- **Step:** 1.3 · **Codice:** `apps/server/src/{auth,routes}/`, `packages/shared/src/schemas/auth.ts` · **Test:** `apps/server/tests/routes/auth.test.ts`

## Endpoint
Formato errori uniforme: `{ "error": { "code": string, "message": string } }`.

| Metodo e percorso | Corpo / query | Successo | Errori |
|---|---|---|---|
| `POST /api/auth/register` | `RegisterRequest` `{ email, username, password }` | **201** `AuthResponse` | 400 `VALIDATION_ERROR`, 409 `EMAIL_TAKEN`, 429 `RATE_LIMITED` |
| `POST /api/auth/login` | `LoginRequest` `{ email, password }` | **200** `AuthResponse` | 400, **401 `INVALID_CREDENTIALS`**, 429 |
| `GET /api/auth/me` | header `Authorization: Bearer <jwt>` | **200** `PublicUser` | 401 `UNAUTHORIZED` |
| `GET /api/auth/google/start` | — | **200** `{ authUrl, state }` | 503 `GOOGLE_NOT_CONFIGURED` |
| `GET /api/auth/google/callback` | `?state&code` o `?state&error` (aperto dal browser di sistema) | **200** pagina HTML "Accesso completato" | 400 pagina HTML con il motivo |
| `GET /api/auth/google/result` | `?state` | `{status:'pending'}` · `{status:'complete', auth}` (una sola volta) · `{status:'error', code}` | 400, 404 `GOOGLE_STATE_INVALID`, 503 |

`AuthResponse = { token, expiresAt (ISO), user: PublicUser }`; `PublicUser = { id, email, username, avatar, hasPassword, hasGoogle }`.

## Regole di validazione (Zod, condivise client/server)
- Email: `trim` + minuscole, formato email, ≤ 254.
- Username: 3–24 caratteri, solo lettere, cifre, spazio, `_`, `-`.
- Password registrazione: 8–128 caratteri. Login: 1–128 (non rivela le regole).
- Oggetti `strict`: campi sconosciuti → 400.

## Flusso Google (desktop, RFC 8252)
```
client ── GET /google/start ─────────────► server: state + code_verifier (TTL 10 min, max 50)
client ── apre authUrl nel browser di sistema (solo https)
browser ─ consenso Google ─► GET /google/callback?state&code ─► server:
          state a uso singolo → POST token (code_verifier) → GET userinfo → loginWithGoogle → risultato salvato per state
client ── GET /google/result?state ogni 1,5 s ─► complete → JWT salvato
```
Regole di collegamento account: stesso `googleId` → accesso; email esistente senza Google **e email verificata** → collegamento;
email già collegata ad altro Google → `GOOGLE_ACCOUNT_CONFLICT`; email non verificata → `GOOGLE_EMAIL_NOT_VERIFIED`.

## Sicurezza
| Misura | Dove |
|---|---|
| Argon2id m=19456 KiB, t=2, p=1 (OWASP) | `auth/password.ts` |
| Tempo costante per email inesistente (verifica fittizia) e stesso 401 | `auth-service.ts` |
| JWT HS256, issuer/audience fissi, `algorithms: ['HS256']`, scadenza 7 giorni | `auth/token-service.ts` |
| Segreto 64 byte, file 0600 creato con `wx` (mai sovrascritto) | `auth/jwt-secret.ts` |
| Rate limit 10 richieste/min per IP su register/login | `routes/auth.ts` |
| PKCE S256, state casuale 256 bit a uso singolo, TTL 10 min, store limitato | `auth/google-oauth.ts`, `auth/expiring-store.ts` |
| Server solo su `127.0.0.1`, CORS a whitelist, body ≤ 16 KiB, errori 500 senza dettagli | `config.ts`, `app.ts` |
| Client: CSP senza `eval` (Zod `jitless`), solo URL `https:` aperti esternamente | `index.html`, `zod-config.ts`, `external-browser.ts` |

## Limiti noti
- Il JWT è salvato in `localStorage` del WebView: protetto dalla CSP (nessuno script esterno), non da `httpOnly`.
  Alternativa più forte allo step 4.3: archiviazione tramite keyring del sistema (plugin Tauri).
- I token non sono revocabili prima della scadenza (nessuna blacklist); il logout cancella il token lato client.
