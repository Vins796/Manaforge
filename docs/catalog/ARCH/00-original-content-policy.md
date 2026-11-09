# [ARCH] 00 — Politica dei contenuti originali

- **Stato:** Accettato · **Step:** 1.1 · **Data:** 2026-11-09

## Contesto
Il brief di partenza descriveva il prodotto come replica di *MTG Arena*, con catalogo carte Scryfall, nomi di carte,
avatar, nome del bot, simboli di mana e HUD del prodotto commerciale. Nomi, testi, illustrazioni, simboli e trade dress
di *Magic: The Gathering* sono marchi e opere protette di Wizards of the Coast: includerli renderebbe il progetto
non distribuibile (inclusi Microsoft Store e Flathub, target del PRD).

## Decisione
Si mantengono **stack, architettura, flussi e processo** del brief; si sostituiscono solo gli elementi protetti:

| Brief originale | Manaforge |
|---|---|
| Catalogo Scryfall + immagini dalla CDN | Catalogo JSON originale nel repo + illustrazioni procedurali cachate su disco |
| Colori WUBRG | Affinità Alba (`A`), Marea (`M`), Ombra (`O`), Fiamma (`F`), Selva (`S`), Incolore (`C`) |
| Terre / tap | Fonti / esaurire |
| Stregoneria / Istantaneo | Rituale / Rapido |
| Flying, Reach, Trample, Haste, Vigilance, Deathtouch, Lifelink, First/Double Strike, Ward, Flash | Alato, Vedetta, Sfondamento, Scatto, Sentinella, Veleno, Linfa, Fendente, Doppio Fendente, Egida, Fulmineo |
| Bot "Sparky", avatar "jace" | Bot "Tizzo", avatar "forgiatore" |
| Formato import MTG Arena | Formato testuale `N Nome Carta` con sezioni `Mazzo` / `Riserva` |
| Font MPlantin | Crimson Pro (OFL) |
| Fase UNTAP | Fase READY |

## Conseguenze
- Le meccaniche di genere restano identiche nel comportamento; cambiano nomi, testi e grafica.
- Ogni nuova carta, parola chiave o asset va verificato contro questa politica in review.
