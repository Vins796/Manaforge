# [DATA] 01 — Schema SQLite locale

- **Step:** 1.2 · **Codice:** `apps/server/src/db/` · **Migrazione:** `apps/server/drizzle/0000_init.sql`

## Moduli
| File | Responsabilità | Test |
|---|---|---|
| `db-schema.ts` | tabelle Drizzle, enum, tipi `User`/`NewUser`… | `tests/db/db-schema.test.ts` |
| `db-client.ts` | `openDatabase({ filename, migrationsDir? })` → `Result<DatabaseConnection, DatabaseOpenError>` | `tests/db/db-client.test.ts` |
| `db-paths.ts` | `resolveDataPaths(homeDir)` → percorsi `~/.manaforge/{data/manaforge.db, cache/images}` | `tests/db/db-paths.test.ts` |

## Tabelle
| Tabella | Chiave | Colonne principali | Vincoli e indici |
|---|---|---|---|
| `users` | `id` uuid | `email`, `username`, `password_hash?`, `google_id?`, `avatar`='forgiatore', `created_at` | UNIQUE `email`, UNIQUE `google_id` |
| `cards` | `id` codice (`MF1-042`) | `name`, `cost`, `mana_value`, `type_line`, `rules_text`, `affinities` JSON, `affinity_identity` JSON, `power?`, `toughness?`, `keywords` JSON='[]', `rarity`, `art_seed`, `local_image_*_path?`, `catalog_version` | CHECK `mana_value >= 0`, CHECK rarità; indici su `name`, `mana_value`, `type_line` |
| `decks` | `id` uuid | `user_id`, `name`, `format`='standard', `cover_card_id?`, `updated_at` (aggiornato a ogni UPDATE) | FK `user_id` CASCADE, FK `cover_card_id` SET NULL, CHECK nome 1–40 caratteri, indice `user_id` |
| `deck_cards` | `id` uuid | `deck_id`, `card_id`, `quantity`, `board` ('main'\|'sideboard') | FK `deck_id` CASCADE, FK `card_id` RESTRICT, CHECK `quantity > 0`, CHECK `board`, UNIQUE (`deck_id`,`card_id`,`board`) |
| `matches` | `id` uuid | `host_user_id`, `guest_user_id?`, `mode` ('bot'\|'p2p'), `winner_user_id?`, `played_at` | FK `host_user_id` CASCADE, CHECK `mode`, indice `host_user_id` |

Timestamp salvati come `INTEGER` epoch ms (`Date` in TypeScript).

## Scelte e casi limite
- **Ospite P2P senza FK:** `guest_user_id` e `winner_user_id` puntano a utenti di un'altra installazione, quindi non hanno chiave esterna.
- **Carte nei mazzi protette:** cancellare dal catalogo una carta presente in un mazzo fallisce (RESTRICT); se è solo copertina, la copertina diventa `NULL`.
- **Cancellazione utente:** rimuove a cascata mazzi, righe dei mazzi e partite ospitate.
- **PRAGMA:** `foreign_keys=ON`, `busy_timeout=5000`, `journal_mode=WAL` (solo database su file).
- **Errori:** `DB_OPEN_FAILED` (percorso non apribile), `DB_MIGRATION_FAILED` (migrazioni mancanti o corrotte; la connessione viene chiusa).

## Workflow migrazioni
1. Modifica `db-schema.ts`.
2. `pnpm --filter @manaforge/server db:generate --name <nome>`.
3. Commit di `drizzle/<NNNN>_<nome>.sql` e `drizzle/meta/`.
