/**
 * @nature [TEST]
 * @module SharedSmokeTest
 * @description Smoke test: il barrel di `@manaforge/shared` è risolvibile ed espone l'API pubblica.
 * @relatedDocs docs/catalog/TEST/01-test-runner.md
 * @testFile packages/shared/tests/smoke.test.ts
 */
import { describe, expect, it } from 'vitest';
import * as shared from '../src/index.js';

describe('@manaforge/shared smoke', () => {
  it('espone costanti e helper Result', () => {
    expect(shared.APP_NAME).toBe('Manaforge');
    expect(typeof shared.ok).toBe('function');
    expect(typeof shared.isAffinityCode).toBe('function');
    expect(typeof shared.isKeywordCode).toBe('function');
    expect(typeof shared.parseManaCost).toBe('function');
    expect(shared.CardCatalogSchema).toBeDefined();
    expect(typeof shared.validateDeck).toBe('function');
    expect(typeof shared.parseDeckList).toBe('function');
  });
});
