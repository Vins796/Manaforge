/**
 * @nature [TEST]
 * @module CardGridTest
 * @description Verifica la griglia di carte: clic sinistro e destro, badge delle copie, paginazione (anche quando i risultati si riducono) e stato vuoto.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/cards/CardGrid.test.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CardGrid } from '../../../src/components/cards/CardGrid.js';
import { CARDS } from '../../helpers/fake-api.js';

const props = { imageUrl: (id: string) => `img/${id}`, actionLabel: (card: { name: string }) => `Aggiungi ${card.name}` };

describe('CardGrid', () => {
  it('clic sinistro → onSelect, clic destro → onSecondary; badge delle copie', async () => {
    const onSelect = vi.fn();
    const onSecondary = vi.fn();
    render(<CardGrid {...props} cards={CARDS} onSelect={onSelect} onSecondary={onSecondary} counts={new Map([['TS1-003', 3]])} />);
    await userEvent.click(screen.getByRole('button', { name: 'Aggiungi Folletto di Prova' }));
    expect(onSelect).toHaveBeenCalledWith(CARDS[2]);
    const event = fireEvent.contextMenu(screen.getByRole('button', { name: 'Aggiungi Lampo di Prova' }));
    expect(event).toBe(false);
    expect(onSecondary).toHaveBeenCalledWith(CARDS[3]);
    expect(screen.getByLabelText('3 nel mazzo')).toHaveTextContent('3');
    expect(screen.queryByRole('navigation', { name: 'Pagine' })).not.toBeInTheDocument();
  });

  it('senza onSecondary lascia il menu contestuale nativo', () => {
    render(<CardGrid {...props} cards={CARDS} onSelect={vi.fn()} />);
    expect(fireEvent.contextMenu(screen.getByRole('button', { name: 'Aggiungi Lampo di Prova' }))).toBe(true);
  });

  it('pagina i risultati e riporta la pagina nell\'intervallo se i risultati diminuiscono', async () => {
    const { rerender } = render(<CardGrid {...props} cards={CARDS} onSelect={vi.fn()} pageSize={4} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Precedente' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Successiva' }));
    expect(screen.getByText('Pagina 2 di 2')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Successiva' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Precedente' }));
    expect(screen.getByText('Pagina 1 di 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Successiva' }));

    rerender(<CardGrid {...props} cards={CARDS.slice(0, 5)} onSelect={vi.fn()} pageSize={2} />);
    expect(screen.getByText('Pagina 2 di 3')).toBeInTheDocument();
    rerender(<CardGrid {...props} cards={CARDS.slice(0, 1)} onSelect={vi.fn()} pageSize={2} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('mostra il messaggio vuoto', () => {
    render(<CardGrid {...props} cards={[]} onSelect={vi.fn()} emptyMessage="Niente" />);
    expect(screen.getByText('Niente')).toBeInTheDocument();
  });
});
