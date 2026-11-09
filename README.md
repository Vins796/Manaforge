# Manaforge

Card game collezionabile 1v1 **originale** per desktop (Windows e Linux): partite contro il bot "Tizzo" o contro
un amico online, tutto in locale, senza server a pagamento.

> Prima di contribuire leggi [`.cursorrules`](.cursorrules) e la documentazione in [`docs/`](docs/).

## Requisiti
Node.js ≥ 22 (`.nvmrc`), pnpm ≥ 10 (`corepack enable`).

## Comandi
```bash
pnpm install
pnpm typecheck   # tsc -b su tutti i workspace
pnpm test        # Vitest, tutti i progetti
pnpm verify      # gate di fine step: typecheck + test con copertura
```

## Struttura
`packages/shared` · `packages/engine` · `apps/server` · `apps/desktop-client` — dettagli in `.cursorrules §1`.

## Documentazione
[01-prd](docs/01-prd.md) · [02-trd](docs/02-trd.md) · [03-app-flow](docs/03-app-flow.md) · [04-design-brief](docs/04-design-brief.md) ·
[05-backend-schema](docs/05-backend-schema.md) · [06-implementation-plan](docs/06-implementation-plan.md) · [catalog](docs/catalog/README.md)

## Avvio in sviluppo
```bash
pnpm --filter @manaforge/server build && node apps/server/dist/main.js   # API su http://127.0.0.1:47821
pnpm --filter @manaforge/desktop-client dev                               # UI su http://localhost:5173
```
Login Google opzionale: impostare `MANAFORGE_GOOGLE_CLIENT_ID` (e `MANAFORGE_GOOGLE_CLIENT_SECRET`) con un client OAuth di tipo
"Desktop app" e redirect `http://127.0.0.1:47821/api/auth/google/callback`.
