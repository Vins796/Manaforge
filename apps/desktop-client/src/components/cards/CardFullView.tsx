/**
 * @nature [UI]
 * @module CardFullView
 * @description Carta intera 63:88 (mano, zoom, collezione): cornice originale colorata per affinità, costo, illustrazione procedurale, tipo, testo e Forza/Resistenza.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/cards/CardFullView.test.tsx
 */
import { KEYWORD_NAMES, MANA_COLORS, type CardView } from '@manaforge/shared';
import { AffinityIcon, type AffinitySymbol } from '../ui/AffinityIcon.js';
import { ManaCost, describeManaCost } from '../ui/ManaCost.js';

const SYMBOL_RE = /(\{(?:[AMOFSC]|\d{1,2})\})/u;

/**
 * Testo delle regole con i simboli di mana (`{F}`, `{2}`) resi come icone accessibili.
 *
 * @param props - Testo delle regole.
 * @returns Il paragrafo.
 */
export const RulesText = ({ text }: { readonly text: string }) => (
  <p>
    {text.split(SYMBOL_RE).map((part, index) => {
      if (!SYMBOL_RE.test(part)) return part;
      const code = part.slice(1, -1);
      return (
        <span key={index} role="img" aria-label={describeManaCost(part)} className="mx-px inline-flex size-[1.1em] items-center justify-center rounded-full bg-[#1d1a14] align-[-0.15em] text-[0.7em] font-bold text-[#e9e3d3]">
          {/^\d/u.test(code) ? code : <AffinityIcon symbol={code as AffinitySymbol} className="size-[85%]" />}
        </span>
      );
    })}
  </p>
);

/** Colore della cornice: affinità singola, oro per multi-affinità, grigio per incolore. */
export const frameColor = (card: Pick<CardView, 'affinityIdentity'>): string => {
  const [first, ...rest] = card.affinityIdentity;
  if (!first) return MANA_COLORS.C;
  return rest.length > 0 ? '#e9c46a' : MANA_COLORS[first];
};

const RARITY_LABELS: Readonly<Record<CardView['rarity'], string>> = {
  comune: 'Comune',
  non_comune: 'Non comune',
  rara: 'Rara',
  mitica: 'Mitica',
};

/** Props di {@link CardFullView}. */
export interface CardFullViewProps {
  readonly card: CardView;
  readonly imageUrl: string;
  readonly className?: string;
}

/**
 * Vista completa di una carta.
 *
 * @param props - Carta, URL dell'illustrazione e classi aggiuntive.
 * @returns L'elemento `<article>` della carta.
 */
export const CardFullView = ({ card, imageUrl, className = '' }: CardFullViewProps) => {
  const color = frameColor(card);
  const keywords = card.keywords.map((code) => KEYWORD_NAMES[code]).join(', ');
  return (
    <article
      aria-label={card.name}
      className={`@container relative flex aspect-[63/88] w-full flex-col overflow-hidden rounded-[4.5%/3.2%] border-2 bg-linear-to-b from-[#2a3142] to-[#151a24] p-[3.5%] text-left shadow-lg ${className}`}
      style={{ borderColor: color }}
    >
      <header className="flex items-center justify-between gap-1 rounded-sm bg-black/45 px-[3%] py-[2%]" style={{ boxShadow: `inset 0 -1px 0 ${color}66` }}>
        <h3 className="truncate font-display text-[7cqw] font-semibold leading-tight text-text">{card.name}</h3>
        <ManaCost cost={card.cost} />
      </header>

      <div className="relative mt-[3%] aspect-[630/472] overflow-hidden rounded-sm ring-1 ring-black/60">
        <img src={imageUrl} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
      </div>

      <p className="mt-[3%] truncate rounded-sm bg-black/45 px-[3%] py-[1.5%] text-[5.5cqw] text-text-muted">
        {card.typeLine}
        <span className="sr-only"> · {RARITY_LABELS[card.rarity]}</span>
      </p>

      <div className="mt-[3%] flex-1 overflow-hidden rounded-sm bg-[#e9e3d3] px-[4%] py-[3%] font-[Crimson_Pro,Georgia,serif] text-[6cqw] leading-snug text-[#1d1a14]">
        {keywords ? <p className="font-semibold">{keywords}</p> : null}
        {card.rulesText ? <RulesText text={card.rulesText} /> : null}
      </div>

      {card.power !== null && card.toughness !== null ? (
        <p
          aria-label={`Forza ${card.power}, Resistenza ${card.toughness}`}
          className="absolute right-[4%] bottom-[2.5%] rounded-sm bg-linear-to-b from-[#d9b46a] to-[#9a7434] px-[4%] py-[1%] font-display text-[7cqw] font-bold text-[#1d1a14] shadow"
        >
          {card.power}/{card.toughness}
        </p>
      ) : null}
    </article>
  );
};
