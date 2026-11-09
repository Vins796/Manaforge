# [TEST] 01 — Runner Vitest, smoke test e regola 1-a-1

- **Step:** 1.1 · **Runner:** Vitest 5.1 + `@vitest/coverage-v8`

## Progetti
| Progetto | Root | Ambiente |
|---|---|---|
| `shared` | `packages/shared` | node |
| `engine` | `packages/engine` | node |
| `server` | `apps/server` | node |
| `desktop-client` | `apps/desktop-client` | jsdom + React Testing Library (`tests/setup.ts`, plugin React) |

Test in `tests/**/*.test.{ts,tsx}` di ciascun workspace.

## Soglie di copertura
Globale ≥ 80% (righe, funzioni, branch, statement); `packages/engine/src/**` = **100%**.

## Regola 1-a-1
Ogni file `src/**` ha il test allo stesso percorso relativo in `tests/` (elenco completo dei file degli step 1.2–1.3 in `TEST/02` e `TEST/03`).

### Mappatura dello step 1.1
| Sorgente | Test |
|---|---|
| `packages/shared/src/types/result.ts` | `packages/shared/tests/types/result.test.ts` |
| `packages/shared/src/constants/game.ts` | `packages/shared/tests/constants/game.test.ts` |
| `packages/shared/src/constants/affinities.ts` | `packages/shared/tests/constants/affinities.test.ts` |
| `packages/shared/src/index.ts` | `packages/shared/tests/smoke.test.ts` |
| `packages/engine/src/index.ts` | `packages/engine/tests/smoke.test.ts` |
| `apps/server/src/index.ts` | `apps/server/tests/smoke.test.ts` |
| `apps/server/src/db/db-schema.ts` | `apps/server/tests/db/db-schema.test.ts` |
| `apps/server/src/db/db-client.ts` | `apps/server/tests/db/db-client.test.ts` |
| `apps/server/src/db/db-paths.ts` | `apps/server/tests/db/db-paths.test.ts` |
| `apps/desktop-client/src/app-info.ts` | `apps/desktop-client/tests/app-info.test.ts` (+ `smoke.test.ts`) |

## Comandi
`pnpm test` · `pnpm vitest run --project engine` · `pnpm test:coverage` · `pnpm verify`
