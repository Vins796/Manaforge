/**
 * @nature [UI]
 * @module AppInfo
 * @description Metadati dell'applicazione desktop (titolo finestra). React, Vite e Tauri vengono aggiunti allo step 1.3.
 * @relatedDocs docs/catalog/ARCH/01-monorepo-setup.md
 * @testFile apps/desktop-client/tests/app-info.test.ts
 */
import { APP_NAME } from '@manaforge/shared';

/**
 * Compone il titolo della finestra principale.
 *
 * @param page - Nome della pagina corrente; se vuoto viene mostrato solo il nome dell'app.
 * @returns Il titolo, es. `"Manaforge — Home"`.
 */
export const buildWindowTitle = (page?: string): string => {
  const trimmed = page?.trim();
  return trimmed ? `${APP_NAME} — ${trimmed}` : APP_NAME;
};
