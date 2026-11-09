# AGENT_RULES.md — Regole di ingegneria di Manaforge

> Fonte di verità per chiunque (umano o agente AI) scriva codice in questo repository.
> In caso di conflitto con altri documenti, **vince questo file**, poi `docs/02-trd.md`.

---

## 0. Identità del progetto e vincoli di proprietà intellettuale

- Nome del prodotto: **Manaforge**. Il nome di lavoro "MTG Arena Clone" indica il **genere** (card game
  collezionabile 1v1 basato su risorse/"mana"), **non** una replica del prodotto commerciale.
- **Vietato** includere nel repository: nomi, testi, illustrazioni, simboli, set, icone, suoni, loghi o
  trade dress di *Magic: The Gathering* / *MTG Arena* (marchi di Wizards of the Coast).
  Questo include i nomi delle carte, il testo di regola copiato dalle Comprehensive Rules e la grafica dell'interfaccia.
- Consentito: meccaniche di genere (risorse, pila/stack, fasi di turno, combattimento, parole chiave generiche)
  descritte con **terminologia e testi originali**. Tutte le carte sono originali e definite in `packages/cards`.

## 1. Albero delle directory (vincolante)

```
/
├── AGENT_RULES.md            # questo file
├── .cursorrules              # puntatore a AGENT_RULES.md per gli IDE
├── package.json              # root workspace (npm workspaces)
├── tsconfig.base.json        # opzioni TS condivise
├── tsconfig.json             # solution file (project references)
├── vitest.config.ts          # runner test multi-progetto
├── apps/
│   └── desktop/              # applicazione Electron (unico "app")
│       └── src/
│           ├── main/         # processo main: finestra, IPC handlers, DB, P2P bootstrap
│           ├── preload/      # bridge IPC tipizzato (contextIsolation)
│           └── renderer/     # UI React (nessun accesso a Node)
├── packages/                 # librerie pure, testabili senza Electron
│   ├── shared/               # tipi, costanti, schemi Zod, contratti IPC/rete, Result<T,E>
│   ├── engine/               # motore regole deterministico (zero I/O)
│   ├── cards/                # definizioni carte originali + DSL abilità
│   ├── ai/                   # bot (euristico, poi MCTS)
│   ├── net/                  # protocollo P2P lockstep, trasporto WebRTC, anti-cheat
│   └── db/                   # SQLite: connessione, migrazioni, repository
│       └── (ogni package) src/ + test/ + package.json + tsconfig.json
├── tests/
│   └── e2e/                  # test end-to-end (Playwright + Electron)
├── scripts/                  # script di build/packaging/manutenzione
└── docs/
    ├── 01-prd.md … 06-implementation-plan.md
    └── catalog/
        ├── arch/   [ARCH]  decisioni architetturali (ADR)
        ├── rules/  [RULE]  regole di gioco implementate
        ├── api/    [API]   canali IPC, messaggi di rete, API pubbliche dei package
        ├── ui/     [UI]    componenti e schermate
        ├── data/   [DATA]  tabelle, migrazioni, formati dati
        └── test/   [TEST]  strategia e suite di test
```

Regole:
1. **Non creare file fuori da questo albero.** Una nuova cartella di primo livello richiede un ADR in `docs/catalog/arch/`.
2. I test unit/integration vivono in `<package>/test/` con suffisso `.test.ts`. Gli E2E in `tests/e2e/` con suffisso `.e2e.ts`.
3. Dipendenze ammesse tra package (grafo aciclico, verificato in review):
   `shared ← cards ← engine ← ai`, `shared ← net`, `shared ← db`, `apps/desktop → tutti`.
   `engine` **non** importa mai `db`, `net`, Electron, DOM o API Node (`fs`, `crypto` di Node, ecc.).
4. Il renderer non importa mai `db`, `net/transport-node` o moduli Node: passa sempre dal preload.

## 2. Standard di codice

- **TypeScript strict** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). Niente `any`: usare `unknown` + narrowing.
- **ESM** ovunque (`"type": "module"`), import con estensione esplicita `.js` nei sorgenti TS.
- Errori attesi di dominio → `Result<T, E>` (da `@manaforge/shared`). `throw` solo per errori di programmazione/invarianti violate.
- Ogni input proveniente da IPC, rete o file è **validato con Zod** al confine prima di entrare nel dominio.
- Il motore regole è **deterministico**: nessun `Math.random`, `Date.now`, iterazione su `Map` non ordinata che influenzi lo stato. RNG solo tramite PRNG con seed.
- Funzioni piccole e pure; side effect confinati in `apps/desktop/src/main`, `packages/db`, `packages/net`.
- Nomi: `camelCase` per funzioni/variabili, `PascalCase` per tipi/classi/componenti, `SCREAMING_SNAKE_CASE` per costanti, file in `kebab-case.ts` (componenti React `PascalCase.tsx`).
- Sicurezza Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP restrittiva, nessun `remote`.
- Segreti/credenziali: mai in chiaro su disco; password con `scrypt` + salt; chiavi di identità P2P cifrate.

## 3. Documentazione continua (obbligatoria)

1. Ogni simbolo esportato ha **TSDoc** (`@param`, `@returns`, `@throws` se applicabile, `@example` se non ovvio).
2. Ogni modulo/regola/canale/componente/tabella/suite va registrato in `docs/catalog/<categoria>/` con una voce:

   | Tag | Cartella | Contenuto della voce |
   |---|---|---|
   | `[ARCH]` | `arch/` | ADR: contesto, decisione, alternative, conseguenze |
   | `[RULE]` | `rules/` | regola di gioco, riferimento al codice, casi limite, test collegati |
   | `[API]`  | `api/`  | firma, schema di input/output, errori, versione |
   | `[UI]`   | `ui/`   | componente/schermata, props, stati, accessibilità |
   | `[DATA]` | `data/` | tabella/formato, colonne, vincoli, migrazione |
   | `[TEST]` | `test/` | suite, cosa copre, come eseguirla |

3. Nome file voce: `<TAG>-<NNN>-<slug>.md` (es. `ARCH-001-monorepo.md`). Ogni cartella ha un `README.md` indice aggiornato.
4. Ogni voce cita il percorso del codice e i file di test relativi.

## 4. Testing (TDD gatekeeping)

- Runner: **Vitest** (progetti multipli da `vitest.config.ts`); E2E: **Playwright** con Electron.
- Uno step **non è completato** finché: `npm run typecheck` e `npm test` passano al 100%, e la copertura dei package toccati è ≥ 80% righe (≥ 90% per `engine`).
- Ogni regola di gioco ha almeno un test positivo e un caso limite. Ogni bug fixato porta con sé un test di regressione.
- I test non dipendono da rete, ora di sistema o ordine di esecuzione.

## 5. Flusso di lavoro per step

1. Lavorare su **un solo sotto-step** di `docs/06-implementation-plan.md` alla volta.
2. Ciclo: test rosso → implementazione → test verde → refactor → documentazione → catalogo.
3. A fine step: eseguire `npm run verify`, aggiornare il **Registro test** in `06-implementation-plan.md`, spuntare `[x]`, fare commit (Conventional Commits, es. `feat(engine): …`), **fermarsi e chiedere conferma**.
