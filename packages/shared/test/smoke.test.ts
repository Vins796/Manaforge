import { describe, expect, it } from 'vitest';
import { APP_NAME, OPENING_HAND_SIZE, PROTOCOL_VERSION, STARTING_LIFE } from '../src/index.js';

describe('@manaforge/shared smoke', () => {
  it('espone le costanti di base', () => {
    expect(APP_NAME).toBe('Manaforge');
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
    expect(STARTING_LIFE).toBe(20);
    expect(OPENING_HAND_SIZE).toBe(7);
  });
});
