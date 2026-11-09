/**
 * @nature [TEST]
 * @module TopNavTest
 * @description Verifica i link di navigazione (con stato attivo), il nome utente e il logout con ritorno a /login.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/TopNav.test.tsx
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TopNav } from '../../../src/components/ui/TopNav.js';
import { renderPage } from '../../helpers/render-page.js';

describe('TopNav', () => {
  it('mostra i link con quello attivo evidenziato e il nome utente', async () => {
    await renderPage(<TopNav />, { path: '/decks', url: '/decks' });
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home');
    expect(screen.getByRole('link', { name: 'Mazzi' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Collezione' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  it('il logout chiude la sessione e porta a /login', async () => {
    const { authStore } = await renderPage(<TopNav />, { path: '/home', url: '/home' });
    await userEvent.click(screen.getByRole('button', { name: 'Esci' }));
    expect(await screen.findByRole('heading', { name: 'Pagina login' })).toBeInTheDocument();
    expect(authStore.getState().status).toBe('anonymous');
  });
});
