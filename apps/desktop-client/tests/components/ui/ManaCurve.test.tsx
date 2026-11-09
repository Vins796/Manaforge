/**
 * @nature [TEST]
 * @module ManaCurveTest
 * @description Verifica il calcolo della curva di mana (solo mazzo principale, Fonti escluse, 6+) e la resa accessibile delle barre.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/ManaCurve.test.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ManaCurve, computeManaCurve } from '../../../src/components/ui/ManaCurve.js';
import { CARDS, card } from '../../helpers/fake-api.js';

describe('computeManaCurve', () => {
  it('conta le copie per valore, escludendo riserva, Fonti e carte sconosciute', () => {
    const big = card({ id: 'TS1-009', name: 'Colosso', manaValue: 9 });
    const all = [...CARDS, big];
    const lookup = (id: string) => all.find((c) => c.id === id);
    const curve = computeManaCurve(
      [
        { cardId: 'TS1-001', board: 'main', quantity: 20 },
        { cardId: 'TS1-003', board: 'main', quantity: 4 },
        { cardId: 'TS1-004', board: 'main', quantity: 2 },
        { cardId: 'TS1-005', board: 'sideboard', quantity: 3 },
        { cardId: 'TS1-006', board: 'main', quantity: 1 },
        { cardId: 'TS1-009', board: 'main', quantity: 2 },
        { cardId: 'XX1-001', board: 'main', quantity: 2 },
      ],
      lookup,
    );
    expect(curve).toEqual([0, 6, 0, 0, 0, 0, 3]);
  });
});

describe('ManaCurve', () => {
  it('rende una barra etichettata per valore', () => {
    render(<ManaCurve curve={[0, 6, 0, 0, 0, 0, 3]} />);
    expect(screen.getByText('Curva di mana')).toBeInTheDocument();
    expect(screen.getByLabelText('Valore 1: 6')).toHaveTextContent('6');
    expect(screen.getByLabelText('Valore 6+: 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Valore 0: 0').querySelector('span[style]')?.getAttribute('style')).toMatch(/height: 0/);
    expect(screen.getByLabelText('Valore 1: 6').querySelector('span[style]')?.getAttribute('style')).toMatch(/height: 3.5rem/);
  });
});
