# [TEST] 04 — Test del catalogo carte e della cache immagini

- **Step:** 2.1

## Shared (`packages/shared/tests/`)
| File | Copre |
|---|---|
| `schemas/mana-cost.test.ts` | scomposizione dei costi, ordine canonico, 11 casi di errore, rientranza della regex sticky, simboli nel testo |
| `schemas/card.test.ts` | vincoli per tipo (Creature, Fonti, Fonte base), campi non validi, strict, unicità nel blocco, derivazione del record |
| `constants/keywords.test.ts`, `constants/affinities.test.ts` | codici, nomi e colori |

## Server (`apps/server/tests/`)
| File | Copre |
|---|---|
| `catalog/catalog-sync.test.ts` | **Test richiesto dal piano:** import del batch di prova `TS1` (helper `tests/helpers/catalog-fixtures.ts`) in SQLite in-memory e **salvataggio su disco dell'illustrazione** con percorsi registrati in `cards`; idempotenza; update/insert/delete con carta trattenuta perché in un mazzo; import del blocco reale MF1; DB chiuso; rollback su errore a metà transazione |
| `catalog/card-catalog.test.ts` | validità del blocco MF1 (Fonti base, copertura parole chiave), errori Zod, conflitti tra blocchi, stabilità dell'hash |
| `catalog/art-generator.test.ts` | determinismo, variazione per seed/affinità, ritaglio 4:3 della stessa scena, assenza di script/riferimenti esterni |
| `catalog/image-cache.test.ts` | cache hit senza riscrittura, rigenerazione di file mancanti o non registrati, invalidazione per impronta, id malevoli (`../`), errori di scrittura e pulizia dei file temporanei |
| `db/card-repository.test.ts` | ricerca, ordinamento, aggiornamento percorsi |
| `server.test.ts` | import del catalogo al primo avvio, avvio rifiutato con catalogo non valido |
