# [TEST] 02 — Integration test del database

- **Step:** 1.2 · **Progetto Vitest:** `server`

| File | Copre |
|---|---|
| `apps/server/tests/db/db-schema.test.ts` | CRUD su DB in-memory per tutte le tabelle, default, JSON, UNIQUE, CHECK, FK, cascate, `updated_at`, metadati FK |
| `apps/server/tests/db/db-client.test.ts` | DB su file in cartella temporanea: creazione cartelle, WAL, idempotenza migrazioni, errori `DB_OPEN_FAILED` / `DB_MIGRATION_FAILED` |
| `apps/server/tests/db/db-paths.test.ts` | percorsi `~/.manaforge`, rifiuto di home vuote o relative |

Ogni test apre un database nuovo (`:memory:` o file in `os.tmpdir()`) e lo chiude o elimina: nessuno stato condiviso.

Esecuzione: `pnpm vitest run --project server`.
