# TEST-001 — Setup Vitest multi-progetto e smoke test

- **Step:** 1.1 · **Runner:** Vitest 5 + `@vitest/coverage-v8`

## Struttura
- `vitest.config.ts` definisce un progetto per package (`shared`, `cards`, `engine`, `ai`, `net`, `db`), ambiente `node`.
- Test in `packages/<pkg>/test/**/*.test.ts`; alias `@manaforge/<pkg>` → sorgenti TS.
- Copertura v8 su `packages/*/src/**`, soglia globale 80% (le soglie per-package più alte di AGENT_RULES §4 si applicano in review e verranno codificate quando i package avranno codice reale).

## Comandi
| Comando | Effetto |
|---|---|
| `npm test` | tutti i progetti |
| `npx vitest run --project engine` | un solo package |
| `npm run test:coverage` | con copertura e soglie |
| `npm run verify` | `tsc -b` + test con copertura (gate di fine step) |

## Suite presenti
| File | Copre |
|---|---|
| `packages/*/test/smoke.test.ts` | wiring di ogni package nel runner |
| `packages/shared/test/result.test.ts` | `ok`, `err`, `mapResult`, `andThen`, `unwrap` |
