# 05. Schema del Back-end (SQLite + In-Memory GameState) — Manaforge

## 1. Schema Database Locale SQLite (`apps/server/prisma/schema.prisma`) — `[DATA]`

### Tabella `users`
* `id`: String `@id @default(uuid())`
* `email`: String `@unique`
* `username`: String
* `passwordHash`: String? (null se registrato solo con Google)
* `googleId`: String? `@unique`
* `avatar`: String `@default("forgiatore")` (avatar originali)
* `createdAt`: DateTime `@default(now())`

### Tabella `cards` (popolata dal catalogo originale in `apps/server/src/catalog/`)
* `id`: String `@id` (codice carta, es. `"MF1-042"`)
* `name`: String `@index`
* `cost`: String (es. `"{2}{F}{S}"`)
* `manaValue`: Int `@index`
* `typeLine`: String `@index` (es. `"Creatura — Drago"`)
* `rulesText`: String
* `affinities`: String (JSON array: `["F"]`)
* `affinityIdentity`: String (JSON array)
* `power`: Int?
* `toughness`: Int?
* `keywords`: String (JSON array: `["ALATO", "EGIDA"]`)
* `rarity`: String (`"comune" | "non_comune" | "rara" | "mitica"`)
* `artSeed`: String (seed dell'illustrazione procedurale)
* `localImageNormalPath`: String? (popolato quando l'immagine viene generata e cachata su disco)
* `localImageCropPath`: String?
* `catalogVersion`: String (hash del catalogo che ha prodotto la riga)

### Tabella `decks`
* `id`: String `@id @default(uuid())`
* `userId`: String (FK → `users.id`, `onDelete: Cascade`)
* `name`: String
* `format`: String `@default("standard")`
* `coverCardId`: String?
* `updatedAt`: DateTime `@updatedAt`

### Tabella `deck_cards`
* `id`: String `@id @default(uuid())`
* `deckId`: String (FK → `decks.id`, `onDelete: Cascade`)
* `cardId`: String (FK → `cards.id`)
* `quantity`: Int
* `board`: String (`"main"` | `"sideboard"`)
* Vincolo `@@unique([deckId, cardId, board])`

### Tabella `matches`
* `id`: String `@id @default(uuid())`
* `hostUserId`: String
* `guestUserId`: String? (`null` se contro Bot)
* `mode`: String (`"bot"` | `"p2p"`)
* `winnerUserId`: String?
* `playedAt`: DateTime `@default(now())`

## 2. Architettura del `GameState` In-Memory (`packages/shared/src/types`) — `[RULE]` + `[DATA]`
Durante il match, il Game Engine mantiene un oggetto **immutabile** aggiornato tramite `GameAction`:
* `matchId`: string
* `seed` / `rngState`: stato del PRNG deterministico (mescolamenti e scelte casuali)
* `turnNumber`: number
* `activePlayerId`: string (di chi è il turno)
* `priorityPlayerId`: string (chi ha il diritto di agire in questo istante)
* `phase`: `'READY' | 'UPKEEP' | 'DRAW' | 'MAIN_1' | 'COMBAT_BEGIN' | 'COMBAT_ATTACKERS' | 'COMBAT_BLOCKERS' | 'COMBAT_DAMAGE' | 'COMBAT_END' | 'MAIN_2' | 'END' | 'CLEANUP'`
* `stack`: `StackItem[]` (oggetti in pila con `sourceCard`, `controllerId`, `targets[]`, `effect`)
* `players`: mappa per ciascuno dei 2 giocatori contenente:
  * `life`: number (inizia a 20)
  * `sourcesPlayedThisTurn`: number
  * `manaPool`: `{ A: number, M: number, O: number, F: number, S: number, C: number }`
  * `zones`: `{ library: CardInstance[], hand: CardInstance[], battlefield: PermanentInstance[], graveyard: CardInstance[], exile: CardInstance[] }`

## 3. Regole di Permesso e Anti-Cheat (`Fog of War`) — `[API]`
* **Regola Database:** un utente può modificare/eliminare solo i `decks` con `userId === req.user.id`.
* **Regola WebSocket Match:** prima di inviare il `GameState` via WebSocket a un giocatore, il server applica
  `sanitizeGameStateForPlayer(state, playerId)`:
  * oscura completamente `opponent.zones.library` e `opponent.zones.hand` (sostituendo le carte con `{ hidden: true }`),
    così il client conosce solo il *numero* di carte nella mano e nel mazzo dell'avversario;
  * oscura anche l'ordine della propria `library` e lo stato del PRNG.
* **Regola Azioni:** il server accetta una `GameAction` solo se validata da Zod, proveniente dal socket autenticato del
  giocatore indicato e legale secondo l'engine (es. priorità corretta).
