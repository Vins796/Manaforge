/**
 * @nature [TEST]
 * @module ServerSmokeTest
 * @description Smoke test: il server risolve shared ed engine.
 * @relatedDocs docs/catalog/TEST/01-test-runner.md
 * @testFile apps/server/tests/smoke.test.ts
 */
import { describe, expect, it } from 'vitest';
import { getServerInfo } from '../src/index.js';

describe('@manaforge/server smoke', () => {
  it('collega shared ed engine', () => {
    expect(getServerInfo()).toEqual({ name: 'Manaforge/server', engine: 'Manaforge/engine' });
  });
});
