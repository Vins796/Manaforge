/**
 * @nature [UI]
 * @module ExternalBrowser
 * @description Apre un URL https nel browser di sistema (necessario per OAuth: Google vieta il login nelle WebView incorporate).
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/desktop-client/tests/services/external-browser.test.ts
 */

/** Funzione che apre un URL esterno; restituisce `false` se l'apertura è fallita o l'URL non è ammesso. */
export type OpenExternal = (url: string) => boolean;

/**
 * Crea l'apertura di URL esterni. Accetta solo `https:` per evitare l'apertura di schemi arbitrari.
 * Allo step 4.3 l'implementazione Tauri (plugin opener) sostituirà `window.open` tramite iniezione.
 *
 * @param open - Funzione di apertura, default `window.open`.
 * @returns L'{@link OpenExternal}.
 */
export const createOpenExternal =
  (open: (url: string, target: string, features: string) => unknown = (...args) => window.open(...args)): OpenExternal =>
  (url) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:') return false;
    return open(parsed.toString(), '_blank', 'noopener,noreferrer') !== false;
  };
