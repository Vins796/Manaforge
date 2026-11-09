/**
 * @nature [TEST]
 * @module AppInfoTest
 * @description Verifica la composizione del titolo della finestra.
 * @relatedDocs docs/catalog/TEST/01-test-runner.md
 * @testFile apps/desktop-client/tests/app-info.test.ts
 */
import { describe, expect, it } from 'vitest';
import { buildWindowTitle } from '../src/app-info.js';

describe('buildWindowTitle', () => {
  it('include la pagina quando presente', () => {
    expect(buildWindowTitle('Home')).toBe('Manaforge — Home');
  });

  it('ripiega sul solo nome dell\'app per input vuoti', () => {
    expect(buildWindowTitle()).toBe('Manaforge');
    expect(buildWindowTitle('   ')).toBe('Manaforge');
  });
});
