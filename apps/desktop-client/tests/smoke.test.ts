/**
 * @nature [TEST]
 * @module DesktopClientSmokeTest
 * @description Smoke test: il client risolve `@manaforge/shared`.
 * @relatedDocs docs/catalog/TEST/01-test-runner.md
 * @testFile apps/desktop-client/tests/smoke.test.ts
 */
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@manaforge/shared';
import { buildWindowTitle } from '../src/app-info.js';

describe('@manaforge/desktop-client smoke', () => {
  it('compone il titolo usando shared', () => {
    expect(buildWindowTitle()).toBe(APP_NAME);
  });
});
