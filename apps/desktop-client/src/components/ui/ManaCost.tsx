/**
 * @nature [UI]
 * @module ManaCost
 * @description Rende un costo di mana (`{2}{F}{S}`) come cristalli: generico numerato e simboli di affinità, con descrizione accessibile.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/ManaCost.test.tsx
 */
import { AFFINITY_NAMES, COLORLESS_CODE, isAffinityCode, parseManaCost, type ManaType } from '@manaforge/shared';
import { AffinityIcon } from './AffinityIcon.js';

const MANA_ORDER: readonly ManaType[] = ['A', 'M', 'O', 'F', 'S', COLORLESS_CODE];

const manaName = (type: ManaType): string => (isAffinityCode(type) ? AFFINITY_NAMES[type] : 'Incolore');

/**
 * Descrizione testuale di un costo, per lettori di schermo.
 *
 * @param cost - Costo testuale.
 * @returns Es. `"2, Fiamma, Selva"`, `"nessun costo"` per le Fonti.
 */
export const describeManaCost = (cost: string): string => {
  const parsed = parseManaCost(cost);
  if (!parsed.ok) return cost;
  const parts: string[] = parsed.value.generic > 0 || cost === '{0}' ? [String(parsed.value.generic)] : [];
  for (const type of MANA_ORDER) parts.push(...Array.from({ length: parsed.value.symbols[type] }, () => manaName(type)));
  return parts.length > 0 ? parts.join(', ') : 'nessun costo';
};

/** Props di {@link ManaCost}. */
export interface ManaCostProps {
  readonly cost: string;
  readonly size?: 'sm' | 'md';
}

/**
 * Costo di mana come sequenza di simboli.
 *
 * @param props - Costo e dimensione.
 * @returns I simboli, oppure nulla per un costo vuoto.
 */
export const ManaCost = ({ cost, size = 'sm' }: ManaCostProps) => {
  const parsed = parseManaCost(cost);
  if (!parsed.ok || cost === '') return null;
  const box = size === 'sm' ? 'size-4 text-[10px]' : 'size-5 text-xs';
  const symbols = MANA_ORDER.flatMap((type) => Array.from({ length: parsed.value.symbols[type] }, () => type));
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Costo: ${describeManaCost(cost)}`}>
      {parsed.value.generic > 0 || cost === '{0}' ? (
        <span className={`inline-flex ${box} items-center justify-center rounded-full bg-slate-300 font-bold text-abyss`}>
          {parsed.value.generic}
        </span>
      ) : null}
      {symbols.map((type, index) => (
        <span key={`${type}-${index}`} className={`inline-flex ${box} items-center justify-center rounded-full bg-abyss/80 ring-1 ring-white/20`}>
          <AffinityIcon symbol={type} className="size-[80%]" />
        </span>
      ))}
    </span>
  );
};
