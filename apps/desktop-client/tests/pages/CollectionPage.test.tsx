/**
 * @nature [TEST]
 * @module CollectionPageTest
 * @description Verifica la pagina Collezione: caricamento del catalogo, filtri, pannello di dettaglio e stati di caricamento/errore.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/pages/CollectionPage.test.tsx
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CatalogStatus, CollectionPage } from '../../src/pages/CollectionPage.js';
import { renderPage } from '../helpers/render-page.js';

const open = () => renderPage(<CollectionPage />, { path: '/collection', url: '/collection' });

describe('CollectionPage', () => {
  it('mostra il catalogo, filtra e apre il dettaglio di una carta', async () => {
    await open();
    expect(screen.getByRole('heading', { name: 'Collezione' })).toBeInTheDocument();
    const grid = await screen.findByRole('list', { name: 'Carte' });
    expect(within(grid).getAllByRole('article')).toHaveLength(6);

    await userEvent.click(screen.getByRole('button', { name: 'Multi' }));
    expect(within(grid).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Chimera di Prova']);

    await userEvent.click(screen.getByRole('button', { name: 'Mostra Chimera di Prova' }));
    const detail = screen.getByRole('complementary', { name: 'Dettaglio carta' });
    expect(detail).toHaveTextContent('TS1-005 · Disponibile in 4 copie');
    await userEvent.click(within(detail).getByRole('button', { name: 'Chiudi dettaglio' }));
    expect(screen.queryByRole('complementary', { name: 'Dettaglio carta' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Azzera filtri' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mostra Fucina di Prova' }));
    expect(screen.getByRole('complementary', { name: 'Dettaglio carta' })).toHaveTextContent('Copie illimitate');
  });

  it('mostra l\'errore se il catalogo non si carica', async () => {
    const { api, deckStore } = await open();
    expect(api.listCards).toHaveBeenCalledWith('jwt-token');
    deckStore.setState({ catalogStatus: 'error', error: 'Server giù' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Server giù');
  });
});

describe('CatalogStatus', () => {
  it('stato di caricamento, errore generico e pronto', () => {
    const { rerender, container } = render(<CatalogStatus status="loading" error={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('Caricamento del catalogo…');
    rerender(<CatalogStatus status="error" error={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Impossibile caricare il catalogo.');
    rerender(<CatalogStatus status="ready" error={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
