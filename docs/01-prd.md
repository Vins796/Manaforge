# 01 — Product Requirements Document (PRD)

## 1. Visione

**Manaforge** è un card game collezionabile digitale 1v1, desktop (Windows e Linux), che offre l'esperienza
del genere "duel TCG a risorse" (mazzo, risorse che crescono ogni turno, magie istantanee in risposta,
creature in combattimento) **interamente in locale**: nessun server, nessun costo di cloud storage.

Modalità: **1 vs Bot (AI)** offline e **1 vs 1 online P2P** diretto tra due client.

> Vincolo IP: Manaforge è un prodotto originale. Carte, testi, terminologia di gioco, arte e interfaccia
> sono progettati da zero. Non si usano marchi o contenuti di Magic: The Gathering / MTG Arena (vedi `AGENT_RULES.md §0`).

## 2. Obiettivi e non-obiettivi

| Obiettivi (v1.0) | Non-obiettivi (v1.0) |
|---|---|
| Partite 1v1 complete con regole deterministiche | Modalità multigiocatore >2 |
| Bot giocabile in 3 livelli di difficoltà | Economia a pagamento, store, valuta reale |
| P2P senza server applicativo (solo STUN pubblico opzionale) | Matchmaking globale / ladder centralizzata |
| Collezione e deck builder locali | Sincronizzazione cloud dei profili |
| Packaging installabile Windows (NSIS) e Linux (AppImage, .deb) | macOS, mobile |
| Profili locali multipli protetti da password | Account online |

## 3. Personas

- **Giocatore solitario**: vuole imparare e giocare contro il bot senza connessione.
- **Coppia di amici**: vogliono sfidarsi online senza registrazioni né server.
- **Deck builder**: vuole costruire, testare (goldfish/bot) e salvare mazzi.

## 4. Requisiti funzionali

### 4.1 Profili e autenticazione (locale)
- RF-01 Creazione profilo: nome visualizzato (3–24 caratteri, univoco localmente), password (≥ 8 caratteri).
- RF-02 Login/logout locale; sessione attiva in memoria nel processo main; blocco dopo 5 tentativi errati per 60 s.
- RF-03 Ogni profilo possiede una **identità P2P** (coppia di chiavi Ed25519) usata per firmare i messaggi di partita.
- RF-04 Cambio password ed eliminazione profilo (con conferma password).

### 4.2 Collezione e mazzi
- RF-10 Set iniziale originale di carte (≥ 120 carte, 5 "affinità" cromatiche + incolori).
- RF-11 Ogni profilo parte con una collezione iniziale e 5 mazzi precostruiti.
- RF-12 Deck builder: filtri (affinità, costo, tipo, testo), curva dei costi, conteggio, salvataggio.
- RF-13 Validazione formato: mazzo da 60 carte minime, max 4 copie per carta (risorse base illimitate).
- RF-14 Ricompense locali: le vittorie sbloccano "buste" con carte casuali (seed locale).
- RF-15 Import/export mazzi in formato testo.

### 4.3 Partita
- RF-20 Regole complete del ciclo di turno: inizio, pesca, fase principale, combattimento, seconda fase principale, fine.
- RF-21 Pila (stack) con priorità alternata, risposte istantanee, abilità attivate e innescate.
- RF-22 Combattimento con dichiarazione attaccanti/bloccanti, ordine dei danni, parole chiave originali.
- RF-23 Azioni basate sullo stato (vita ≤ 0, creature con danno letale, mazzo vuoto alla pesca).
- RF-24 Mulligan, scelta di chi inizia (lancio moneta con commit-reveal in P2P).
- RF-25 Timer di turno configurabile e auto-pass intelligente; annullamento ("undo") consentito solo prima di confermare un pagamento.
- RF-26 Log di partita e replay locale.

### 4.4 Bot
- RF-30 Tre livelli: *Apprendista* (euristico semplice), *Adepto* (euristico con valutazione), *Maestro* (MCTS con informazione imperfetta).
- RF-31 Il bot usa solo informazioni legali (non vede la mano o il mazzo dell'avversario).
- RF-32 Tempo di decisione ≤ 2 s per azione su hardware medio.

### 4.5 Online P2P
- RF-40 Creazione stanza → **codice invito** copiabile; l'altro giocatore incolla il codice di risposta (signaling manuale) oppure scoperta automatica in LAN.
- RF-41 Sincronizzazione in **lockstep deterministico**: si scambiano solo azioni firmate, ciascun client esegue il motore.
- RF-42 Anti-cheat: shuffle con commit-reveal di entrambi i seed, hash dello stato dopo ogni azione, mano nascosta tramite impegni crittografici.
- RF-43 Riconnessione entro 120 s; dopo il timeout la partita è persa per abbandono.
- RF-44 Compatibilità di versione verificata all'handshake (versione protocollo + hash del set carte).

### 4.6 Impostazioni
- RF-50 Audio, lingua (IT/EN), risoluzione/fullscreen, velocità animazioni, timer, auto-pass.

## 5. Requisiti non funzionali

| ID | Requisito |
|---|---|
| RNF-01 | Avvio a freddo < 4 s; 60 fps sul campo di battaglia con 30 permanenti |
| RNF-02 | Zero dipendenze da server applicativi; solo dati locali in `userData` |
| RNF-03 | Determinismo: stessa sequenza di azioni + seed ⇒ stesso stato (verificato da test) |
| RNF-04 | Copertura test: ≥ 90% `engine`, ≥ 80% altri package |
| RNF-05 | Sicurezza: contextIsolation, sandbox, CSP, validazione Zod su ogni confine |
| RNF-06 | Accessibilità: navigazione da tastiera, contrasto AA, modalità daltonici |
| RNF-07 | Installer < 150 MB |

## 6. Metriche di successo (locali, nessuna telemetria remota)

- Partita completa contro il bot senza errori di regola nei test di regressione.
- 0 desync su 1.000 partite simulate bot-vs-bot via protocollo P2P in loopback.
