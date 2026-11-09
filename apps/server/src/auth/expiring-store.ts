/**
 * @nature [API]
 * @module ExpiringStore
 * @description Mappa in memoria con scadenza per voce, usata per i flussi OAuth (state PKCE e risultati da ritirare).
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/auth/expiring-store.test.ts
 */

/** Mappa chiave → valore con scadenza e capacità massima. */
export interface ExpiringStore<V> {
  set(key: string, value: V): void;
  /** Legge senza rimuovere. */
  get(key: string): V | undefined;
  /** Legge e rimuove (uso singolo). */
  take(key: string): V | undefined;
  readonly size: number;
}

/** Opzioni di {@link createExpiringStore}. */
export interface ExpiringStoreOptions {
  readonly ttlMs: number;
  /** Numero massimo di voci: oltre, viene eliminata la più vecchia (protezione da flooding). */
  readonly maxEntries: number;
  readonly now?: () => number;
}

/**
 * Crea uno store con scadenza. Le voci scadute vengono rimosse pigramente a ogni accesso.
 *
 * @param options - Durata delle voci, capacità e orologio.
 * @returns Lo store.
 */
export const createExpiringStore = <V>({ ttlMs, maxEntries, now = Date.now }: ExpiringStoreOptions): ExpiringStore<V> => {
  const entries = new Map<string, { value: V; expiresAt: number }>();

  const prune = (): void => {
    const current = now();
    for (const [key, entry] of entries) if (entry.expiresAt <= current) entries.delete(key);
  };

  const get = (key: string): V | undefined => {
    prune();
    return entries.get(key)?.value;
  };

  return {
    set(key, value) {
      prune();
      entries.delete(key);
      while (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value as string;
        entries.delete(oldest);
      }
      entries.set(key, { value, expiresAt: now() + ttlMs });
    },
    get,
    take(key) {
      const value = get(key);
      entries.delete(key);
      return value;
    },
    get size() {
      prune();
      return entries.size;
    },
  };
};
