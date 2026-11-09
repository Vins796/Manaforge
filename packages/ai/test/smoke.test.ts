import { describe, expect, it } from 'vitest';
import { PACKAGE_ID } from '../src/index.js';

describe('@manaforge/ai smoke', () => {
  it('è risolvibile dal runner di test', () => {
    expect(PACKAGE_ID).toBe('@manaforge/ai');
  });
});
