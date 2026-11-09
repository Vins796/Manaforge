# [DATA] 02 — Catalogo carte originale e cache immagini su disco

- **Step:** 2.1 · **Codice:** `packages/shared/src/{constants/keywords.ts,schemas/mana-cost.ts,schemas/card.ts}`,
  `apps/server/src/catalog/`, `apps/server/src/db/card-repository.ts`
- **Politica:** tutte le carte sono originali (`ARCH/00`). Nessun nome, testo, arte o dato proveniente da altri giochi.

## Flusso
```text
mf1-prima-fusione.json + mf2-correnti-astrali.json ──Zod──▶ CardCatalog ──toCardRecord──▶ CardRecord[] ──hash──▶ version
                                                                   │
startServer ─▶ syncCatalog(db, catalog) ─▶ tabella `cards` (catalog_version = version)
                                                                   │
(on-demand, GET /api/cards/:id/image/:variant) ImageCache.ensureCardImages(id) ─▶ ~/.manaforge/cache/images/<id>-<impronta>-{normal,crop}.svg
                                                              └▶ cards.local_image_{normal,crop}_path
```

## Moduli
| File | Responsabilità | Test |
|---|---|---|
| `shared/constants/keywords.ts` | 11 parole chiave (`ALATO` … `FULMINEO`) con nome visualizzato | `tests/constants/keywords.test.ts` |
| `shared/constants/affinities.ts` | + `MANA_COLORS` (palette del Design Brief) | `tests/constants/affinities.test.ts` |
| `shared/schemas/mana-cost.ts` | `parseManaCost` → generico, simboli, valore di mana, affinità; `affinitiesInText`; `ManaCostSchema` | `tests/schemas/mana-cost.test.ts` |
| `shared/schemas/card.ts` | `CardDefinitionSchema`, `CardCatalogSchema`, `toCardRecord`, `formatTypeLine`, `CARD_RARITIES`, `CARD_TYPES` | `tests/schemas/card.test.ts` |
| `server/catalog/mf1-prima-fusione.json` | blocco **MF1 — Prima Fusione** (48 carte) | `tests/catalog/card-catalog.test.ts` |
| `server/catalog/mf2-correnti-astrali.json` | blocco **MF2 — Correnti Astrali** (64 carte) | `tests/catalog/card-catalog.test.ts` |
| `server/catalog/card-catalog.ts` | `parseCatalogSources`, `loadBundledCatalog`, `computeCatalogVersion` | `tests/catalog/card-catalog.test.ts` |
| `server/catalog/catalog-sync.ts` | `syncCatalog(db, catalog)` → `CatalogSyncReport` | `tests/catalog/catalog-sync.test.ts` |
| `server/catalog/art-generator.ts` | `generateCardArt({ artSeed, affinityIdentity })` → SVG intero + ritaglio | `tests/catalog/art-generator.test.ts` |
| `server/catalog/image-cache.ts` | `createImageCache({ cards, cacheDir }).ensureCardImages(id)` | `tests/catalog/image-cache.test.ts` |
| `server/db/card-repository.ts` | `findById`, `listAll`, `setImagePaths` | `tests/db/card-repository.test.ts` |

## Formato del file di catalogo (`schemaVersion: 1`)
```json
{
  "schemaVersion": 1,
  "block": { "code": "MF1", "name": "Prima Fusione" },
  "cards": [
    { "id": "MF1-029", "name": "Scintilla Rovente", "cost": "{F}", "type": "Rapido",
      "rulesText": "Scintilla Rovente infligge 3 danni a qualsiasi bersaglio.", "rarity": "comune", "artSeed": "scintilla-rovente" }
  ]
}
```

| Campo | Regola |
|---|---|
| `id` | `<BLOCCO>-<NNN>`, prefisso uguale a `block.code`; sicuro come nome file |
| `name` | 1–40 caratteri: lettere, spazi, apostrofi, virgole, trattini; unico (case-insensitive) in tutto il catalogo |
| `cost` | simboli `{N}` (0–20, uno solo e in testa; `{0}` solo da solo) e `{A}{M}{O}{F}{S}{C}`, max 12; `""` **solo** per le Fonti |
| `type` / `subtypes` | `Creatura`, `Rituale`, `Rapido`, `Artefatto`, `Fonte`, `Fonte base`; max 3 sottotipi (una parola maiuscola); `typeLine` = `Tipo — Sotto Tipi` |
| `power` / `toughness` | interi 0–20, obbligatori per e solo per le Creature |
| `keywords` | codici di `KEYWORD_CODES`, senza duplicati, solo sulle Creature; il testo delle parole chiave è reso dalla UI, non va ripetuto in `rulesText` |
| `rulesText` | ≤ 400 caratteri; i simboli `{A}`…`{S}` citati contribuiscono all'identità di affinità |
| `rarity` | `comune`, `non_comune`, `rara`, `mitica`; una `Fonte base` è sempre comune con un solo sottotipo (l'affinità) |
| `artSeed` | `[a-z0-9-]`, max 64, unico nel blocco |

Campi derivati (`toCardRecord`): `manaValue`, `typeLine`, `affinities` (dal costo), `affinityIdentity` (costo ∪ simboli nel testo),
parole chiave in ordine canonico. Le Fonti base sono le carte esenti dal limite di 4 copie (`typeLine` che inizia per `Fonte base`).

## Importer idempotente
- **Versione:** `v1-` + primi 16 hex di SHA-256 dei `CardRecord` ordinati per id. Cambia se e solo se cambia una carta
  (o il formato); l'ordine nel file è irrilevante.
- **Up-to-date:** se tutte le carte del catalogo sono già in `cards` con la stessa `catalog_version`, nessuna scrittura.
- **Import:** un'unica transazione: insert delle nuove, update delle esistenti (percorsi immagine azzerati se cambia
  `art_seed`), delete delle carte uscite dal catalogo **non** usate da alcun mazzo (`deck_cards.card_id` è `RESTRICT`).
  Le carte trattenute sono riportate in `retained` e mantengono la vecchia `catalog_version`.
- **Errori:** `CATALOG_INVALID` / `CATALOG_CONFLICT` (validazione, blocchi o nomi duplicati), `CATALOG_SYNC_FAILED` (rollback completo).
  In entrambi i casi `startServer` non si avvia e chiude il DB.

## Illustrazioni procedurali
- **Deterministiche:** PRNG `sfc32` inizializzato da `SHA-256("<versione>:<artSeed>")`; palette dai colori dell'identità
  (`MANA_COLORS`, incolore se vuota, due colori se multi-affinità). Algoritmo alla **versione 2** (`ART_GENERATOR_VERSION`).
- **Input:** `artSeed`, `affinityIdentity`, `typeLine` e `keywords` (letti dalla riga `cards` da `ImageCache`).
- **Scena 630×880 (63:88):** cielo sfumato, alone, atmosfera, tre crinali, soggetto, vignettatura.
- **Atmosfera per affinità principale:** Alba raggi di luce · Marea onde e bolle · Ombra luna eclissata e nebbia ·
  Fiamma braci e scintille · Selva foglie · incolore schegge geometriche.
- **Soggetto per tipo** (`artSubject`): Creatura → sagoma · Fonte/Fonte base → cristalli con fascio di luce ·
  Rituale → cerchio runico con stella · Rapido → fulmini · Artefatto → ingranaggio con gemma · tipo assente → sigillo (stile v1).
- **Sagome delle creature** (`creatureFamily`, dal primo sottotipo riconosciuto): umanoide (testa tonda, cornuta o con cresta),
  bestia quadrupede (Lupo, Orso, Drago, Ragno…), serpente (Serpente, Leviatano, Idra, Medusa), volatile (Uccello, Grifone,
  Fenice, Pipistrello: sempre con ali), costrutto (Costrutto, Golem, Elementale). Con **Alato** umanoidi e bestie hanno le ali.
  Un nuovo sottotipo senza famiglia ricade su umanoide: per dargli una sagoma basta aggiungerlo a `FAMILY_BY_SUBTYPE`.
  Il ritaglio `crop` è la stessa scena con `viewBox` 4:3 centrato (`0 204 630 472`) per `CardCompactView`.
- **Sicurezza:** nessun testo della carta entra nell'SVG (solo numeri e colori fissi), niente script né riferimenti esterni;
  gli `id` interni sono prefissati dall'impronta, così più SVG inline nella stessa pagina non collidono.
- **Cache:** nome file `<id>-<impronta 12 hex>-<variante>.svg`, impronta = hash di versione algoritmo + seed + identità + riga del tipo + ali
  → la cache si invalida da sola. Scrittura atomica (tmp + `rename`); cache hit solo se il DB registra quei percorsi
  e sono file regolari. Generazione **on-demand** (TRD §4), esposta dallo step 2.2 con `GET /api/cards/:id/image/{normal|crop}` (vedi `UI/01-deckbuilder.md`).
- **Limite noto:** le immagini orfane (arte cambiata o carta rimossa) restano su disco; la pulizia è rimandata.

## Contenuto dei blocchi

### MF1 — Prima Fusione (48 carte)
5 Fonti base (una per affinità) + 1 Fonte incolore, 7–8 carte per affinità, 3 incolori, 3 multi-affinità; tutte le
11 parole chiave sono usate almeno una volta. Include le carte citate dai test di regole (*Scintilla Rovente*, *Vigore della Selva*).

### MF2 — Correnti Astrali (64 carte)
5 Fonti doppie non base (`Entra in campo esaurita. Esaurisci: aggiungi {X} o {Y}.`) per le coppie alleate Alba–Marea,
Marea–Ombra, Ombra–Fiamma, Fiamma–Selva, Selva–Alba; 10 carte per affinità (6 creature, 4 magie: rimozioni, pesca,
potenziamenti, pedine, effetti di massa); 4 incolori (2 Costrutti, 2 Artefatti); 5 creature multi-affinità sulle stesse
coppie delle Fonti doppie. Usa tutte le 11 parole chiave; nessuna nuova Fonte base. Gli effetti senza script automatico
saranno gestiti dal resolver Sandbox dello step 3.4.
