/**
 * @nature [TEST]
 * @module LoginPageTest
 * @description Component test della pagina /login: tab, validazione, login/registrazione, errori server e flusso Google.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/pages/LoginPage.test.tsx
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ok } from '@manaforge/shared';
import { LoginPage } from '../../src/pages/LoginPage.js';
import { AuthStoreProvider } from '../../src/store/use-auth-store.js';
import { apiError, createTestStore } from '../helpers/fake-api.js';

const renderLogin = (deps: Parameters<typeof createTestStore>[0] = {}) => {
  const ctx = createTestStore(deps);
  ctx.store.setState({ status: 'anonymous' });
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/home', element: <h1>Home raggiunta</h1> },
    ],
    { initialEntries: ['/login'] },
  );
  render(
    <AuthStoreProvider store={ctx.store}>
      <RouterProvider router={router} />
    </AuthStoreProvider>,
  );
  return { ...ctx, user: userEvent.setup() };
};

describe('LoginPage', () => {
  it('mostra logo, tab Accedi selezionato e pulsante Google', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'MANAFORGE' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Accedi' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Continua con Google' })).toBeEnabled();
    expect(screen.queryByLabelText('Nome utente')).not.toBeInTheDocument();
  });

  it('valida i campi lato client senza chiamare il server', async () => {
    const { user, api } = renderLogin();
    await user.click(screen.getByRole('button', { name: 'Accedi' }));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Inserisci un indirizzo email valido.');
    expect(api.login).not.toHaveBeenCalled();
  });

  it('esegue il login e naviga a /home', async () => {
    const { user, api } = renderLogin();
    await user.type(screen.getByLabelText('Email'), ' Ada@Example.com ');
    await user.type(screen.getByLabelText('Password'), 'password-sicura');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));
    expect(api.login).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'password-sicura' });
    expect(await screen.findByRole('heading', { name: 'Home raggiunta' })).toBeInTheDocument();
  });

  it('mostra l\'errore del server su password errata (401)', async () => {
    const { user, api } = renderLogin();
    api.login.mockResolvedValueOnce(apiError(401, 'INVALID_CREDENTIALS', 'Email o password non corretti.'));
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'sbagliata');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o password non corretti.');
    expect(screen.getByLabelText('Password')).toHaveValue('sbagliata');
  });

  it('registrazione: valida conferma password e campi, poi crea l\'account', async () => {
    const { user, api } = renderLogin();
    await user.click(screen.getByRole('tab', { name: 'Registrati' }));
    expect(screen.getByRole('tab', { name: 'Registrati' })).toHaveAttribute('aria-selected', 'true');

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Nome utente'), 'A!');
    await user.type(screen.getByLabelText('Password'), 'password-sicura');
    await user.type(screen.getByLabelText('Conferma password'), 'diversa-password');
    await user.click(screen.getByRole('button', { name: 'Crea account' }));
    expect(screen.getByLabelText('Nome utente')).toHaveAccessibleDescription(/Da 3 a 24 caratteri/);
    expect(screen.getByLabelText('Conferma password')).toHaveAccessibleDescription('Le password non coincidono.');
    expect(api.register).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Nome utente'));
    await user.type(screen.getByLabelText('Nome utente'), 'Ada');
    await user.clear(screen.getByLabelText('Conferma password'));
    await user.type(screen.getByLabelText('Conferma password'), 'password-sicura');
    await user.click(screen.getByRole('button', { name: 'Crea account' }));
    expect(api.register).toHaveBeenCalledWith({ email: 'ada@example.com', username: 'Ada', password: 'password-sicura' });
    expect(await screen.findByRole('heading', { name: 'Home raggiunta' })).toBeInTheDocument();
  });

  it('registrazione con password troppo corta mostra l\'errore sul campo', async () => {
    const { user } = renderLogin();
    await user.click(screen.getByRole('tab', { name: 'Registrati' }));
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Nome utente'), 'Ada');
    await user.type(screen.getByLabelText('Password'), 'corta');
    await user.type(screen.getByLabelText('Conferma password'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Crea account' }));
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('La password deve avere da 8 a 128 caratteri.');
  });

  it('cambiare tab azzera errori e password', async () => {
    const { user, api } = renderLogin();
    api.login.mockResolvedValueOnce(apiError(401, 'INVALID_CREDENTIALS', 'Errore'));
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('tab', { name: 'Registrati' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
  });

  it('Google: mostra l\'attesa del browser e permette di annullare', async () => {
    let release: () => void = () => undefined;
    const { user, api, openExternal } = renderLogin({ sleep: () => new Promise<void>((resolve) => { release = resolve; }) });
    api.googleResult.mockResolvedValue(ok({ status: 'pending' }));
    await user.click(screen.getByRole('button', { name: 'Continua con Google' }));
    expect(await screen.findByText(/Completa l'accesso nella finestra del browser/)).toBeInTheDocument();
    expect(openExternal).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    release();
    expect(await screen.findByRole('button', { name: 'Continua con Google' })).toBeEnabled();
  });

  it('Google: completa l\'accesso e naviga a /home', async () => {
    const { user } = renderLogin();
    await user.click(screen.getByRole('button', { name: 'Continua con Google' }));
    expect(await screen.findByRole('heading', { name: 'Home raggiunta' })).toBeInTheDocument();
  });
});
