# 02 — Technical Requirements Document (TRD)

## 1. Stack tecnologico

| Livello | Scelta | Motivazione |
|---|---|---|
| Runtime | **Node.js 22 LTS** (dev/test), Node integrato in Electron (prod) | LTS, ESM nativo |
| Linguaggio | **TypeScript** strict, ESM | Sicurezza dei tipi su motore complesso |
| Desktop shell | **Electron** (ultima stabile al momento dello step 1.4) | Cross-platform Win/Linux, WebRTC nativo in Chromium |
| Build | **electron-vite** (main/preload/renderer) | HMR, bundle separati |
| UI | **React** + CSS Modules + design tokens CSS | Ecosistema, testabilità |
| Stato UI | **Zustand** (store per schermata) | Leggero, nessun boilerplate |
| Animazioni | **Framer Motion** + Canvas/WebGL (PixiJS) solo per effetti | Fluidità del campo di battaglia |
| Validazione | **Zod** | Schemi condivisi IPC/rete/file |
| Database | **SQLite** via **better-sqlite3** (WAL) | Sincrono, veloce, file singolo, zero server |
| Crittografia | `node:crypto` (scrypt, Ed25519, SHA-256) nel main; WebCrypto nel renderer se necessario | Nessuna libreria esterna per primitive standard |
| Rete P2P | **WebRTC DataChannel** (RTCPeerConnection nativo di Chromium) | NAT traversal, cifratura DTLS integrata |
| Signaling | Manuale (codice invito base64url compresso) + scoperta LAN (UDP multicast) | Nessun server proprio |
| STUN | Server STUN pubblici gratuiti configurabili; TURN opzionale fornito dall'utente | Costo zero |
| Test | **Vitest** (unit/integration, progetti multipli), **Playwright** (E2E Electron) | Velocità, ESM nativo |
| Qualità | ESLint (flat config) + Prettier, CI GitHub Actions (Win + Linux) | Uniformità |
| Packaging | **electron-builder**: NSIS (Windows x64), AppImage + .deb (Linux x64) | Installer standard |

## 2. Architettura logica

```
┌────────────────────── apps/desktop ──────────────────────┐
│ renderer (React, sandbox)  ⇄ preload (contextBridge) ⇄  main │
│   UI, input, animazioni        API tipizzata             │  ├─ AuthService / ProfileService
│                                                          │  ├─ db (better-sqlite3)
│                                                          │  ├─ MatchHost (engine + ai)
└──────────────────────────────────────────────────────────┘  └─ net (signaling LAN, chiavi)
           │ WebRTC DataChannel (nel renderer, messaggi firmati dal main)
           ▼
       peer remoto
```

- Il **motore** (`packages/engine`) è una libreria pura: `applyAction(state, action) → Result<{state, events}>`.
- La partita è **event-sourced**: lo stato è derivabile da `seed + lista azioni`. Questo abilita replay, lockstep e undo controllato.
- Il main process è l'autorità locale: valida, firma e persiste. Il renderer visualizza eventi e invia intenzioni.

## 3. Database locale

- File: `<userData>/manaforge.db` (SQLite, `journal_mode=WAL`, `foreign_keys=ON`).
- Migrazioni SQL versionate in `packages/db/src/migrations/NNNN_nome.sql`, applicate all'avvio in transazione, tabella `schema_migrations`.
- Dettaglio tabelle in `docs/05-backend-schema.md`.
- Backup automatico prima di ogni migrazione (`manaforge.db.bak-<versione>`).

## 4. Sicurezza

- Password: `scrypt` (N=2^15, r=8, p=1, keylen 64) + salt 16 byte, confronto `timingSafeEqual`.
- Chiave privata Ed25519 del profilo cifrata con AES-256-GCM, chiave derivata dalla password (scrypt, salt distinto).
- Electron: `contextIsolation`, `sandbox`, `nodeIntegration: false`, `webSecurity: true`, CSP `default-src 'self'`, navigazione esterna bloccata, `setWindowOpenHandler` → deny.
- Messaggi di rete: schema Zod + firma Ed25519 + numero di sequenza monotono (anti-replay); dimensione massima 64 KiB.

## 5. Determinismo del motore

- PRNG **xoshiro128\*\*** con seed a 128 bit; stato del PRNG parte dello stato di gioco.
- Seed P2P = `SHA-256(seedA ‖ seedB)` con commit-reveal: ciascun peer pubblica `SHA-256(seed)` prima di rivelarlo.
- Identificatori degli oggetti assegnati da contatore monotono nello stato.
- Hash di stato: SHA-256 della serializzazione canonica (chiavi ordinate) — calcolato in `net`, non nel motore.

## 6. Packaging e distribuzione

| OS | Target | Note |
|---|---|---|
| Windows 10/11 x64 | NSIS installer + portable | Rebuild `better-sqlite3` per l'ABI di Electron (`electron-builder install-app-deps`) |
| Linux x64 | AppImage, .deb | Testato su Ubuntu 22.04+/Fedora 39+ |

- Nessun auto-update da server proprio; eventuale controllo versione tramite GitHub Releases (opzionale, disattivabile).
- CI: matrice `ubuntu-latest` + `windows-latest`: typecheck, test, build, E2E headless (xvfb su Linux).

## 7. Vincoli di ambiente

- `engines.node >= 22`. Package manager: **npm workspaces** (nessuno strumento aggiuntivo).
- I package in `packages/*` sono consumati come sorgenti TS dai test (alias Vitest) e compilati con `tsc -b` per il typecheck.
