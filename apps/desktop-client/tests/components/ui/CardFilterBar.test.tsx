/**
 * @nature [TEST]
 * @module CardFilterBarTest
 * @description Verifica i controlli della barra filtri (toggle affinità e mana, tipo, formato, ricerca, azzeramento, conteggio).
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/CardFilterBar.test.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CardFilterBar } from '../../../src/components/ui/CardFilterBar.js';
import { EMPTY_FILTERS, type CardFilters } from '../../../src/components/ui/card-filters.js';

const Harness = ({ onChange }: { onChange: (f: CardFilters) => void }) => {
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  return (
    <CardFilterBar
      filters={filters}
      resultCount={1}
      onChange={(next) => {
        setFilters(next);
        onChange(next);
      }}
    />
  );
};

describe('CardFilterBar', () => {
  it('alterna affinità e valori di mana con aria-pressed', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const fiamma = screen.getByRole('button', { name: 'Fiamma' });
    await userEvent.click(fiamma);
    expect(fiamma).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Incolore' }));
    await userEvent.click(screen.getByRole('button', { name: 'Valore di mana 6 o più' }));
    expect(screen.getByRole('button', { name: 'Valore di mana 6 o più' })).toHaveTextContent('6+');
    const last = onChange.mock.lastCall?.[0] as CardFilters;
    expect([...last.affinities]).toEqual(['F', 'COLORLESS']);
    expect([...last.manaValues]).toEqual([6]);

    await userEvent.click(fiamma);
    expect(fiamma).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 carta')).toBeInTheDocument();
  });

  it('modifica tipo, formato e ricerca e permette di azzerare', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Azzera filtri' })).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), 'Creatura');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ type: 'Creatura' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tipo' }), '');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ type: null });
    fireEvent.change(screen.getByRole('combobox', { name: 'Formato' }), { target: { value: 'standard' } });
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ format: 'standard' });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Cerca carte' }), 'drago');
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ query: 'drago' });
    await userEvent.click(screen.getByRole('button', { name: 'Azzera filtri' }));
    expect(onChange.mock.lastCall?.[0]).toBe(EMPTY_FILTERS);
  });

  it('mostra il conteggio al plurale', () => {
    render(<CardFilterBar filters={EMPTY_FILTERS} resultCount={12} onChange={() => undefined} />);
    expect(screen.getByText('12 carte')).toBeInTheDocument();
  });
});
