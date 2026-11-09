# 06. Piano di Implementazione e Registro Test — Manaforge

> **ISTRUZIONE PER L'AGENTE AI:** procedi rigorosamente in ordine. Non iniziare uno step se quello precedente non ha
> tutti i test passati (`[x] Testato`) e il relativo file di documentazione creato in `docs/catalog/`.

## FASE 1: Fondamenta, Database Locale e Autenticazione
* `[x]` **Step 1.1 — Setup Monorepo, Regole e Scheletro Cartelle (`[ARCH]`)**
  * *Task:* inizializzare `pnpm` workspace, TypeScript, Vitest e creare tutte le cartelle e i 6 documenti.
  * *Test richiesto:* `pnpm test` esegue un test di fumo (`smoke.test.ts`) su tutti i pacchetti con esito positivo.
  * *Doc richiesta:* `docs/catalog/ARCH/01-monorepo-setup.md`.
* `[x]` **Step 1.2 — Database SQLite & Schema Drizzle (`[DATA]`)**
  * *Task:* configurare SQLite locale e creare le tabelle `users`, `cards`, `decks`, `deck_cards`, `matches`.
  * *Test richiesto:* integration test (`db-schema.test.ts`) che crea, legge e cancella record su un DB SQLite di test.
  * *Doc richiesta:* `docs/catalog/DATA/01-sqlite-schema.md`.
* `[x]` **Step 1.3 — Autenticazione Manuale + Google OAuth2 (`[API]` + `[UI]`)**
  * *Task:* registrazione/login manuale (Argon2id + JWT), flusso Google OAuth2 (PKCE) e pagina `/login` in React.
  * *Test richiesto:* test API (`auth.test.ts`) per registrazione, login valido, password errata (401) e mock callback Google.
  * *Doc richiesta:* `docs/catalog/API/01-authentication.md`.

## FASE 2: Catalogo Carte Originale, Caching Immagini e Deckbuilder
* `[x]` **Step 2.1 — Seed Catalogo Carte Originale & Disk Image Cache (`[DATA]`)**
  * *Task:* catalogo JSON originale validato con Zod (primo blocco di carte), importer idempotente in SQLite basato su hash,
    generatore di illustrazioni procedurali SVG con salvataggio in cache su disco.
  * *Test richiesto:* `catalog-sync.test.ts` che importa un batch di carte di prova e verifica il salvataggio in cache dell'immagine.
  * *Doc richiesta:* `docs/catalog/DATA/02-card-catalog-and-image-cache.md`.
* `[x]` **Step 2.2 — API Mazzi, Parser Import/Export Testuale e UI Deckbuilder (`[API]` + `[UI]`)**
  * *Task:* CRUD mazzi, parser per il formato testuale (es. `4 Scintilla Rovente`) e interfaccia grafica `/decks` e `/collection` con filtri affinità/mana.
  * *Test richiesto:* test del parser di import/export + validazione regole di costruzione mazzo (min 60 carte, max 4 copie salvo Fonti base).
  * *Doc richiesta:* `docs/catalog/UI/01-deckbuilder.md`.

## FASE 3: Il Motore di Regole (`packages/engine`)
* `[ ]` **Step 3.1 — Struttura Turno, Fasi, Pescata, Mulligan e Priorità (`[RULE]`)**
  * *Task:* macchina a stati finiti del turno, pescata della mano da 7, mulligan (rimescola, ripesca 7, metti N carte in fondo) e passaggio di priorità tra i 2 giocatori.
  * *Test richiesto:* `turn-priority.test.ts` (attraversamento di tutte le fasi e cambio turno quando entrambi i giocatori passano priorità a pila vuota).
  * *Doc richiesta:* `docs/catalog/RULE/01-turn-and-priority.md`.
* `[ ]` **Step 3.2 — Sistema Mana, Giocare Fonti e Auto-Tapper (`[RULE]`)**
  * *Task:* limite di 1 Fonte per turno, produzione mana (A/M/O/F/S/C), parser dei costi (es. `{2}{F}{S}`) e algoritmo di Auto-Tapper.
  * *Test richiesto:* `mana-autotapper.test.ts` (l'Auto-Tapper sceglie la combinazione ottimale di Fonti e blocca il lancio se il mana è insufficiente).
  * *Doc richiesta:* `docs/catalog/RULE/02-mana-and-autotapper.md`.
* `[ ]` **Step 3.3 — La Pila (Stack), Lancio Carte e State-Based Actions (`[RULE]`)**
  * *Task:* lancio di Creature, Rituali (solo a pila vuota nella propria fase principale) e Rapidi (in qualsiasi momento con priorità),
    risoluzione LIFO e controllo SBA (creatura con danno ≥ resistenza va al cimitero; giocatore a ≤ 0 vita perde).
  * *Test richiesto:* `stack-and-sba.test.ts` (es. creatura 2/2 bersaglio di *Scintilla Rovente* (3 danni); in risposta riceve
    *Vigore della Selva* (+3/+3) → si risolve prima il +3/+3 e la creatura sopravvive come 5/5 con 3 danni).
  * *Doc richiesta:* `docs/catalog/RULE/03-stack-and-sba.md`.
* `[ ]` **Step 3.4 — Fase di Combattimento e Parole Chiave Principali (`[RULE]`)**
  * *Task:* stordimento d'ingresso, dichiarazione attaccanti e bloccanti, calcolo danni e parole chiave originali:
    *Alato, Vedetta, Sfondamento, Scatto, Sentinella, Veleno, Linfa, Fendente, Doppio Fendente, Egida, Fulmineo*
    (definizioni in `docs/catalog/RULE/`). Include il resolver Sandbox per effetti extra.
  * *Test richiesto:* `combat-keywords.test.ts` (interazioni incrociate, es. *Veleno + Sfondamento* assegna 1 danno letale al bloccante e il resto al giocatore).
  * *Doc richiesta:* `docs/catalog/RULE/04-combat-and-keywords.md`.

## FASE 4: Interfaccia Campo di Battaglia, Bot AI e Multiplayer
* `[ ]` **Step 4.1 — Schermata Campo di Battaglia e HUD (`[UI]`)**
  * *Task:* `/match/:id` fedele al Design Brief: mano a ventaglio, campo con carte compatte, pila laterale con frecce SVG ai bersagli,
    Phase Strip e scorciatoie da tastiera (`Spazio`, `Invio`).
  * *Test richiesto:* component test del rendering del `GameState` e delle interazioni di selezione carta/bersaglio.
  * *Doc richiesta:* `docs/catalog/UI/02-battlefield-hud.md`.
* `[ ]` **Step 4.2 — Intelligenza Artificiale Locale "Tizzo" (`[RULE]`)**
  * *Task:* bot euristico in `packages/engine/src/bot` che valuta lo stato e gioca autonomamente Fonti, creature, rimozioni, attacchi e blocchi.
  * *Test richiesto:* `bot-simulation.test.ts` (2 bot giocano 10 partite complete; ogni partita termina con un vincitore valido senza loop infiniti).
  * *Doc richiesta:* `docs/catalog/RULE/05-bot-ai.md`.
* `[ ]` **Step 4.3 — Multiplayer 1v1 via WebSocket (Fog of War) e Packaging Windows/Linux (`[API]` + `[ARCH]`)**
  * *Task:* stanze Socket.io con filtro `sanitizeGameStateForPlayer` (anti-cheat), creazione/unione stanza con amico e configurazione
    Tauri (con sidecar del server) per i pacchetti store di Windows (`.msix`/`.exe`) e Linux (`.flatpak`/`.AppImage`).
  * *Test richiesto:* test E2E WebSocket con due client simulati connessi alla stessa stanza + verifica build desktop.
  * *Doc richiesta:* `docs/catalog/ARCH/03-multiplayer-and-packaging.md`.

---

## Registro Test

| Step | Data | Comando | Suite | Test | Esito | Copertura | Note |
|---|---|---|---|---|---|---|---|
| 1.1 | 2026-11-09 | `pnpm verify` | 4 progetti Vitest (`shared`, `engine`, `server`, `desktop-client`), 8 file | 15 | ✅ 15/15, `tsc -b` verde | 100% stmt/branch/func/lines | pnpm 10.28, TypeScript 7.0, Vitest 5.1; soglie 80% globale / 100% engine |
| 1.2 | 2026-11-09 | `pnpm verify` | `apps/server/tests/db/{db-schema,db-client,db-paths}.test.ts` (+ suite 1.1), 11 file | 34 | ✅ 34/34, `tsc -b` verde | 100% stmt/func/lines, 94.7% branch | Drizzle 0.45.4 + better-sqlite3 13.0.3, migrazione `0000_init` |
| 1.3 | 2026-11-09 | `pnpm verify` + E2E manuale Playwright | 31 file (server 15, client 11, shared 5): `apps/server/tests/routes/auth.test.ts` (API), `auth-service`, `google-oauth`, `LoginPage`, `use-auth-store`… | 160 | ✅ 160/160, `tsc -b` verde, build Vite ok | 99.5% stmt, 98.2% branch | Flusso reale verificato: redirect /home→/login, registrazione, ripristino sessione, 401, Google non configurato; 0 violazioni CSP |
| 2.1 | 2026-11-09 | `pnpm verify` | 41 file: `apps/server/tests/catalog/{catalog-sync,card-catalog,art-generator,image-cache}.test.ts`, `db/card-repository`, `packages/shared/tests/schemas/{card,mana-cost}`, `constants/keywords`… | 250 | ✅ 250/250, `tsc -b` verde | 99.7% stmt, 97.7% branch | Blocco MF1 (48 carte originali), versione `v1-<sha256>`, SVG procedurali deterministici in `~/.manaforge/cache/images`; branch `feat/2.1-card-catalog` |
| 2.2 | 2026-11-09 | `pnpm verify` + verifica manuale nel browser | 60 file: `packages/shared/tests/schemas/{deck-list,deck}.test.ts` (parser + regole), `apps/server/tests/routes/{decks,cards,require-auth}.test.ts`, `db/deck-repository`, client `pages/{Deckbuilder,DeckList,Collection}Page`, `store/use-deck-store`, componenti UI… | 374 | ✅ 374/374, `tsc -b` verde | 99.8% stmt, 97.1% branch | CRUD `/api/decks` + `/parse`, `GET /api/cards` e illustrazioni SVG; UI `/collection`, `/decks`, `/decks/:id`; branch `feat/2.2-deckbuilder` |
