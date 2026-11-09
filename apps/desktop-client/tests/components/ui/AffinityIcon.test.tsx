/**
 * @nature [TEST]
 * @module AffinityIconTest
 * @description Verifica che ogni simbolo di affinità sia un SVG decorativo con forma e colore della palette.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/AffinityIcon.test.tsx
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MANA_COLORS } from '@manaforge/shared';
import { AffinityIcon, type AffinitySymbol } from '../../../src/components/ui/AffinityIcon.js';

describe('AffinityIcon', () => {
  it.each<AffinitySymbol>(['A', 'M', 'O', 'F', 'S', 'C', 'MULTI'])('%s è decorativo e colorato', (symbol) => {
    const { container } = render(<AffinityIcon symbol={symbol} className="size-3" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-symbol', symbol);
    expect(svg).toHaveClass('size-3');
    const path = container.querySelector('path');
    expect(path?.getAttribute('d')?.length).toBeGreaterThan(10);
    expect(path).toHaveAttribute('stroke', symbol === 'MULTI' ? '#e9c46a' : MANA_COLORS[symbol]);
  });

  it('usa la dimensione predefinita', () => {
    const { container } = render(<AffinityIcon symbol="F" />);
    expect(container.querySelector('svg')).toHaveClass('size-5');
  });
});
