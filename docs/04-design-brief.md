# 04. Brief di Design (Design System & HUD di gioco) — Manaforge

> Il layout segue le convenzioni ergonomiche dei card game digitali (campo diviso, mano a ventaglio, pila laterale).
> L'identità visiva — cornici, icone, simboli, font, avatar — è **originale**. Tema: **"Forgia arcana"**.

## 1. Palette Colori (`[UI]`)
* **Background Principale:** `#0B0E14` (Nero/Blu Abisso)
* **Superfici Tavolo da Gioco (Battlefield Mat):** `#141923` (metà giocatore) / `#10141D` (metà avversario) divise da una linea luminosa centrale.
* **Pannelli & Modali:** `#1C2230` con bordo `1px solid #334155`.
* **CTA Principale (Pulsante Gioca / Azione Turno):** gradiente arancione `#F97316` → `#EA580C` con bagliore `0 0 15px rgba(249, 115, 22, 0.5)`.
* **Pulsante Secondario / Risposta Priorità:** azzurro `#0284C7` → `#38BDF8`.
* **Affinità di mana (originali)** — ciascuna con colore **e** forma distinta:

| Codice | Affinità | Tema di gioco | Colore | Simbolo |
|---|---|---|---|---|
| `A` | Alba | protezione, ordine | `#FDE68A` | sole a 8 raggi |
| `M` | Marea | controllo, conoscenza | `#38BDF8` | onda doppia |
| `O` | Ombra | sacrificio, ambizione | `#A855F7` | falce di luna |
| `F` | Fiamma | aggressione, impulso | `#F87171` | fiamma a tre lingue |
| `S` | Selva | crescita, forza | `#4ADE80` | foglia nervata |
| `C` | Incolore | artefatti, Fonti generiche | `#9CA3AF` | esagono |

## 2. Tipografia e Dimensioni (`[UI]`)
* **Font Titoli, Fasi e Punti Vita:** `Cinzel` (Google Fonts, licenza OFL).
* **Font Interfaccia:** `Inter`; **testo delle regole sulle carte:** `Crimson Pro` (Google Fonts, licenza OFL).
* **Proporzioni Carte:**
  * **In Mano / Zoom Hover (`CardFullView`):** aspect ratio `63:88` (formato carta da gioco standard), cornice originale in metallo inciso
    colorata secondo l'affinità, costo in alto a destra (cristalli sfaccettati), illustrazione procedurale, riga del tipo,
    testo delle regole e placca Forza/Resistenza in ottone.
  * **Sul Campo di Battaglia (`CardCompactView`):** carte compatte (aspect ratio `4:3`) con la sola illustrazione ritagliata,
    nome in alto, icone delle parole chiave sul lato sinistro e badge `Forza / Resistenza` in basso a destra.

## 3. Posizionamento HUD sul Campo di Battaglia (`[UI]`)
* **Centro Basso / Centro Alto:** avatar originale del giocatore con cerchio dei Punti Vita (es. `20`), cliccabile come bersaglio.
* **Bordo Inferiore:** mano del giocatore disposta a ventaglio (si solleva e ingrandisce di `1.6x` all'hover).
* **Sinistra (Basso e Alto):** Mazzo (contatore carte residue), Cimitero (mostra la carta in cima, cliccabile per ispezionare la lista) ed Esilio.
* **Destra Centrale (Pila):** colonna verticale degli oggetti in attesa di risoluzione, collegati da frecce curve animate in SVG ai bersagli.
* **Angolo Basso a Destra:**
  * **Phase Strip:** icone originali di `Mantenimento/Pescata`, `Principale 1`, `Combattimento`, `Principale 2`, `Fine Turno`
    (cliccabili per inserire uno stop manuale).
  * **Main Action Button:** grande pulsante contestuale (`Passa`, `Risolvi`, `Attacca con tutti`, `Avanti`, `Fine Turno`).

## 4. Movimento e accessibilità
* Animazioni ricorrenti ≤ 300 ms; effetti speciali ≤ 800 ms; `prefers-reduced-motion` rispettato.
* Contrasto AA, focus visibile (anello arancione 2 px), tutte le azioni disponibili da tastiera.
* Suoni originali o CC0, con licenza registrata in `docs/catalog/UI/`.
