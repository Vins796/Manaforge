/**
 * @nature [TEST]
 * @module TextFieldTest
 * @description Verifica associazione etichetta/input e messaggio di errore accessibile.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/components/ui/TextField.test.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from '../../../src/components/ui/TextField.js';

describe('TextField', () => {
  it('associa l\'etichetta all\'input', () => {
    render(<TextField label="Email" type="email" defaultValue="a@b.it" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveValue('a@b.it');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('collega il messaggio di errore con aria-describedby', () => {
    render(<TextField label="Password" error="Troppo corta" className="extra" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Troppo corta');
  });
});
