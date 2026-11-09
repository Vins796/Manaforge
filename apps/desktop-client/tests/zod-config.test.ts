/**
 * @nature [TEST]
 * @module ZodConfigTest
 * @description Verifica che l'import del modulo attivi la modalità jitless di Zod.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/desktop-client/tests/zod-config.test.ts
 */
import { describe, expect, it } from 'vitest';
import { isZodJitless } from '../src/zod-config.js';

describe('zod-config', () => {
  it('attiva jitless all\'import', () => {
    expect(isZodJitless()).toBe(true);
  });
});
