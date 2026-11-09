# [UI] 01 — Pagina di accesso e sessione

- **Step:** 1.3 · **Codice:** `apps/desktop-client/src/` · **Rotte:** `/login`, `/home` (protetta), `*` → `/home`

| Modulo | Ruolo | Test |
|---|---|---|
| `pages/LoginPage.tsx` | Tab Accedi/Registrati (ARIA `tablist`), validazione Zod lato client, conferma password, errore server in `role="alert"`, "Continua con Google" con stato di attesa e "Annulla" | `tests/pages/LoginPage.test.tsx` |
| `pages/HomeHub.tsx` | Home minima: barra superiore, benvenuto, "Esci" (dallo step 2.2 usa `TopNav` con link a Mazzi e Collezione; Play Blade nella Fase 4) | `tests/pages/HomeHub.test.tsx` |
| `App.tsx` | Provider dello store, `restore()` all'avvio, splash, guardia `RequireAuth`, router creato una sola volta | `tests/App.test.tsx` |
| `store/use-auth-store.ts` | Store Zustand vanilla iniettabile (`createAuthStore`), provider + hook `useAuthStore(selector)`; stati `restoring → anonymous ⇄ authenticating / awaiting-google → authenticated` | `tests/store/use-auth-store.test.tsx` |
| `services/api-client.ts` | `fetch` con timeout 10 s, risposte validate con Zod, errori come `Result` (`NETWORK_ERROR`, `HTTP_ERROR`, `INVALID_RESPONSE`) | `tests/services/api-client.test.ts` |
| `services/external-browser.ts` | Apre solo `https:` con `noopener,noreferrer` | `tests/services/external-browser.test.ts` |
| `components/ui/Button.tsx` | Varianti `cta` / `secondary` / `ghost`, `loading` con `aria-busy` | `tests/components/ui/Button.test.tsx` |
| `components/ui/TextField.tsx` | Etichetta collegata, errore via `aria-describedby` + `aria-invalid` | `tests/components/ui/TextField.test.tsx` |
| `zod-config.ts` | Zod `jitless` (CSP senza `eval`), importato per primo | `tests/zod-config.test.ts` |
| `styles.css` | Tailwind 4 `@theme` con i token del Design Brief, `prefers-reduced-motion` | — |

## Comportamenti
- Sessione persistita in `localStorage` (`manaforge.session`); al riavvio viene verificata con `/api/auth/me`.
  401 → sessione cancellata; server irraggiungibile → sessione conservata e messaggio di errore.
- Storage non disponibile (modalità privata, quota) → la sessione resta solo in memoria, nessun crash.
- Il logo è un marchio originale (cristallo esagonale su incudine) disegnato in SVG inline.

## Avvio in sviluppo
```bash
pnpm --filter @manaforge/server build && node apps/server/dist/main.js
pnpm --filter @manaforge/desktop-client dev    # http://localhost:5173
```

## Note
- I font `Cinzel` e `Inter` non sono ancora inclusi negli asset: si usano i fallback (`Georgia`, `system-ui`).
  Verranno aggiunti come file locali con licenza OFL (la CSP vieta font esterni).
