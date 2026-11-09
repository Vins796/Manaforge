# 03 — App Flow

## 1. Mappa delle schermate

```
[Avvio/Splash] → [Selezione profilo] ─┬→ [Crea profilo]
                                      └→ [Login] → [Home]
[Home] ─┬→ [Gioca] ─┬→ [vs Bot: scelta mazzo + difficoltà] → [Mulligan] → [Partita] → [Risultato]
        │           └→ [Online: Crea stanza | Unisciti | LAN] → [Lobby] → [Mulligan] → [Partita] → [Risultato]
        ├→ [Mazzi] → [Deck builder]
        ├→ [Collezione]
        ├→ [Buste] (apertura ricompense)
        ├→ [Replay]
        ├→ [Profilo] (cambio password, chiave pubblica, statistiche, elimina)
        └→ [Impostazioni]
```

## 2. Flussi dettagliati

### 2.1 Avvio
1. Il main apre il DB, esegue le migrazioni (splash con progresso). Errore → schermata di ripristino con opzione "ripristina backup".
2. Nessun profilo → [Crea profilo]. Altrimenti → [Selezione profilo] con avatar e nome.

### 2.2 Autenticazione
| Azione | Validazione | Esito OK | Esito KO |
|---|---|---|---|
| Crea profilo | nome 3–24, univoco; password ≥ 8, conferma uguale | profilo + identità P2P + collezione iniziale → [Home] | messaggio inline sul campo |
| Login | profilo esistente, password | sessione attiva → [Home] | "Password errata" + contatore; blocco 60 s dopo 5 errori |
| Logout | — | sessione distrutta, chiave privata rimossa dalla memoria → [Selezione profilo] | — |

### 2.3 Partita vs Bot
1. Scelta mazzo (solo mazzi validi abilitati) e difficoltà.
2. Lancio moneta (seed locale) → chi inizia sceglie se giocare o pescare per primo.
3. Mulligan: mano di 7, possibilità di rimescolare con una carta in meno (fino a 5).
4. Loop di partita (vedi §3). Il bot agisce con ritardo minimo visivo di 400 ms.
5. Risultato: vittoria/sconfitta, statistiche, ricompensa busta (solo vittoria), salva replay.

### 2.4 Partita online P2P
1. **Host** sceglie mazzo → "Crea stanza" → viene mostrato un *codice offerta*. Lo copia e lo invia all'amico (chat esterna).
2. **Guest** incolla il codice → l'app genera un *codice risposta* da rimandare all'host.
3. Host incolla la risposta → connessione DataChannel stabilita. (Alternativa LAN: lista host trovati, un clic.)
4. Handshake: versione protocollo, hash set carte, chiavi pubbliche, nomi. Incompatibilità → errore esplicito.
5. Commit-reveal dei seed → lancio moneta → mulligan → partita in lockstep.
6. Disconnessione: banner "In attesa dell'avversario (120 s)"; scaduto il tempo → vittoria per abbandono.
7. Desync (hash di stato differente) → partita sospesa, log diagnostico salvato, nessun vincitore.

### 2.5 Deck builder
- Pannello collezione filtrabile a sinistra, lista mazzo a destra, curva dei costi in basso.
- Clic/drag per aggiungere; tasto destro per rimuovere. Indicatore validità in tempo reale.
- Salvataggio esplicito; uscita con modifiche non salvate → dialog di conferma.

## 3. Loop di partita e interazioni

| Momento | Interazione utente | Feedback UI |
|---|---|---|
| Ottieni priorità | bottone principale contestuale ("Passa", "Fine turno", "Risolvi") | bordo luminoso sulla propria area |
| Giocare una carta | drag dalla mano al campo o doppio clic | carte giocabili evidenziate |
| Pagare il costo | auto-pagamento suggerito, modificabile cliccando le risorse | contatore costo residuo |
| Scegliere bersagli | clic sui bersagli validi (gli altri sono oscurati) | freccia dal sorgente al bersaglio |
| Attacco | clic sulle creature attaccanti, "Conferma attacco" | creature inclinate in avanti |
| Blocco | drag bloccante → attaccante | linea di collegamento |
| Risposta | finestra di priorità con pila visibile a destra | pila animata |
| Annulla | `Esc` prima della conferma del pagamento | — |

Scorciatoie: `Spazio` passa priorità, `Enter` conferma, `Esc` annulla, `Ctrl+Z` annulla selezione, `F` auto-pass fino al prossimo turno.

## 4. Stati di errore globali
- DB corrotto → ripristino da backup.
- Crash del renderer → il main conserva lo stato della partita e la ricarica.
- Versione set carte diversa in P2P → messaggio con le due versioni.
