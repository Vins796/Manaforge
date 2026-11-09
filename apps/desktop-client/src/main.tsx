/**
 * @nature [UI]
 * @module Main
 * @description Entry point del client: crea le dipendenze reali e monta React. Solo wiring, nessuna logica (vedi `.cursorrules §4`).
 * @relatedDocs docs/catalog/UI/01-login-page.md
 * @testFile apps/desktop-client/tests/App.test.tsx
 */
// Deve restare il primo import: configura Zod prima che qualsiasi schema venga costruito.
import './zod-config.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { createApiClient, DEFAULT_API_BASE_URL } from './services/api-client.js';
import { createOpenExternal } from './services/external-browser.js';
import { createAuthStore } from './store/use-auth-store.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root mancante in index.html');

const store = createAuthStore({
  api: createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL }),
  openExternal: createOpenExternal(),
  storage: window.localStorage,
});

createRoot(root).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
