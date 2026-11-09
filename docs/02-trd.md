# 02. TRD (Technical Requirements Document) — Manaforge

## 1. Stack Tecnologico (`[ARCH]`)
* **Gestione Monorepo:** `pnpm` workspaces (`packages/shared`, `packages/engine`, `apps/server`, `apps/desktop-client`).
* **Linguaggio:** TypeScript `strict: true` su tutto lo stack, ESM, project references (`tsc -b`).
* **Runtime:** Node.js 22 LTS.
* **Testing Framework:** `Vitest` per Unit/Integration test (Engine e Backend) + `React Testing Library` e `Playwright` per la UI.
* **Desktop Wrapper (Store Windows & Linux):** **Tauri v2** — genera pacchetti `.msix` / `.exe` per Windows e `.flatpak` / `.AppImage` per Linux.

## 2. Frontend (`[UI]`)
* **Framework:** React + Vite (versione stabile corrente al momento dello step UI).
* **Styling & Animazioni:** Tailwind CSS + Framer Motion (transizioni carte: pescata, esaurimento con rotazione di 15°, ingresso in pila, frecce di attacco/bersaglio).
* **State Management:** `Zustand` sincronizzato con gli eventi WebSocket ricevuti dal server.

## 3. Backend Locale & Rete (`[API]`)
* **Server Integrato:** Node.js + Fastify + `Socket.io`, avviato automaticamente in background dall'app desktop come
  **sidecar Tauri** (binario Node Single Executable Application generato in fase di packaging).
* **Connessione Amico a Costo Zero:** LAN virtuale (Tailscale/ZeroTier) o tunnel effimero gratuito `cloudflared`
  per permettere all'amico di connettersi via WebSocket (`wss://`) direttamente al PC che fa da Host.
* **Autorità di gioco:** il motore gira solo sul server dell'Host; i client inviano intenzioni (`GameAction`) e ricevono
  stati filtrati (`sanitizeGameStateForPlayer`).

## 4. Database e Storage Locale (`[DATA]`)
* **Database:** **SQLite** locale (file `~/.manaforge/data/manaforge.db`) gestito tramite **Drizzle ORM** sul driver
  **better-sqlite3** (WAL, chiavi esterne attive). Migrazioni SQL generate da `drizzle-kit` in `apps/server/drizzle/`
  e applicate automaticamente all'avvio. Zero configurazione richiesta dall'utente (ADR: `docs/catalog/ARCH/02-drizzle-orm.md`).
* **Catalogo carte (originale):**
  * Le definizioni delle carte sono file JSON versionati in `apps/server/src/catalog/` e validati con Zod.
  * Al primo avvio (o quando cambia l'hash del catalogo) vengono importati nella tabella SQLite `cards`.
* **Gestione Immagini Carte (On-Demand Disk Cache):**
  * Le illustrazioni sono generate proceduralmente (SVG deterministico dal `artSeed` della carta) solo quando una carta
    viene visualizzata o inserita in un mazzo, e salvate in `~/.manaforge/cache/images/` per il caricamento istantaneo offline.
  * In futuro potranno essere sostituite da illustrazioni originali con licenza, mantenendo lo stesso percorso di cache.

## 5. Autenticazione (`[API]`)
* **Manuale:** password hashata con `argon2id`, sessione gestita tramite token `JWT` (firmato con segreto generato
  localmente al primo avvio e salvato in `~/.manaforge/data/`).
* **Google Login:** flusso `OAuth 2.0` con PKCE per app desktop (loopback redirect), tramite Client ID gratuito di Google Cloud Console.

## 6. Sicurezza
* Validazione Zod di ogni payload REST e Socket.io; rate limit sugli endpoint di autenticazione.
* Tauri: allowlist minima dei comandi, CSP restrittiva.
* Nessun segreto nel repository; `.env` escluso da git.
