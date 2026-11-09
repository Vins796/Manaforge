/**
 * @nature [UI]
 * @module ManaCurve
 * @description Curva di mana del mazzo principale (valori 0–6+, Fonti escluse) come istogramma accessibile.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/ManaCurve.test.tsx
 */
import type { CardView, DeckEntry } from '@manaforge/shared';

/** Etichette delle colonne della curva. */
export const CURVE_LABELS = ['0', '1', '2', '3', '4', '5', '6+'] as const;

/**
 * Calcola la curva di mana: copie nel mazzo principale per valore di mana (6 = 6 o più), escluse le Fonti.
 *
 * @param entries - Righe del mazzo.
 * @param lookup - Risoluzione delle carte.
 * @returns Sette conteggi.
 */
export const computeManaCurve = (entries: readonly DeckEntry[], lookup: (cardId: string) => CardView | undefined): number[] => {
  const curve = CURVE_LABELS.map(() => 0);
  for (const entry of entries) {
    const card = lookup(entry.cardId);
    if (entry.board !== 'main' || !card || card.typeLine.startsWith('Fonte')) continue;
    const index = Math.min(card.manaValue, CURVE_LABELS.length - 1);
    curve[index] = (curve[index] ?? 0) + entry.quantity;
  }
  return curve;
};

/**
 * Istogramma della curva di mana.
 *
 * @param props - Conteggi per valore di mana.
 * @returns La figura con le barre.
 */
export const ManaCurve = ({ curve }: { readonly curve: readonly number[] }) => {
  const max = Math.max(1, ...curve);
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-xs tracking-wide text-text-muted uppercase">Curva di mana</figcaption>
      <ol className="flex h-20 items-end gap-1.5">
        {CURVE_LABELS.map((label, index) => {
          const count = curve[index] ?? 0;
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-0.5" aria-label={`Valore ${label}: ${count}`}>
              <span className="text-[10px] text-text-muted">{count > 0 ? count : ''}</span>
              <span className="w-full rounded-t-sm bg-linear-to-t from-cta-deep to-cta" style={{ height: `${(count / max) * 3.5}rem` }} />
              <span className="text-[10px] text-text-muted">{label}</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
};
