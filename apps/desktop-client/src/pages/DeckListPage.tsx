/**
 * @nature [UI]
 * @module DeckListPage
 * @description Pagina `/decks`: elenco dei mazzi dell'utente con conteggi e stato (valido / incompleto), creazione e eliminazione con conferma.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/pages/DeckListPage.test.tsx
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MIN_DECK_SIZE } from '@manaforge/shared';
import { Button } from '../components/ui/Button.js';
import { TopNav } from '../components/ui/TopNav.js';
import { useDeckStore } from '../store/use-deck-store.js';

/**
 * Elenco dei mazzi.
 *
 * @returns La pagina Mazzi.
 */
export const DeckListPage = () => {
  const decks = useDeckStore((s) => s.decks);
  const status = useDeckStore((s) => s.decksStatus);
  const error = useDeckStore((s) => s.error);
  const loadDecks = useDeckStore((s) => s.loadDecks);
  const deleteDeck = useDeckStore((s) => s.deleteDeck);
  const cardImageUrl = useDeckStore((s) => s.cardImageUrl);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  return (
    <main className="flex min-h-full flex-col bg-abyss">
      <TopNav />
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6" aria-labelledby="decks-title">
        <header className="flex items-center justify-between">
          <h1 id="decks-title" className="font-display text-3xl">
            I miei mazzi
          </h1>
          <Link to="/decks/new" className="rounded-md bg-linear-to-b from-cta to-cta-deep px-5 py-2.5 font-semibold text-white shadow-cta hover:brightness-110">
            Nuovo mazzo
          </Link>
        </header>

        {status === 'error' ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}
        {status === 'loading' && decks.length === 0 ? (
          <p role="status" className="text-text-muted">
            Caricamento dei mazzi…
          </p>
        ) : null}
        {status === 'ready' && decks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-8 text-center text-text-muted">
            Non hai ancora mazzi. Creane uno o importa una lista testuale.
          </p>
        ) : null}

        <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {decks.map((deck) => (
            <li key={deck.id} className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel">
              <Link to={`/decks/${deck.id}`} className="group flex flex-col focus-visible:outline-2 focus-visible:outline-cta">
                <div className="aspect-[4/3] bg-mat">
                  {deck.coverCardId ? (
                    <img src={cardImageUrl(deck.coverCardId, 'crop')} alt="" loading="lazy" className="size-full object-cover transition group-hover:brightness-110" />
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 p-3">
                  <h2 className="truncate font-display text-lg">{deck.name}</h2>
                  <p className="text-sm text-text-muted">
                    {deck.mainCount}/{MIN_DECK_SIZE} Mazzo · {deck.sideboardCount} Riserva
                  </p>
                  <p className={`text-xs font-semibold ${deck.isValid ? 'text-aff-selva' : 'text-cta'}`}>{deck.isValid ? 'Valido' : 'Incompleto'}</p>
                </div>
              </Link>
              <div className="mt-auto flex justify-end gap-2 border-t border-line p-2">
                {confirming === deck.id ? (
                  <>
                    <Button variant="ghost" className="px-3 py-1 text-sm" onClick={() => setConfirming(null)}>
                      Annulla
                    </Button>
                    <Button
                      className="px-3 py-1 text-sm"
                      aria-label={`Conferma eliminazione di ${deck.name}`}
                      onClick={() => {
                        setConfirming(null);
                        void deleteDeck(deck.id);
                      }}
                    >
                      Conferma
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" className="px-3 py-1 text-sm" aria-label={`Elimina ${deck.name}`} onClick={() => setConfirming(deck.id)}>
                    Elimina
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
};
