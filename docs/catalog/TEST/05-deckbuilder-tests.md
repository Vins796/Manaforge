# [TEST] 05 — Test di mazzi, parser import/export e deckbuilder

- **Step:** 2.2 · **Comando:** `pnpm verify`

## Shared (`packages/shared/tests/`)
| File | Copre |
|---|---|
| `schemas/deck-list.test.ts` | **Test del parser richiesto dal piano:** sezioni `Mazzo`/`Riserva` (con `:` e `(N)`), formato `4x`, commenti, righe vuote, CRLF, somma delle righe ripetute, errori per riga (`INVALID_LINE`, `INVALID_QUANTITY` anche su somma oltre 99), testo troppo lungo, risoluzione dei nomi (apostrofo tipografico, maiuscole) e nomi sconosciuti, export e round-trip export → parse |
| `schemas/deck.test.ts` | **Regole di costruzione richieste dal piano:** 60 carte valide con Fonti base oltre le 4 copie, mazzo sotto 60 non bloccante, 5 copie sommando mazzo + riserva (anche per la Fonte non base), riserva oltre 15, carte sconosciute, ordine stabile dei problemi; messaggi `describeDeckIssue`; `SaveDeckRequestSchema` (default, righe duplicate, quantità, id, nome) |

## Server (`apps/server/tests/`)
| File | Copre |
|---|---|
| `routes/decks.test.ts` | 401 su tutte le rotte; creazione valida (201) e rilettura; bozza incompleta salvata; 422 per 5 copie, riserva 16, carta e copertina sconosciute (nessun mazzo creato); 400 corpo malformato; elenco solo dell'utente con conteggi; PUT/DELETE; 404 per mazzi altrui e id non UUID; `POST /api/decks/parse` con nomi del catalogo e problemi per riga |
| `routes/cards.test.ts` | 401 senza sessione; catalogo ordinato senza percorsi locali; SVG `normal`/`crop` generati e serviti con header di sicurezza; 404 per id inesistenti, malformati (`..%2F`) e varianti sconosciute; 500 senza dettagli se la cache fallisce |
| `routes/require-auth.test.ts` | estrazione del Bearer token; guardia con token valido, non valido, assente e utente cancellato |
| `db/deck-repository.test.ts` | creazione con righe ordinate, mazzo vuoto, isolamento per utente, ordinamento per aggiornamento, sostituzione atomica delle righe con rollback su FK violata, cascata su eliminazione |

## Client (`apps/desktop-client/tests/`)
| File | Copre |
|---|---|
| `store/use-deck-store.test.tsx` | caricamenti (una sola volta, senza sessione, errori), limiti 4 copie / Fonti base / riserva 15 / spostamenti, rimozione, import (riuscito, con problemi, errore API), salvataggio (creazione con copertina predefinita, aggiornamento, valido vs incompleto, blocco locale, rifiuto del server), eliminazione, reset, hook fuori dal provider |
| `pages/DeckbuilderPage.test.tsx` | clic e clic destro sulla griglia, limite con avviso, colonna (+/−/⇄), curva e problemi, mazzo valido, nome vuoto, salvataggio con cambio di rotta senza ricaricare, errore del server, apertura di un mazzo esistente, stati di caricamento/errore, import dal dialogo, export ordinato negli appunti e appunti non disponibili |
| `pages/DeckListPage.test.tsx`, `pages/CollectionPage.test.tsx` | elenco con conteggi, stato e copertina; stato vuoto, caricamento ed errore; eliminazione con conferma; filtri e pannello di dettaglio |
| `components/ui/{card-filters,CardFilterBar,ManaCost,ManaCurve,AffinityIcon,ImportDeckDialog,TopNav}.test.*` | logica dei filtri, controlli accessibili, resa del costo, curva, simboli, dialogo di import, navigazione e logout |
| `components/cards/{CardFullView,CardGrid}.test.tsx` | resa della carta (costo, F/R, simboli nel testo, cornice), griglia (azioni, badge, paginazione) |
| `App.test.tsx`, `services/api-client.test.ts` | nuove rotte protette e azzeramento dei mazzi al logout; chiamate REST di carte e mazzi con Bearer, metodo e corpo |

Helper: `tests/helpers/render-page.tsx` monta una pagina con router in memoria e utente autenticato;
`tests/helpers/fake-api.ts` fornisce catalogo e mazzi di prova (`CARDS`, `deckDetail`) e `createTestDeckStore`.
Lato server `tests/helpers/test-context.ts` espone anche repository carte/mazzi, cache immagini temporanea e `appDeps(ctx)`.

## Verifica manuale (browser)
Server e client avviati in copie isolate (home temporanea, porte 47831/5183): collezione con illustrazioni e filtri
(Fiamma + mana 1 → 3 carte), limite di 4 copie con avviso, import con errore per riga e poi riuscito (60/60, valido),
salvataggio con cambio di rotta, elenco con copertina predefinita, riapertura del mazzo. Nessun errore in console.
