# 06 — Implementation Plan & Registro Test

Regola: si lavora su **un solo sotto-step** alla volta. Uno step è `[x]` solo con `npm run verify` verde,
documentazione aggiornata e voce nel catalogo. Dopo ogni step: commit e richiesta di conferma.

## Fase 1 — Fondamenta
- [x] **1.1** Scaffold monorepo: struttura directory, documenti 01–06, `AGENT_RULES.md`, `package.json` workspace, `tsconfig`, Vitest multi-progetto, smoke test per ogni package.
- [ ] **1.2** Autenticazione locale: bootstrap `packages/db` (connessione, runner migrazioni, tabella `profiles`), `AuthService` (crea profilo, login, logout, lockout, cambio password), identità Ed25519 cifrata, schemi Zod in `shared`.
- [ ] **1.3** Qualità: ESLint flat config, Prettier, script `lint`, workflow CI GitHub Actions (Linux + Windows).
- [ ] **1.4** Shell Electron: finestra sicura, preload con bridge IPC tipizzato, canali `auth:*`, schermate Crea profilo/Login minimali, E2E Playwright di login.

## Fase 2 — Carte, collezione, mazzi
- [ ] **2.1** Modello carta + DSL abilità in `cards`, primo blocco di 40 carte originali, `cardset_hash`.
- [ ] **2.2** Collezione e mazzi (migrazioni, repository, servizi), mazzi precostruiti iniziali.
- [ ] **2.3** Validazione formato e import/export testuale.

## Fase 3 — Motore regole (`engine`)
- [ ] **3.1** Stato di gioco, zone, PRNG xoshiro128**, id oggetti, serializzazione canonica.
- [ ] **3.2** Struttura del turno, fasi, priorità, mulligan.
- [ ] **3.3** Risorse, costi, pagamento.
- [ ] **3.4** Pila, lancio, risoluzione, bersagli e legalità.
- [ ] **3.5** Combattimento e parole chiave base.
- [ ] **3.6** Azioni basate sullo stato e condizioni di vittoria.
- [ ] **3.7** Abilità innescate, statiche ed effetti continui (layer).
- [ ] **3.8** Event log, replay, generatore di azioni legali.

## Fase 4 — Bot
- [ ] **4.1** Bot *Apprendista* (euristico).
- [ ] **4.2** Bot *Adepto* (funzione di valutazione + lookahead).
- [ ] **4.3** Bot *Maestro* (MCTS con determinizzazione).

## Fase 5 — P2P
- [ ] **5.1** Protocollo: messaggi Zod, firma Ed25519, sequenze, handshake versione/cardset.
- [ ] **5.2** Lockstep + hash di stato + commit-reveal seed; test loopback bot-vs-bot (1.000 partite, 0 desync).
- [ ] **5.3** Trasporto WebRTC + signaling manuale (codici) + scoperta LAN.
- [ ] **5.4** Riconnessione e abbandono.

## Fase 6 — UI
- [ ] **6.1** Design tokens, componenti base, carta con arte procedurale.
- [ ] **6.2** Home, profilo, impostazioni.
- [ ] **6.3** Collezione e deck builder.
- [ ] **6.4** Campo di battaglia vs Bot.
- [ ] **6.5** Lobby online e partita P2P.
- [ ] **6.6** Animazioni, audio, accessibilità, replay viewer, buste.

## Fase 7 — Packaging e release
- [ ] **7.1** electron-builder Windows (NSIS) e Linux (AppImage, .deb), rebuild moduli nativi.
- [ ] **7.2** Suite E2E completa in CI su entrambe le piattaforme.
- [ ] **7.3** Release 1.0.

---

## Registro Test

| Step | Data | Suite / file | Test | Esito | Copertura | Note |
|---|---|---|---|---|---|---|
| 1.1 | 2026-11-09 | `packages/*/test/smoke.test.ts`, `packages/shared/test/result.test.ts` | 10 (7 file) | ✅ 10/10 | 100% righe/branch | Vitest 5 multi-progetto (6 progetti), `tsc -b` verde, soglia copertura globale 80% |
