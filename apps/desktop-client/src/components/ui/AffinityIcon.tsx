/**
 * @nature [UI]
 * @module AffinityIcon
 * @description Simboli originali delle affinità di mana (Design Brief §1): sole a 8 raggi, onda doppia, falce di luna, fiamma, foglia, esagono; più Multi.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/AffinityIcon.test.tsx
 */
import { MANA_COLORS, type ManaType } from '@manaforge/shared';

/** Simboli disponibili: i tipi di mana più `MULTI`. */
export type AffinitySymbol = ManaType | 'MULTI';

const RAYS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  const [x1, y1, x2, y2] = [12 + Math.cos(angle) * 6.5, 12 + Math.sin(angle) * 6.5, 12 + Math.cos(angle) * 10, 12 + Math.sin(angle) * 10];
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
}).join('');

const SHAPES: Readonly<Record<AffinitySymbol, { readonly d: string; readonly stroke?: boolean }>> = {
  A: { d: `M12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9Z${RAYS}`, stroke: true },
  M: { d: 'M3 10c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0', stroke: true },
  O: { d: 'M15 3a9 9 0 1 0 6 15.5A7.5 7.5 0 0 1 15 3Z' },
  F: { d: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 2-5 0 2 1 3 2 3-1-4 2-7 2-10Zm0 12c-1 1.5-2 2.5-2 4a2 2 0 0 0 4 0c0-1.5-1-2.5-2-4Z' },
  S: { d: 'M4 20C4 10 10 4 20 4c0 10-6 16-16 16Zm0 0 10-10M9 15h4M12 12V8', stroke: true },
  C: { d: 'M12 2.5 20.5 7.25v9.5L12 21.5 3.5 16.75v-9.5Z' },
  MULTI: { d: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18Zm0 0v18M3.5 9h17M3.5 15h17', stroke: true },
};

/** Props di {@link AffinityIcon}. */
export interface AffinityIconProps {
  readonly symbol: AffinitySymbol;
  readonly className?: string;
}

/**
 * Icona di un'affinità, colorata secondo la palette. Decorativa: il nome va fornito dal contesto (etichetta del controllo).
 *
 * @param props - Simbolo e classi CSS.
 * @returns L'SVG.
 */
export const AffinityIcon = ({ symbol, className = 'size-5' }: AffinityIconProps) => {
  const shape = SHAPES[symbol];
  const color = symbol === 'MULTI' ? '#e9c46a' : MANA_COLORS[symbol];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} data-symbol={symbol}>
      <path
        d={shape.d}
        fill={shape.stroke ? 'none' : color}
        stroke={color}
        strokeWidth={shape.stroke ? 2 : 0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
