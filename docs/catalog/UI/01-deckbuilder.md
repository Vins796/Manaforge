# [UI] 01 — Collezione, Mazzi e Deckbuilder

> Numerazione: `UI/01-login-page.md` (step 1.3) e questo file condividono il prefisso `01` perché il piano
> (`06-implementation-plan.md`, step 2.2) richiede esplicitamente il nome `UI/01-deckbuilder.md`.

- **Step:** 2.2 · **Natura:** `[API]` + `[UI]` (+ regole di costruzione condivise)
- **Rotte client:** `/collection`, `/decks`, `/decks/new`, `/decks/:deckId` (tutte protette da `RequireAuth`)
- **Test:** vedi [`TEST/05-deckbuilder-tests.md`](../TEST/05-deckbuilder-tests.md)

## Flusso
```text
CollectionPage / DeckbuilderPage ─▶ useDeckStore.loadCatalog ─▶ GET /api/cards ─▶ CardView[] (filtri lato client)
<img src> ─────────────────────────────────────────────────────▶ GET /api/cards/:id/image/{normal|crop} ─▶ ImageCache (on-demand)
Deckbuilder: clic carta ─▶ addCard (limite 4 copie / riserva 15) ─▶ bozza locale ─▶ validateDeck (stesse regole del server)
"Importa dagli Appunti" ─▶ POST /api/decks/parse ─▶ { entries, issues } ─▶ sostituisce le righe se issues = []
"Salva" ─▶ POST /api/decks (nuovo) | PUT /api/decks/:id ─▶ DeckDetail (+ validation) ─▶ rotta /decks/:id
```

## Regole di costruzione (`packages/shared/src/schemas/deck.ts`)
| Regola | Codice | Effetto |
|---|---|---|
| Mazzo principale ≥ 60 carte (`MIN_DECK_SIZE`) | `MAIN_TOO_SMALL` | **non bloccante**: il mazzo si salva come "Incompleto" (`isValid: false`) |
| Riserva ≤ 15 carte (`MAX_SIDEBOARD_SIZE`) | `SIDEBOARD_TOO_LARGE` | bloccante (422) |
| ≤ 4 copie per carta (`MAX_COPIES_PER_CARD`), sommando mazzo e riserva; le **Fonti base** (`typeLine` che inizia per `Fonte base`) sono illimitate, la `Fonte` incolore no | `TOO_MANY_COPIES` | bloccante (422) |
| Ogni carta esiste nel catalogo | `UNKNOWN_CARD` | bloccante (422) |

`validateDeck(entries, lookup)` è pura e condivisa: il client la usa per mostrare conteggi e problemi in tempo reale,
il server la riapplica a ogni salvataggio (il client non è fidato). Limiti di sicurezza dello schema `SaveDeckRequestSchema`:
nome 1–40 caratteri senza caratteri di controllo, quantità 1–99 per riga, max 250 righe, nessuna riga duplicata (stessa carta e sezione).

## Formato testuale import/export (`packages/shared/src/schemas/deck-list.ts`)
```text
Mazzo
24 Fucina Vulcanica
4 Scintilla Rovente

Riserva
3 Vigore della Selva
```
- Una carta per riga: `N Nome` (ammesso `Nx Nome`); `N` da 1 a 99.
- Le righe `Mazzo` / `Riserva` (con `:` o `(N)` opzionali, maiuscole indifferenti) cambiano sezione; senza intestazione → mazzo.
- Righe vuote e commenti (`#`, `//`) ignorati; righe ripetute della stessa carta e sezione si sommano.
- I nomi si confrontano normalizzati (`normalizeCardName`: minuscole, spazi compattati, `’` → `'`).
- Problemi per riga: `INVALID_LINE`, `INVALID_QUANTITY`, `UNKNOWN_CARD`; `TOO_LONG` (riga 0) oltre 20 000 caratteri.
- Nessun codice di set o identificativo esterno (`.cursorrules §0`): solo quantità e nome della carta originale.
- `formatDeckList` produce lo stesso formato (sezione `Riserva` solo se non vuota); export → parse è un round-trip.

## API REST
Tutte le rotte, tranne l'immagine, richiedono `Authorization: Bearer <JWT>` (`routes/require-auth.ts`: token valido **e**
utente ancora presente). Errori nel formato standard `{ error: { code, message } }`.

| Metodo e rotta | Corpo | Risposta |
|---|---|---|
| `GET /api/cards` | — | `200 { cards: CardView[] }` ordinate per valore di mana e nome; nessun percorso locale né versione |
| `GET /api/cards/:id/image/:variant` | — | `200 image/svg+xml` (pubblica: un `<img>` non invia il token); `404` per id/variante non validi; `500 INTERNAL_ERROR` senza dettagli se la cache non è scrivibile |
| `GET /api/decks` | — | `200 { decks: DeckSummary[] }` (dal più recente, con `mainCount`, `sideboardCount`, `isValid`) |
| `POST /api/decks` | `SaveDeckRequest` | `201 DeckDetail`; `400 VALIDATION_ERROR`; `422 DECK_INVALID` (messaggio con i problemi bloccanti o copertina sconosciuta) |
| `GET /api/decks/:id` | — | `200 DeckDetail`; `404` se non esiste, non è dell'utente o l'id non è un UUID |
| `PUT /api/decks/:id` | `SaveDeckRequest` | `200 DeckDetail`; sostituisce nome, copertina e **tutte** le righe in una transazione |
| `DELETE /api/decks/:id` | — | `204`; le righe seguono in cascata |
| `POST /api/decks/parse` | `{ text }` (≤ 20 000) | `200 { entries: DeckEntry[], issues: DeckListIssue[] }` — non salva nulla |

- **Proprietà:** `DeckRepository` filtra ogni operazione per `userId`; un mazzo altrui risponde **404** (non 403) per non rivelarne l'esistenza.
- **Header SVG:** `content-type: image/svg+xml`, `x-content-type-options: nosniff`, `content-security-policy: default-src 'none'; style-src 'unsafe-inline'`, `cache-control: public, max-age=86400`.
- **Limiti:** `BODY_LIMIT_BYTES` portato a 64 KiB (una lista testuale completa supera i 16 KiB precedenti). Nuovo codice errore condiviso `DECK_INVALID`.
- **CSP client:** `img-src` include `http://127.0.0.1:47821` per caricare le illustrazioni dal server locale.

## Moduli client
| Modulo | Ruolo |
|---|---|
| `store/use-deck-store.ts` | Store Zustand (`createDeckStore({ api, getToken })`): catalogo, elenco mazzi, bozza (`addCard`, `removeCard`, `moveCard`, `rename`, `setCover`, `importList`, `save`, `deleteDeck`, `reset`). Copertina predefinita al salvataggio: carta non-Fonte più costosa del mazzo (`defaultCoverCardId`). Azzerato al logout/cambio utente da `App.tsx`. |
| `pages/CollectionPage.tsx` | Catalogo completo filtrabile, pannello di dettaglio (id, copie disponibili); `CatalogStatus` per caricamento/errore |
| `pages/DeckListPage.tsx` | Riquadri dei mazzi con copertina (`crop`), conteggi, stato *Valido/Incompleto*, "Nuovo mazzo", eliminazione con conferma in due passi |
| `pages/DeckbuilderPage.tsx` | Griglia + colonna del mazzo: nome, `N/60 Mazzo`, `N/15 Riserva`, curva, copertina, problemi, sezioni con `−` / `+` / `⇄`, Salva (`*` se modificato), Importa, Esporta; dopo il primo salvataggio la rotta passa da `new` all'id senza ricaricare |
| `components/ui/card-filters.ts` | Filtri puri: affinità in OR (`Multi` = 2+ affinità, `Incolore` = identità vuota), valore di mana 0–5 e `6+`, tipo (`Fonte` include `Fonte base`), formato, ricerca su nome/tipo/testo senza accenti; categorie in AND |
| `components/ui/CardFilterBar.tsx` | Toggle con `aria-pressed`, select Tipo/Formato, `type="search"`, conteggio `aria-live`, "Azzera filtri" |
| `components/ui/AffinityIcon.tsx` | Simboli originali (sole a 8 raggi, onda doppia, falce, fiamma, foglia, esagono, Multi) |
| `components/ui/ManaCost.tsx` | Cristalli del costo con descrizione accessibile (`describeManaCost`) |
| `components/ui/ManaCurve.tsx` | Istogramma 0–6+ del mazzo principale, Fonti escluse |
| `components/ui/ImportDeckDialog.tsx` | Modale: precompila dagli appunti se consentito (senza sovrascrivere ciò che l'utente ha scritto), errori per riga, `Esc`/Annulla |
| `components/ui/TopNav.tsx` | Barra comune Home / Mazzi / Collezione (`NavLink` con `aria-current`), utente, Esci |
| `components/cards/CardFullView.tsx` | Carta 63:88: cornice per affinità (oro se multi, grigio se incolore), costo, illustrazione, tipo, parole chiave, testo con simboli (`RulesText`), F/R |
| `components/cards/CardGrid.tsx` | Griglia paginata (18 per pagina), clic = mazzo, clic destro = riserva, badge copie, pagina riportata nell'intervallo quando i filtri riducono i risultati |

## Interazioni da tastiera e accessibilità
Ogni carta della griglia è un `<button>` con etichetta d'azione ("Aggiungi X al mazzo"); l'aggiunta alla riserva è
disponibile anche da tastiera con il pulsante `⇄` della colonna. Focus visibile arancione su tutti i controlli; messaggi
di stato in regioni `aria-live`; il dialogo di import ha `role="dialog"` + `aria-modal`.

## Limiti noti
- Modifiche non salvate: lasciando il deckbuilder senza salvare la bozza resta nello store ma non viene chiesta conferma.
- Il catalogo è filtrato lato client (48 carte oggi, limite 1000 per blocco): sufficiente finché resta locale e piccolo.
- Un solo formato (`standard`): il filtro Formato è predisposto per formati futuri.
