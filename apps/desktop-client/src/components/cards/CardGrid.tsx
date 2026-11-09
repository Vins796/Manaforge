/**
 * @nature [UI]
 * @module CardGrid
 * @description Griglia paginata di carte intere: clic sinistro (azione principale), clic destro (azione secondaria) e badge del numero di copie nel mazzo.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/cards/CardGrid.test.tsx
 */
import { useState, type MouseEvent } from 'react';
import type { CardView } from '@manaforge/shared';
import { CardFullView } from './CardFullView.js';

/** Carte per pagina predefinite. */
export const DEFAULT_PAGE_SIZE = 18;

/** Props di {@link CardGrid}. */
export interface CardGridProps {
  readonly cards: readonly CardView[];
  readonly imageUrl: (cardId: string) => string;
  /** Clic sinistro su una carta. */
  readonly onSelect: (card: CardView) => void;
  /** Etichetta accessibile dell'azione principale (es. "Aggiungi X al mazzo"). */
  readonly actionLabel: (card: CardView) => string;
  /** Clic destro su una carta (il menu contestuale viene soppresso). */
  readonly onSecondary?: (card: CardView) => void;
  /** Copie già presenti nel mazzo, mostrate come badge. */
  readonly counts?: ReadonlyMap<string, number>;
  readonly pageSize?: number;
  readonly emptyMessage?: string;
}

/**
 * Griglia di carte con paginazione.
 *
 * @param props - Carte, azioni e opzioni.
 * @returns La griglia con i controlli di pagina.
 */
export const CardGrid = ({
  cards,
  imageUrl,
  onSelect,
  actionLabel,
  onSecondary,
  counts,
  pageSize = DEFAULT_PAGE_SIZE,
  emptyMessage = 'Nessuna carta corrisponde ai filtri.',
}: CardGridProps) => {
  const [requestedPage, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(cards.length / pageSize));
  // Se i filtri riducono i risultati, la pagina richiesta viene riportata nell'intervallo valido.
  const page = Math.min(requestedPage, pages - 1);
  const visible = cards.slice(page * pageSize, (page + 1) * pageSize);

  if (cards.length === 0) return <p className="p-8 text-center text-text-muted">{emptyMessage}</p>;

  const onContextMenu = (card: CardView) => (event: MouseEvent) => {
    if (!onSecondary) return;
    event.preventDefault();
    onSecondary(card);
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-4" aria-label="Carte">
        {visible.map((card) => {
          const count = counts?.get(card.id) ?? 0;
          return (
            <li key={card.id} className="relative">
              <button
                type="button"
                aria-label={actionLabel(card)}
                onClick={() => onSelect(card)}
                onContextMenu={onContextMenu(card)}
                className="block w-full rounded-lg transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
              >
                <CardFullView card={card} imageUrl={imageUrl(card.id)} />
              </button>
              {count > 0 ? (
                <span
                  aria-label={`${count} nel mazzo`}
                  className="pointer-events-none absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-cta font-bold text-white shadow-cta"
                >
                  {count}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {pages > 1 ? (
        <nav aria-label="Pagine" className="flex items-center justify-center gap-3 text-sm">
          <button type="button" className="rounded-md border border-line px-3 py-1 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Precedente
          </button>
          <span aria-current="page">
            Pagina {page + 1} di {pages}
          </span>
          <button type="button" className="rounded-md border border-line px-3 py-1 disabled:opacity-40" disabled={page === pages - 1} onClick={() => setPage(page + 1)}>
            Successiva
          </button>
        </nav>
      ) : null}
    </div>
  );
};
