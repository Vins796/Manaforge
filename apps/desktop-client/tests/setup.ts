/**
 * @nature [TEST]
 * @module ClientTestSetup
 * @description Setup dei test del client: matcher jest-dom e pulizia del DOM tra un test e l'altro.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/setup.ts
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
