/**
 * @nature [TEST]
 * @module EngineSmokeTest
 * @description Smoke test: l'engine è risolvibile e il collegamento con `@manaforge/shared` funziona.
 * @relatedDocs docs/catalog/TEST/01-test-runner.md
 * @testFile packages/engine/tests/smoke.test.ts
 */
import { describe, expect, it } from 'vitest';
import { ENGINE_ID } from '../src/index.js';

describe('@manaforge/engine smoke', () => {
  it('risolve la dipendenza verso shared', () => {
    expect(ENGINE_ID).toBe('Manaforge/engine');
  });
});
