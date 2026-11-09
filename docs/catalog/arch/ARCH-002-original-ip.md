# ARCH-002 — Prodotto originale: nessun contenuto di terze parti

- **Stato:** Accettato · **Step:** 1.1 · **Data:** 2026-11-09

## Contesto
Il brief iniziale descrive il prodotto come "MTG Arena Clone". Replicare nomi, carte, testi, arte o interfaccia
di Magic: The Gathering / MTG Arena violerebbe marchi e diritti d'autore di Wizards of the Coast e renderebbe
il progetto non distribuibile.

## Decisione
- Nome prodotto **Manaforge**; si replica il **genere** (duel TCG a risorse, pila, fasi, combattimento), non il prodotto.
- Carte, terminologia, parole chiave, testi di regola, iconografia, palette e font sono originali (vedi `docs/04-design-brief.md`).
- Arte delle carte generata proceduralmente finché non esistono illustrazioni originali; audio originale o CC0 con licenza catalogata.

## Conseguenze
- Revisione obbligatoria: nessun nome/testo di carte esistenti nei dati di `packages/cards`.
- Il layout segue convenzioni ergonomiche di genere, con identità visiva propria.
