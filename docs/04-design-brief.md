# 04 — Design Brief

## 1. Direzione

Il layout segue le **convenzioni del genere** dei duel card game digitali (campo diviso in due metà,
mano a ventaglio in basso, pila a lato, ritratti dei giocatori con punti vita), perché sono l'ergonomia attesa
dai giocatori. L'**identità visiva è originale**: nessun asset, icona, cornice, font proprietario o palette
riconducibile a MTG Arena o a Magic: The Gathering.

Tema: **"Forgia arcana"** — metallo brunito, braci, cristalli di mana incandescenti su pietra scura.

## 2. Design tokens

```css
:root {
  /* superfici */
  --mf-bg-0: #0d0f14;   /* fondo app */
  --mf-bg-1: #161a22;   /* pannelli */
  --mf-bg-2: #212734;   /* elementi elevati */
  --mf-line: #2f3646;
  /* testo */
  --mf-text-1: #ece8df;
  --mf-text-2: #a8a396;
  /* accento forgia */
  --mf-ember: #ff8a3d;
  --mf-ember-glow: #ffb36b;
  --mf-brass: #c9a45c;
  /* affinità (originali) */
  --mf-aff-ember: #e2553b;   /* Brace  — aggressione */
  --mf-aff-tide: #3b8fe2;    /* Marea  — controllo */
  --mf-aff-grove: #4fae5b;   /* Bosco  — crescita */
  --mf-aff-dawn: #e8d27a;    /* Alba   — protezione */
  --mf-aff-umbra: #8a5bd6;   /* Ombra  — sacrificio */
  --mf-aff-neutral: #9aa0aa; /* Incolore */
  /* stato */
  --mf-ok: #4fc38a; --mf-warn: #f2b84b; --mf-danger: #ef5a5a;
  /* tipografia */
  --mf-font-display: "Cinzel", serif;        /* titoli, nomi carte (Google Fonts, OFL) */
  --mf-font-ui: "Inter", system-ui, sans-serif;
  /* spaziatura e raggi */
  --mf-space-1: 4px; --mf-space-2: 8px; --mf-space-3: 12px; --mf-space-4: 16px; --mf-space-6: 24px;
  --mf-radius-card: 10px; --mf-radius-ui: 6px;
  /* movimento */
  --mf-ease: cubic-bezier(.2,.8,.2,1); --mf-dur-fast: 120ms; --mf-dur: 240ms;
}
```

Le affinità sono distinguibili anche per **forma del simbolo** (fiamma, onda, foglia, sole, luna) per accessibilità daltonici.

## 3. Layout campo di battaglia (1920×1080 di riferimento, scalabile 16:9 / 16:10)

```
┌──────────────────────────────────────────────────────────────┬───────┐
│ [Ritratto avversario ♥20]  mano avversario (dorso)  [mazzo/cimitero]│ PILA  │
│ ── risorse avversario ───────────────────────────────────────│       │
│ ── creature/permanenti avversario ───────────────────────────│ (ult. │
│ ═════════════════ linea di combattimento ════════════════════│ 5 ogg)│
│ ── creature/permanenti giocatore ────────────────────────────│       │
│ ── risorse giocatore ────────────────────────────────────────│ LOG   │
│ [Ritratto ♥20] [fasi turno]   MANO A VENTAGLIO   [bottone azione]   │       │
└──────────────────────────────────────────────────────────────┴───────┘
```

- **Indicatore fasi**: barra orizzontale con icone originali; la fase corrente è illuminata dal colore ember.
- **Bottone azione**: unico CTA contestuale in basso a destra; colore ember quando richiede attenzione.
- **Ispezione carta**: hover 400 ms → ingrandimento laterale con testo completo e regole delle parole chiave.

## 4. Anatomia della carta (originale)

```
┌───────────────────────┐  cornice in metallo inciso, colore = affinità
│ Nome            (2)◆◆ │  costo: cristalli sfaccettati con numero generico
│ ┌───────────────────┐ │
│ │   illustrazione    │ │  arte originale / placeholder procedurale (SVG generato)
│ └───────────────────┘ │
│ Tipo — Sottotipo   ◇  │  simbolo rarità a forma di gemma
│ testo regole          │
│ testo di colore       │
│                 [3/3] │  forza/resistenza in placca di ottone
└───────────────────────┘
```

Fino alla disponibilità di illustrazioni originali, l'arte è **generata proceduralmente** (pattern SVG deterministici dal codice carta).

## 5. Componenti chiave (catalogati in `docs/catalog/ui/`)

`Card`, `CardZoom`, `Hand`, `Battlefield`, `ResourceRow`, `StackPanel`, `PhaseBar`, `PlayerPortrait`,
`ActionButton`, `TargetArrow`, `DeckList`, `ManaCurveChart`, `CollectionGrid`, `PackOpening`, `Modal`, `Toast`.

## 6. Movimento e audio
- Animazioni ≤ 300 ms per azioni ricorrenti; effetti speciali ≤ 800 ms; tutte scalate dall'impostazione "velocità".
- `prefers-reduced-motion` rispettato.
- Audio: effetti sintetizzati/originali o da librerie CC0, catalogati con licenza.

## 7. Accessibilità
- Contrasto AA su tutto il testo UI, focus visibile (anello ember 2 px), tutte le azioni disponibili da tastiera.
- Testi carta ridimensionabili (100–150%).
