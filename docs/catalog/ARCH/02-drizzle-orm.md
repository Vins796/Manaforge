# [ARCH] 02 — Drizzle ORM + better-sqlite3 per il database locale

- **Stato:** Accettato · **Step:** 1.2 · **Data:** 2026-11-09

## Contesto
Il server locale gira come sidecar di Tauri (binario Node). Serve un accesso a SQLite tipizzato, con migrazioni
versionate, leggero da distribuire su Windows e Linux.

## Decisione
- **Drizzle ORM 0.45** con driver **better-sqlite3 13** (API sincrona, la più veloce per SQLite in Node).
- Schema in TypeScript (`apps/server/src/db/db-schema.ts`), migrazioni SQL generate da **drizzle-kit 0.31** in
  `apps/server/drizzle/` e applicate da `openDatabase()` all'avvio (tabella `__drizzle_migrations`).
- La cartella `apps/server/prisma/` del brief è sostituita da `apps/server/drizzle/` (`.cursorrules §1` aggiornato).
- `pnpm.onlyBuiltDependencies` nel `package.json` root autorizza gli script di build solo per `better-sqlite3` ed `esbuild`.

## Alternative considerate
| Opzione | Motivo dello scarto |
|---|---|
| Prisma | Query engine/CLI più pesanti da includere nel sidecar; generazione del client come step extra |
| `node:sqlite` | Ancora sperimentale in Node 22 |
| libSQL | Funzionalità remote non necessarie |

## Conseguenze
- better-sqlite3 13 include i binari precompilati per `win32-x64` e `linux-x64`: niente toolchain C++ sulle macchine di build.
- Modulo nativo: il packaging (step 4.3) deve copiare il file `.node` accanto all'eseguibile del sidecar.
- Ogni modifica allo schema richiede `pnpm --filter @manaforge/server db:generate --name <nome>` e il commit della migrazione.
