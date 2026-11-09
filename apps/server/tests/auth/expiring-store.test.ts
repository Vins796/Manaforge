/**
 * @nature [TEST]
 * @module ExpiringStoreTest
 * @description Verifica scadenza, uso singolo e capacità massima dello store in memoria.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/auth/expiring-store.test.ts
 */
import { describe, expect, it } from 'vitest';
import { createExpiringStore } from '../../src/auth/expiring-store.js';

describe('createExpiringStore', () => {
  it('restituisce i valori fino alla scadenza', () => {
    let now = 0;
    const store = createExpiringStore<number>({ ttlMs: 100, maxEntries: 10, now: () => now });
    store.set('a', 1);
    now = 99;
    expect(store.get('a')).toBe(1);
    now = 100;
    expect(store.get('a')).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('take rimuove la voce (uso singolo)', () => {
    const store = createExpiringStore<string>({ ttlMs: 1000, maxEntries: 10 });
    store.set('k', 'v');
    expect(store.take('k')).toBe('v');
    expect(store.take('k')).toBeUndefined();
  });

  it('elimina la voce più vecchia oltre la capacità e rinnova le chiavi riscritte', () => {
    const store = createExpiringStore<number>({ ttlMs: 1000, maxEntries: 2 });
    store.set('a', 1);
    store.set('b', 2);
    store.set('a', 10);
    store.set('c', 3);
    expect(store.get('b')).toBeUndefined();
    expect(store.get('a')).toBe(10);
    expect(store.get('c')).toBe(3);
    expect(store.size).toBe(2);
  });
});
