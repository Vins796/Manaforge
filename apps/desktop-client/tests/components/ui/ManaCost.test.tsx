/**
 * @nature [TEST]
 * @module ManaCostTest
 * @description Verifica la resa del costo di mana (generico + simboli) e la sua descrizione accessibile.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/ManaCost.test.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ManaCost, describeManaCost } from '../../../src/components/ui/ManaCost.js';

describe('describeManaCost', () => {
  it.each([
    ['{2}{F}{S}', '2, Fiamma, Selva'],
    ['{A}{A}', 'Alba, Alba'],
    ['{0}', '0'],
    ['{3}{C}', '3, Incolore'],
    ['', 'nessun costo'],
    ['{boh}', '{boh}'],
  ])('%s → %s', (cost, text) => {
    expect(describeManaCost(cost)).toBe(text);
  });
});

describe('ManaCost', () => {
  it('rende il generico e un simbolo per ogni mana colorato', () => {
    const { container } = render(<ManaCost cost="{2}{M}{F}" size="md" />);
    expect(screen.getByRole('img', { name: 'Costo: 2, Marea, Fiamma' })).toHaveTextContent('2');
    expect([...container.querySelectorAll('svg')].map((svg) => svg.dataset.symbol)).toEqual(['M', 'F']);
  });

  it('mostra {0} e nulla per costi vuoti o non validi', () => {
    render(<ManaCost cost="{0}" />);
    expect(screen.getByRole('img', { name: 'Costo: 0' })).toHaveTextContent('0');
    expect(render(<ManaCost cost="" />).container).toBeEmptyDOMElement();
    expect(render(<ManaCost cost="{X" />).container).toBeEmptyDOMElement();
  });
});
