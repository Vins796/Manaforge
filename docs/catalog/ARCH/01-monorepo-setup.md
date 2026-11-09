# [ARCH] 01 — Setup monorepo pnpm, TypeScript e Vitest

- **Stato:** Accettato · **Step:** 1.1 · **Data:** 2026-11-09

## Decisione
- **pnpm workspaces** (`pnpm-workspace.yaml`): `packages/shared`, `packages/engine`, `apps/server`, `apps/desktop-client`.
  Versione fissata con `packageManager: pnpm@10.28.0`; Node ≥ 22 (`.nvmrc`).
- **TypeScript 7** con `tsconfig.base.json` condiviso (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `NodeNext`) e **project references** (`tsconfig.json` root) → `pnpm typecheck` = `tsc -b`.
  Il client aggiunge `DOM` a `lib`; il server aggiunge i tipi `node`.
- **Vitest 5** multi-progetto (`vitest.config.ts`), un progetto per workspace; gli import `@manaforge/*` sono risolti
  via alias ai sorgenti TS, quindi i test non richiedono build.
- Dipendenze interne via protocollo `workspace:*`; grafo: `shared ← engine ← server`, `shared ← desktop-client`.

## Elementi creati
| File | Natura | Ruolo |
|---|---|---|
| `packages/shared/src/types/result.ts` | ARCH | `Result<T,E>`, `ok`, `err`, `mapResult`, `andThen`, `unwrap` |
| `packages/shared/src/constants/game.ts` | RULE | vita iniziale, mano, limiti mazzo, `PHASES` |
| `packages/shared/src/constants/affinities.ts` | RULE | codici e nomi delle affinità, `isAffinityCode` |
| `packages/engine/src/index.ts` | ARCH | barrel (moduli dalla Fase 3) |
| `apps/server/src/index.ts` | ARCH | `getServerInfo` (Fastify dallo step 1.2–1.3) |
| `apps/desktop-client/src/app-info.ts` | UI | `buildWindowTitle` (React/Tauri dallo step 1.3) |

Le sottocartelle definite in `.cursorrules §1` esistono con `.gitkeep` finché non ricevono codice.

## Alternative considerate
- *npm workspaces*: usato nella prima bozza, sostituito da pnpm su indicazione del brief (store deduplicato, `workspace:*`).
- *Turborepo/Nx*: non necessari alla scala attuale.

## Comandi
`pnpm install` · `pnpm typecheck` · `pnpm test` · `pnpm verify` (gate di fine step).
