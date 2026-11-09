# [TEST] 03 — Test di autenticazione (API + UI)

- **Step:** 1.3

## Server (`apps/server/tests/`, ambiente node)
| File | Copre |
|---|---|
| `routes/auth.test.ts` | **Test API richiesto dal piano:** registrazione (201/409/400), login valido (200 + `/me`), password errata (**401**, identico per email inesistente), JSON malformato, `/me` senza token o con token invalido, rate limit 429, **callback Google simulata** (start → pending → callback → complete una sola volta, annullamento, email non verificata, state invalido, Google non configurato) |
| `auth/auth-service.test.ts` | casi d'uso, corse sull'inserimento, collegamento Google, `deriveUsername` |
| `auth/google-oauth.test.ts` | vettore PKCE RFC 7636, parametri dell'URL, scambio del codice, state a uso singolo e scaduto, 5 modalità di fallimento di Google |
| `auth/password.test.ts`, `auth/token-service.test.ts`, `auth/jwt-secret.test.ts`, `auth/expiring-store.test.ts` | primitive di sicurezza |
| `auth/google-credentials.test.ts` | parsing del JSON di Google (desktop vs web, campi mancanti), aggiornamento del `.env`, permessi 0600, errori di I/O |
| `db/user-repository.test.ts` | query utenti, rilevamento violazioni UNIQUE |
| `app.test.ts`, `config.test.ts`, `server.test.ts` | CORS, 404, 413, 500 opaco; variabili d'ambiente; avvio reale su porta casuale, persistenza della sessione tra riavvii, errori di avvio |

Google è simulato iniettando `fetch` (`tests/helpers/test-context.ts`): nessuna chiamata di rete reale.

## Client (`apps/desktop-client/tests/`, ambiente jsdom + React Testing Library)
| File | Copre |
|---|---|
| `pages/LoginPage.test.tsx` | tab, validazione client, login e redirect, 401 mostrato in `alert`, registrazione con conferma password, Google con attesa/annullamento/completamento |
| `store/use-auth-store.test.tsx` | transizioni, persistenza, ripristino (valida, assente, malformata, scaduta, revocata, offline), polling Google, timeout, annullamento in due punti, storage che lancia |
| `App.test.tsx`, `pages/HomeHub.test.tsx` | guardia delle rotte, splash, logout |
| `services/*.test.ts`, `components/ui/*.test.tsx`, `zod-config.test.ts` | client REST, apertura sicura di URL, componenti, configurazione Zod |

## Verifica manuale end-to-end (Playwright, 2026-11-09)
Server compilato + `vite preview`: `/home` → `/login`, registrazione → `/home`, reload con sessione ripristinata,
logout, password errata → "Email o password non corretti.", Google senza Client ID → messaggio dedicato, **0 errori in console** (CSP inclusa).
