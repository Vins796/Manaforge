# Manaforge

Card game collezionabile 1v1 **originale** per desktop (Windows e Linux): partite contro bot AI e online P2P,
tutto in locale, senza server.

> Prima di contribuire leggi [`AGENT_RULES.md`](AGENT_RULES.md) e la documentazione in [`docs/`](docs/).

## Requisiti
- Node.js ≥ 22 (`.nvmrc`), npm ≥ 10

## Comandi
```bash
npm install
npm run typecheck   # tsc -b su tutti i package
npm test            # Vitest, tutti i progetti
npm run verify      # gate di fine step: typecheck + test con copertura
```

## Documentazione
| Documento | Contenuto |
|---|---|
| [01-prd](docs/01-prd.md) | Requisiti di prodotto |
| [02-trd](docs/02-trd.md) | Stack, DB, sicurezza, packaging |
| [03-app-flow](docs/03-app-flow.md) | Schermate e interazioni |
| [04-design-brief](docs/04-design-brief.md) | Design system originale |
| [05-backend-schema](docs/05-backend-schema.md) | Schema SQLite, stato in-memory, permessi |
| [06-implementation-plan](docs/06-implementation-plan.md) | Piano a step e registro test |
| [catalog](docs/catalog/README.md) | Documentazione classificata `[ARCH] [RULE] [API] [UI] [DATA] [TEST]` |
