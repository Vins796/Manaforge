/**
 * @nature [TEST]
 * @module ImportDeckDialogTest
 * @description Verifica il dialogo di import: precompilazione dagli appunti, errori per riga, chiusura a import riuscito, Esc/Annulla, appunti non disponibili.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/ImportDeckDialog.test.tsx
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DeckListIssue } from '@manaforge/shared';
import { ImportDeckDialog } from '../../../src/components/ui/ImportDeckDialog.js';

const setup = (clipboard: () => Promise<string>, result: readonly DeckListIssue[][] = [[]]) => {
  const onImport = vi.fn<(text: string) => Promise<readonly DeckListIssue[]>>();
  for (const issues of result) onImport.mockResolvedValueOnce(issues);
  const onClose = vi.fn();
  render(<ImportDeckDialog onImport={onImport} onClose={onClose} readClipboard={clipboard} />);
  return { onImport, onClose };
};

describe('ImportDeckDialog', () => {
  it('precompila dagli appunti, importa e si chiude', async () => {
    const clipboard = vi.fn(async () => '4 Scintilla Rovente');
    const { onImport, onClose } = setup(clipboard);
    expect(screen.getByRole('dialog', { name: 'Importa lista mazzo' })).toBeInTheDocument();
    const textarea = screen.getByRole('textbox', { name: 'Lista mazzo' });
    expect(textarea).toHaveFocus();
    await waitFor(() => expect(textarea).toHaveValue('4 Scintilla Rovente'));
    await userEvent.click(screen.getByRole('button', { name: 'Importa' }));
    expect(onImport).toHaveBeenCalledWith('4 Scintilla Rovente');
    expect(onClose).toHaveBeenCalled();
  });

  it('mostra i problemi per riga e resta aperto', async () => {
    const { onClose } = setup(async () => '', [[
      { code: 'UNKNOWN_CARD', line: 2, text: 'Boh' },
      { code: 'TOO_LONG', line: 0, text: 'Testo oltre' },
    ]]);
    const textarea = screen.getByRole('textbox', { name: 'Lista mazzo' });
    expect(screen.getByRole('button', { name: 'Importa' })).toBeDisabled();
    await userEvent.type(textarea, '2 Boh');
    await userEvent.click(screen.getByRole('button', { name: 'Importa' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Riga 2: Carta sconosciuta — Boh');
    expect(alert).toHaveTextContent('Testo troppo lungo — Testo oltre');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('non sovrascrive il testo già digitato e tollera appunti non disponibili', async () => {
    let resolveClipboard: (value: string) => void = () => undefined;
    const clipboard = () => new Promise<string>((resolve) => (resolveClipboard = resolve));
    setup(clipboard);
    const textarea = screen.getByRole('textbox', { name: 'Lista mazzo' });
    await userEvent.type(textarea, '1 Mio');
    resolveClipboard('4 Altro');
    await waitFor(() => expect(textarea).toHaveValue('1 Mio'));

    const failing = setup(() => Promise.reject(new Error('negato')));
    await userEvent.click(screen.getAllByRole('button', { name: 'Annulla' })[1] as HTMLElement);
    expect(failing.onClose).toHaveBeenCalled();
  });

  it('Esc chiude il dialogo', async () => {
    const { onClose } = setup(async () => '');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('senza lettore iniettato usa navigator.clipboard se presente', async () => {
    const readText = vi.fn(async () => '2 Dagli appunti');
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true });
    render(<ImportDeckDialog onImport={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Lista mazzo' })).toHaveValue('2 Dagli appunti'));
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render(<ImportDeckDialog onImport={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole('textbox', { name: 'Lista mazzo' })[1]).toHaveValue('');
  });
});
