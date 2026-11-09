/**
 * @nature [UI]
 * @module CollectionPage
 * @description Pagina `/collection`: catalogo completo con filtri (affinità, mana, tipo, formato, ricerca), griglia paginata e pannello di dettaglio della carta.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/pages/CollectionPage.test.tsx
 */
import { useEffect, useMemo, useState } from 'react';
import { MAX_COPIES_PER_CARD, isBasicSource, type CardView } from '@manaforge/shared';
import { CardFullView } from '../components/cards/CardFullView.js';
import { CardGrid } from '../components/cards/CardGrid.js';
import { CardFilterBar } from '../components/ui/CardFilterBar.js';
import { EMPTY_FILTERS, filterCards, type CardFilters } from '../components/ui/card-filters.js';
import { TopNav } from '../components/ui/TopNav.js';
import { useDeckStore } from '../store/use-deck-store.js';

/**
 * Stato di caricamento del catalogo condiviso da collezione e deckbuilder.
 *
 * @param props - Stato e messaggio di errore.
 * @returns Il messaggio da mostrare, o `null` se il catalogo è pronto.
 */
export const CatalogStatus = ({ status, error }: { readonly status: string; readonly error: string | null }) => {
  if (status === 'error') {
    return (
      <p role="alert" className="p-8 text-center text-danger">
        {error ?? 'Impossibile caricare il catalogo.'}
      </p>
    );
  }
  if (status !== 'ready') {
    return (
      <p role="status" className="p-8 text-center text-text-muted">
        Caricamento del catalogo…
      </p>
    );
  }
  return null;
};

/**
 * Collezione: tutte le carte del catalogo (disponibili in 4 copie, Fonti base illimitate).
 *
 * @returns La pagina Collezione.
 */
export const CollectionPage = () => {
  const catalog = useDeckStore((s) => s.catalog);
  const status = useDeckStore((s) => s.catalogStatus);
  const error = useDeckStore((s) => s.error);
  const loadCatalog = useDeckStore((s) => s.loadCatalog);
  const cardImageUrl = useDeckStore((s) => s.cardImageUrl);
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<CardView | null>(null);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const visible = useMemo(() => filterCards(catalog, filters), [catalog, filters]);

  return (
    <main className="flex min-h-full flex-col bg-abyss">
      <TopNav />
      <CardFilterBar filters={filters} onChange={setFilters} resultCount={visible.length} />
      <div className="flex flex-1 gap-6 p-6">
        <section className="flex-1" aria-labelledby="collection-title">
          <h1 id="collection-title" className="mb-4 font-display text-3xl">
            Collezione
          </h1>
          <CatalogStatus status={status} error={error} />
          {status === 'ready' ? (
            <CardGrid
              cards={visible}
              imageUrl={(id) => cardImageUrl(id, 'normal')}
              onSelect={setSelected}
              actionLabel={(card) => `Mostra ${card.name}`}
            />
          ) : null}
        </section>
        {selected ? (
          <aside aria-label="Dettaglio carta" className="sticky top-6 flex w-80 shrink-0 flex-col gap-3 self-start">
            <CardFullView card={selected} imageUrl={cardImageUrl(selected.id, 'normal')} />
            <p className="text-sm text-text-muted">
              {selected.id} · {isBasicSource(selected) ? 'Copie illimitate' : `Disponibile in ${MAX_COPIES_PER_CARD} copie`}
            </p>
            <button type="button" className="self-start text-sm text-cta hover:underline" onClick={() => setSelected(null)}>
              Chiudi dettaglio
            </button>
          </aside>
        ) : null}
      </div>
    </main>
  );
};
