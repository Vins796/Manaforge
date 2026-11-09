# 03. Flusso dell'App (Screen & Interaction Flow) — Manaforge

## 1. Schermata Autenticazione (`/login`) — `[UI]` + `[API]`
* **Stato Iniziale:** schermata scura con logo centrale, tab `"Accedi"` / `"Registrati"` e pulsante `"Continua con Google"`.
* **Interazioni:**
  * Inserimento Email/Password → clic su `"Accedi"` → chiamata `POST /api/auth/login` → se valido, salva il JWT e naviga a `/home`.
  * Clic su `"Continua con Google"` → apre la finestra OAuth Google → ritorna il token → crea/aggiorna l'utente in SQLite → naviga a `/home`.
* **Primo Avvio (Check Catalogo):** se la tabella `cards` è vuota o l'hash del catalogo è cambiato, mostra una barra di progresso
  `"Preparazione del catalogo carte..."` e importa il catalogo prima di sbloccare la Home.

## 2. Schermata Home Hub (`/home`) — `[UI]`
* **Stato Iniziale:** barra superiore con navigazione (`Home`, `Mazzi`, `Collezione`), indicatore stato server locale e profilo utente.
  In basso a destra, pulsante arancione `"GIOCA"`.
* **Interazioni:**
  * Clic su `"GIOCA"` → apre il cassetto laterale (**Play Blade**):
    * Scelta modalità: `vs Bot (Tizzo)` | `Ospita Partita Amico` | `Unisciti a Partita Amico (inserisci codice)`.
    * Selezione del mazzo dalla lista dei mazzi validi.
    * Clic su `"Inizia Battaglia"` → naviga a `/match/:matchId`.

## 3. Schermata Collezione e Deckbuilder (`/decks` & `/collection`) — `[UI]` + `[DATA]`
* **Stato Iniziale:**
  * Top Bar con icone filtro affinità (`Alba, Marea, Ombra, Fiamma, Selva, Multi, Incolore`), filtro valore di mana
    (`0, 1, 2, 3, 4, 5, 6+`), barra di ricerca full-text.
  * Griglia carte paginata al centro/sinistra; colonna del mazzo a destra con conteggio (`60/60 Mazzo`, `15/15 Riserva`) e curva di mana.
* **Interazioni:**
  * Clic sinistro su una carta nella griglia → aggiunge `+1` copia al mazzo (verifica limite 4 copie salvo Fonti base).
  * Clic su `"Importa dagli Appunti"` → parsea il formato testuale (`4 Nome Carta`, sezioni `Mazzo` / `Riserva`),
    valida i nomi su SQLite e popola il mazzo.
  * Clic su `"Salva"` → `POST /api/decks` → salva in SQLite.

## 4. Schermata Campo di Battaglia (`/match/:id`) — `[UI]` + `[RULE]`
* **Fase Pre-Partita (Mulligan):** mostra le 7 carte pescate al centro dello schermo → pulsanti `"Tieni 7"` o `"Mulligan"`
  (dopo N mulligan l'utente sceglie N carte da mettere in fondo al mazzo).
* **Durante il Turno:**
  * **Giocare una Fonte:** doppio clic (o drag) su una Fonte dalla mano al campo → entra nella riga Fonti (max 1 per turno).
  * **Lanciare una Carta:** drag della carta sul campo → l'Auto-Tapper illumina le Fonti che verranno esaurite →
    se la carta richiede bersagli, compare una freccia che segue il cursore fino al clic sul bersaglio valido →
    la carta entra nella **Pila (Stack)** a destra.
  * **Passare Priorità / Risolvere:** clic sul pulsante arancione in basso a destra (`"Risolvi"` / `"Passa"` / `"Avanti"`, oppure tasto `Spazio`).
  * **Combattimento:** nella sottofase *Dichiara Attaccanti*, clic sulle creature per selezionarle (freccia rossa verso l'avversario) →
    clic su `"Attacca"`. Nella sottofase *Dichiara Bloccanti*, il difensore clicca sulla propria creatura e poi sull'attaccante → clic su `"Blocca"`.
  * **Risoluzione Sandbox (Fallback per carte complesse):** se viene risolta una carta senza script automatico, si apre un mini-pannello
    che permette di applicare l'effetto con 1 clic (modifica vita, pesca carte, sposta carta tra zone, aggiungi segnalino),
    mantenendo il flusso fluido. Ogni azione Sandbox è registrata nel log di partita e visibile all'avversario.

## 5. Scorciatoie da tastiera
`Spazio` passa priorità / risolve · `Invio` conferma · `Esc` annulla selezione · `F` passa fino al prossimo turno · `Z` zoom carta sotto il cursore.
