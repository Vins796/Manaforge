# ARCH-001 — Monorepo npm workspaces con package puri + app Electron

- **Stato:** Accettato · **Step:** 1.1 · **Data:** 2026-11-09

## Contesto
Il progetto ha un motore regole complesso che deve girare identico in tre contesti (partita vs bot nel main,
lockstep P2P su due client, test headless) e una UI Electron. Serve isolare la logica dal runtime.

## Decisione
- **npm workspaces** (nessun tool aggiuntivo): `packages/{shared,cards,engine,ai,net,db}` + `apps/desktop`.
- **TypeScript project references** (`tsconfig.json` root come solution, `tsconfig.base.json` condiviso, `composite`) → `npm run typecheck` = `tsc -b`.
- **Vitest multi-progetto** (`test.projects` in `vitest.config.ts`), un progetto per package; i package interni sono risolti via alias ai sorgenti `src/index.ts`, quindi i test non richiedono build.
- Grafo delle dipendenze aciclico: `shared ← cards ← engine ← ai`, `shared ← net`, `shared ← db`.

## Alternative considerate
- *pnpm/Nx/Turborepo*: più potenti ma aggiungono strumenti; non necessari alla scala attuale.
- *Singolo package*: impedisce di garantire che `engine` resti privo di I/O.

## Conseguenze
- Confini architetturali verificabili (`references` di TS + regola di review).
- Il package `apps/desktop` è un segnaposto fino allo step 1.4 (Electron).

## Codice e test
`package.json`, `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts`, `packages/*/test/smoke.test.ts`.
