/**
 * @nature [TEST]
 * @module ButtonTest
 * @description Verifica varianti, tipo predefinito, click e stato di caricamento del pulsante.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/components/ui/Button.test.tsx
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../../src/components/ui/Button.js';

describe('Button', () => {
  it('è di tipo button per default e gestisce il click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Gioca</Button>);
    const button = screen.getByRole('button', { name: 'Gioca' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('from-cta');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('in caricamento è disabilitato e segnala aria-busy', async () => {
    const onClick = vi.fn();
    render(<Button variant="secondary" loading onClick={onClick}>Invia</Button>);
    const button = screen.getByRole('button', { name: 'Invia' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.className).toContain('from-secondary-light');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('rispetta disabled, type e classi aggiuntive', () => {
    render(<Button variant="ghost" type="submit" disabled className="w-full">Ok</Button>);
    const button = screen.getByRole('button', { name: 'Ok' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button.className).toContain('w-full');
  });
});
