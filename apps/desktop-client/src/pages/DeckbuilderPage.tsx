/**
 * @nature [UI]
 * @module DeckbuilderPage
 * @description Pagina `/decks/:deckId` (`new` per un mazzo nuovo): griglia filtrabile del catalogo e colonna del mazzo con conteggi, curva, problemi, import/export testuale e salvataggio.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/pages/DeckbuilderPage.test.tsx
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  DECK_NAME_MAX_LENGTH,
  MAX_SIDEBOARD_SIZE,
  MIN_DECK_SIZE,
  describeDeckIssue,
  formatDeckList,
  validateDeck,
  type CardView,
  type DeckBoard,
  type DeckEntry,
} from '@manaforge/shared';
import { CardGrid } from '../components/cards/CardGrid.js';
import { Button } from '../components/ui/Button.js';
import { CardFilterBar } from '../components/ui/CardFilterBar.js';
import { EMPTY_FILTERS, filterCards, type CardFilters } from '../components/ui/card-filters.js';
import { ImportDeckDialog } from '../components/ui/ImportDeckDialog.js';
import { ManaCost } from '../components/ui/ManaCost.js';
import { ManaCurve, computeManaCurve } from '../components/ui/ManaCurve.js';
import { TopNav } from '../components/ui/TopNav.js';
import { useDeckStore } from '../store/use-deck-store.js';
import { CatalogStatus } from './CollectionPage.js';

/** Id di rotta che indica un mazzo nuovo. */
export const NEW_DECK_ROUTE_ID = 'new';

/** Props di {@link DeckbuilderPage}. */
export interface DeckbuilderPageProps {
  /** Scrittura negli appunti; default `navigator.clipboard.writeText`. */
  readonly writeClipboard?: (text: string) => Promise<void>;
  /** Lettura degli appunti per l'import; default `navigator.clipboard.readText`. */
  readonly readClipboard?: () => Promise<string>;
}

interface Row {
  readonly entry: DeckEntry;
  readonly card: CardView;
}

const defaultWriteClipboard = (text: string): Promise<void> =>
  navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error('Appunti non disponibili'));

const byCurve = (a: Row, b: Row) => a.card.manaValue - b.card.manaValue || a.card.name.localeCompare(b.card.name, 'it');

const iconButton =
  'inline-flex size-6 items-center justify-center rounded border border-line text-xs text-text-muted transition hover:border-cta hover:text-text focus-visible:outline-2 focus-visible:outline-cta';

/** Sezione della colonna del mazzo (mazzo principale o riserva). */
const DeckSection = ({ title, board, rows }: { readonly title: string; readonly board: DeckBoard; readonly rows: readonly Row[] }) => {
  const addCard = useDeckStore((s) => s.addCard);
  const removeCard = useDeckStore((s) => s.removeCard);
  const moveCard = useDeckStore((s) => s.moveCard);
  const target = board === 'main' ? 'in riserva' : 'nel mazzo';
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h3 className="text-xs tracking-wide text-text-muted uppercase">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-text-muted/70">Vuota.</p> : null}
      <ul className="flex flex-col gap-0.5">
        {rows.map(({ entry, card }) => (
          <li key={card.id} className="group flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-abyss/60">
            <span className="w-6 text-right font-semibold tabular-nums">{entry.quantity}</span>
            <span className="flex-1 truncate" title={card.name}>
              {card.name}
            </span>
            <ManaCost cost={card.cost} />
            <span className="flex gap-1">
              <button type="button" className={iconButton} aria-label={`Rimuovi una copia di ${card.name}`} onClick={() => removeCard(card.id, board)}>
                −
              </button>
              <button type="button" className={iconButton} aria-label={`Aggiungi una copia di ${card.name}`} onClick={() => addCard(card.id, board)}>
                +
              </button>
              <button type="button" className={iconButton} aria-label={`Sposta ${card.name} ${target}`} onClick={() => moveCard(card.id, board)}>
                ⇄
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

/**
 * Deckbuilder.
 *
 * @param props - Accesso agli appunti iniettabile (test).
 * @returns La pagina del deckbuilder.
 */
export const DeckbuilderPage = ({ writeClipboard = defaultWriteClipboard, readClipboard }: DeckbuilderPageProps) => {
  const { deckId = NEW_DECK_ROUTE_ID } = useParams();
  const navigate = useNavigate();
  const catalog = useDeckStore((s) => s.catalog);
  const catalogStatus = useDeckStore((s) => s.catalogStatus);
  const draft = useDeckStore((s) => s.draft);
  const draftStatus = useDeckStore((s) => s.draftStatus);
  const dirty = useDeckStore((s) => s.dirty);
  const saving = useDeckStore((s) => s.saving);
  const error = useDeckStore((s) => s.error);
  const notice = useDeckStore((s) => s.notice);
  const loadCatalog = useDeckStore((s) => s.loadCatalog);
  const newDraft = useDeckStore((s) => s.newDraft);
  const openDeck = useDeckStore((s) => s.openDeck);
  const addCard = useDeckStore((s) => s.addCard);
  const rename = useDeckStore((s) => s.rename);
  const setCover = useDeckStore((s) => s.setCover);
  const importList = useDeckStore((s) => s.importList);
  const save = useDeckStore((s) => s.save);
  const cardImageUrl = useDeckStore((s) => s.cardImageUrl);
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const [importing, setImporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  /** Id del mazzo appena creato: quando la rotta passa da `new` all'id, la bozza è già quella giusta. */
  const justSaved = useRef<string | null>(null);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (deckId === NEW_DECK_ROUTE_ID) newDraft();
    else if (deckId !== justSaved.current) void openDeck(deckId);
    justSaved.current = null;
  }, [deckId, newDraft, openDeck]);

  const byId = useMemo(() => new Map(catalog.map((card) => [card.id, card])), [catalog]);
  const visible = useMemo(() => filterCards(catalog, filters), [catalog, filters]);
  const validation = useMemo(() => validateDeck(draft.cards, (id) => byId.get(id)), [draft.cards, byId]);
  const curve = useMemo(() => computeManaCurve(draft.cards, (id) => byId.get(id)), [draft.cards, byId]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of draft.cards) map.set(entry.cardId, (map.get(entry.cardId) ?? 0) + entry.quantity);
    return map;
  }, [draft.cards]);
  const rows = (board: DeckBoard): Row[] =>
    draft.cards
      .filter((entry) => entry.board === board)
      .flatMap((entry) => {
        const card = byId.get(entry.cardId);
        return card ? [{ entry, card }] : [];
      })
      .sort(byCurve);

  const onSave = async () => {
    const id = await save();
    if (id && deckId !== id) {
      justSaved.current = id;
      void navigate(`/decks/${id}`, { replace: true });
    }
  };

  const onExport = async () => {
    const text = formatDeckList([...rows('main'), ...rows('sideboard')].map(({ entry, card }) => ({ name: card.name, quantity: entry.quantity, board: entry.board })));
    try {
      await writeClipboard(text);
      setExportMessage('Lista copiata negli appunti.');
    } catch {
      setExportMessage('Impossibile accedere agli appunti.');
    }
  };

  const nameInvalid = draft.name.trim() === '';

  return (
    <main className="flex h-full flex-col bg-abyss">
      <TopNav />
      <CardFilterBar filters={filters} onChange={setFilters} resultCount={visible.length} />
      <div className="flex min-h-0 flex-1">
        <section className="flex-1 overflow-y-auto p-6" aria-label="Catalogo">
          <p className="mb-4 text-sm text-text-muted">Clic: aggiungi al mazzo · Clic destro: aggiungi alla riserva.</p>
          <CatalogStatus status={catalogStatus} error={catalogStatus === 'error' ? error : null} />
          {catalogStatus === 'ready' ? (
            <CardGrid
              cards={visible}
              counts={counts}
              imageUrl={(id) => cardImageUrl(id, 'normal')}
              onSelect={(card) => addCard(card.id, 'main')}
              onSecondary={(card) => addCard(card.id, 'sideboard')}
              actionLabel={(card) => `Aggiungi ${card.name} al mazzo`}
            />
          ) : null}
        </section>

        <aside aria-label="Mazzo in costruzione" className="flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-panel p-4">
          {draftStatus === 'loading' ? (
            <p role="status" className="text-text-muted">
              Caricamento del mazzo…
            </p>
          ) : null}
          {draftStatus === 'error' ? (
            <p role="alert" className="text-danger">
              {error}
            </p>
          ) : null}

          <label className="flex flex-col gap-1 text-sm text-text-muted">
            Nome del mazzo
            <input
              value={draft.name}
              maxLength={DECK_NAME_MAX_LENGTH}
              aria-invalid={nameInvalid || undefined}
              onChange={(event) => rename(event.target.value)}
              className={`rounded-md border bg-abyss px-3 py-2 font-display text-lg text-text outline-none focus:border-cta ${nameInvalid ? 'border-danger' : 'border-line'}`}
            />
          </label>

          <div className="flex gap-4 font-display text-lg">
            <span className={validation.mainCount >= MIN_DECK_SIZE ? 'text-aff-selva' : 'text-text'}>
              {validation.mainCount}/{MIN_DECK_SIZE} Mazzo
            </span>
            <span className={validation.sideboardCount > MAX_SIDEBOARD_SIZE ? 'text-danger' : 'text-text-muted'}>
              {validation.sideboardCount}/{MAX_SIDEBOARD_SIZE} Riserva
            </span>
          </div>

          <ManaCurve curve={curve} />

          <label className="flex flex-col gap-1 text-sm text-text-muted">
            Copertina
            <select
              value={draft.coverCardId ?? ''}
              onChange={(event) => setCover(event.target.value === '' ? null : event.target.value)}
              className="rounded-md border border-line bg-abyss px-2 py-1.5 text-text focus:border-cta focus:outline-none"
            >
              <option value="">Nessuna</option>
              {[...rows('main'), ...rows('sideboard')].map(({ card }) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </label>

          {validation.issues.length > 0 ? (
            <ul aria-label="Problemi del mazzo" className="flex flex-col gap-1 rounded-md border border-cta/40 bg-cta/10 p-2 text-sm">
              {validation.issues.map((issue) => (
                <li key={`${issue.code}-${'cardId' in issue ? issue.cardId : ''}`}>{describeDeckIssue(issue)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-semibold text-aff-selva">Mazzo valido.</p>
          )}

          <DeckSection title="Mazzo" board="main" rows={rows('main')} />
          <DeckSection title="Riserva" board="sideboard" rows={rows('sideboard')} />

          <div aria-live="polite" className="min-h-5 text-sm">
            {error && draftStatus !== 'error' ? <p className="text-danger">{error}</p> : null}
            {notice ? <p className="text-text-muted">{notice}</p> : null}
            {exportMessage ? <p className="text-text-muted">{exportMessage}</p> : null}
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <Button onClick={() => void onSave()} loading={saving} disabled={nameInvalid || draftStatus !== 'ready'}>
              Salva{dirty ? ' *' : ''}
            </Button>
            <Button variant="secondary" onClick={() => setImporting(true)}>
              Importa dagli Appunti
            </Button>
            <Button variant="ghost" onClick={() => void onExport()} disabled={draft.cards.length === 0}>
              Esporta
            </Button>
          </div>
        </aside>
      </div>

      {importing ? (
        <ImportDeckDialog onImport={importList} onClose={() => setImporting(false)} {...(readClipboard ? { readClipboard } : {})} />
      ) : null}
    </main>
  );
};
