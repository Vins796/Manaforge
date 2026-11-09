/**
 * @nature [TEST]
 * @module CardFullViewTest
 * @description Verifica la carta intera: nome, costo, illustrazione, tipo, parole chiave, testo con simboli, Forza/Resistenza e colore della cornice.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/cards/CardFullView.test.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MANA_COLORS } from '@manaforge/shared';
import { CardFullView, RulesText, frameColor } from '../../../src/components/cards/CardFullView.js';
import { CARDS } from '../../helpers/fake-api.js';

const byId = (id: string) => CARDS.find((c) => c.id === id)!;

describe('CardFullView', () => {
  it('rende una creatura con costo, parole chiave e Forza/Resistenza', () => {
    const { container } = render(<CardFullView card={byId('TS1-003')} imageUrl="http://img/x.svg" />);
    const article = screen.getByRole('article', { name: 'Folletto di Prova' });
    expect(screen.getByRole('heading', { name: 'Folletto di Prova' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Costo: Fiamma' })).toBeInTheDocument();
    expect(container.querySelector('img[src="http://img/x.svg"]')).toHaveAttribute('alt', '');
    expect(article).toHaveTextContent('Creatura — Folletto');
    expect(article).toHaveTextContent('Scatto');
    expect(screen.getByLabelText('Forza 1, Resistenza 1')).toHaveTextContent('1/1');
    expect(article).toHaveStyle({ borderColor: MANA_COLORS.F });
  });

  it('rende una Fonte senza costo né Forza/Resistenza, con il simbolo nel testo', () => {
    render(<CardFullView card={byId('TS1-001')} imageUrl="x" />);
    expect(screen.queryByRole('img', { name: /^Costo/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Forza/)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fiamma' })).toBeInTheDocument();
  });
});

describe('RulesText', () => {
  it('sostituisce i simboli con icone e numeri', () => {
    const { container } = render(<RulesText text="Paga {2}{S}: pesca una carta. {X} resta testo." />);
    expect(screen.getByRole('img', { name: '2' })).toHaveTextContent('2');
    expect(screen.getByRole('img', { name: 'Selva' }).querySelector('svg')).toHaveAttribute('data-symbol', 'S');
    expect(container).toHaveTextContent('Paga 2: pesca una carta. {X} resta testo.');
  });
});

describe('frameColor', () => {
  it('affinità singola, oro per multi, grigio per incolore', () => {
    expect(frameColor({ affinityIdentity: ['S'] })).toBe(MANA_COLORS.S);
    expect(frameColor({ affinityIdentity: ['M', 'F'] })).toBe('#e9c46a');
    expect(frameColor({ affinityIdentity: [] })).toBe(MANA_COLORS.C);
  });
});
