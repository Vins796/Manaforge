# 01. PRD (Product Requirements Document) — Manaforge

> Politica contenuti: Manaforge è un card game **originale** del genere "duel TCG a risorse".
> Nessun nome, testo, arte, simbolo o dato di carte di *Magic: The Gathering* / *MTG Arena* è incluso
> (vedi `.cursorrules §0` e `docs/catalog/ARCH/00-original-content-policy.md`).

## 1. Cosa fa l'app? (Scopo e Visione)
Applicazione desktop nativa per **Windows e Linux** che offre l'esperienza di un card game digitale 1v1 a risorse:
costruzione di mazzi a partire da un catalogo di carte originali e partite complete regolate da un motore automatico,
contro un Bot AI locale o contro un amico online (1v1), girando interamente in locale senza costi di server o storage cloud.

## 2. Per chi è? (Attori)
* **Giocatore Locale / Host:** installa l'app dallo store o dal pacchetto locale, accede con il proprio profilo,
  costruisce mazzi (tutte le carte del catalogo disponibili gratuitamente in 4 copie) e ospita partite con un amico o gioca contro il Bot.
* **Giocatore Ospite (Amico):** si connette alla stanza creata dall'Host tramite codice/URL diretto per giocare 1v1 in tempo reale.

## 3. Funzionalità In-Scope (Classificate per Natura)
* `[API]` **Autenticazione Doppio Canale:** registrazione/login manuale (Email + Password) e login tramite Google OAuth2.
* `[DATA]` **Catalogo Carte Originale Offline-First:** catalogo versionato nel repository, importato in SQLite al primo avvio;
  le illustrazioni sono generate proceduralmente (SVG deterministico per carta) e salvate in una cache su disco.
* `[UI]` **Deckbuilder Completo:** filtri per affinità di mana (Alba, Marea, Ombra, Fiamma, Selva, Multi, Incolore),
  valore di mana, tipo, formato e ricerca testuale, più import/export liste mazzo in formato testuale semplice (`4 Nome Carta`).
* `[RULE]` **Motore Regole (Core Engine):** gestione rigorosa di turni, fasi, priorità, pila (Stack), Auto-Tapper delle Fonti,
  combattimento, State-Based Actions, parole chiave principali e assistente Sandbox per gli effetti testuali non ancora scriptati.
* `[RULE]` **Bot AI ("Tizzo"):** avversario artificiale locale capace di giocare Fonti, lanciare carte in curva e gestire attacchi e blocchi.
* `[ARCH]` **Multiplayer 1v1 Locale/P2P e Packaging Store:** stanze private via WebSocket e build per Microsoft Store (`.msix`/`.exe`)
  e store Linux (`.flatpak`/`.AppImage`).

## 4. Cosa resta fuori? (Out-of-Scope)
* **Negozio, Valute e Microtransazioni:** nessuno store interno, valute, buste a pagamento o jolly.
* **Server Cloud a Pagamento:** nessun database o storage ospitato su AWS/GCP/Azure a pagamento.
* **Matchmaking Pubblico Globale:** nessuna coda pubblica casuale; solo Sfida Diretta con amico o Bot Match.
* **Contenuti di terze parti:** nessuna carta, arte o dato importato da giochi esistenti o da database di carte esterni.

## 5. Requisiti Non Funzionali
| ID | Requisito |
|---|---|
| RNF-01 | Il motore simula un'intera partita in memoria in < 50 ms (test Vitest) |
| RNF-02 | Copertura test: 100% `packages/engine`, ≥ 80% altrove |
| RNF-03 | Zero dipendenze da servizi a pagamento; dati in `~/.manaforge/` |
| RNF-04 | Il client non riceve mai informazioni nascoste dell'avversario (Fog of War lato server) |
| RNF-05 | Navigazione completa da tastiera, contrasto AA, simboli di affinità distinguibili per forma (daltonismo) |
