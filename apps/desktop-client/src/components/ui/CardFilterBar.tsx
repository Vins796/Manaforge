/**
 * @nature [UI]
 * @module CardFilterBar
 * @description Barra filtri di collezione e deckbuilder: icone affinità, valore di mana 0–6+, tipo, formato e ricerca full-text (controlli accessibili da tastiera).
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/CardFilterBar.test.tsx
 */
import { DECK_FORMATS, type DeckFormat } from '@manaforge/shared';
import { AffinityIcon } from './AffinityIcon.js';
import {
  AFFINITY_FILTERS,
  AFFINITY_FILTER_LABELS,
  EMPTY_FILTERS,
  MANA_VALUE_FILTERS,
  TYPE_FILTERS,
  hasActiveFilters,
  toggleInSet,
  type CardFilters,
  type TypeFilter,
} from './card-filters.js';

/** Props di {@link CardFilterBar}. */
export interface CardFilterBarProps {
  readonly filters: CardFilters;
  readonly onChange: (filters: CardFilters) => void;
  /** Numero di carte mostrate con i filtri attuali. */
  readonly resultCount: number;
}

const toggleClass = (pressed: boolean) =>
  `inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta ${
    pressed ? 'border-cta bg-cta/20 text-text' : 'border-line bg-abyss text-text-muted hover:text-text'
  }`;

const FORMAT_LABELS: Readonly<Record<DeckFormat, string>> = { standard: 'Standard' };

/**
 * Barra dei filtri delle carte.
 *
 * @param props - Filtri correnti, callback di modifica e conteggio risultati.
 * @returns La barra dei filtri.
 */
export const CardFilterBar = ({ filters, onChange, resultCount }: CardFilterBarProps) => (
  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line bg-panel px-4 py-3" role="search">
    <div role="group" aria-label="Affinità" className="flex gap-1">
      {AFFINITY_FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          title={AFFINITY_FILTER_LABELS[filter]}
          aria-label={AFFINITY_FILTER_LABELS[filter]}
          aria-pressed={filters.affinities.has(filter)}
          className={toggleClass(filters.affinities.has(filter))}
          onClick={() => onChange({ ...filters, affinities: toggleInSet(filters.affinities, filter) })}
        >
          <AffinityIcon symbol={filter === 'COLORLESS' ? 'C' : filter} />
        </button>
      ))}
    </div>

    <div role="group" aria-label="Valore di mana" className="flex gap-1">
      {MANA_VALUE_FILTERS.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={value === 6 ? 'Valore di mana 6 o più' : `Valore di mana ${value}`}
          aria-pressed={filters.manaValues.has(value)}
          className={toggleClass(filters.manaValues.has(value))}
          onClick={() => onChange({ ...filters, manaValues: toggleInSet(filters.manaValues, value) })}
        >
          {value === 6 ? '6+' : value}
        </button>
      ))}
    </div>

    <label className="flex items-center gap-2 text-sm text-text-muted">
      Tipo
      <select
        className="h-9 rounded-md border border-line bg-abyss px-2 text-text focus:border-cta focus:outline-none"
        value={filters.type ?? ''}
        onChange={(event) => onChange({ ...filters, type: event.target.value === '' ? null : (event.target.value as TypeFilter) })}
      >
        <option value="">Tutti</option>
        {TYPE_FILTERS.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </label>

    <label className="flex items-center gap-2 text-sm text-text-muted">
      Formato
      <select
        className="h-9 rounded-md border border-line bg-abyss px-2 text-text focus:border-cta focus:outline-none"
        value={filters.format}
        onChange={(event) => onChange({ ...filters, format: event.target.value as DeckFormat })}
      >
        {DECK_FORMATS.map((format) => (
          <option key={format} value={format}>
            {FORMAT_LABELS[format]}
          </option>
        ))}
      </select>
    </label>

    <input
      type="search"
      aria-label="Cerca carte"
      placeholder="Cerca per nome, tipo o testo…"
      className="h-9 min-w-48 flex-1 rounded-md border border-line bg-abyss px-3 text-text outline-none placeholder:text-text-muted/60 focus:border-cta"
      value={filters.query}
      onChange={(event) => onChange({ ...filters, query: event.target.value })}
    />

    <div className="flex items-center gap-3 text-sm text-text-muted">
      <span aria-live="polite">{resultCount === 1 ? '1 carta' : `${resultCount} carte`}</span>
      {hasActiveFilters(filters) ? (
        <button type="button" className="text-cta underline-offset-2 hover:underline" onClick={() => onChange(EMPTY_FILTERS)}>
          Azzera filtri
        </button>
      ) : null}
    </div>
  </div>
);
