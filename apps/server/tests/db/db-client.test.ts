/**
 * @nature [TEST]
 * @module DbClientTest
 * @description Verifica apertura su file, PRAGMA, idempotenza delle migrazioni e gestione degli errori.
 * @relatedDocs docs/catalog/DATA/01-sqlite-schema.md
 * @testFile apps/server/tests/db/db-client.test.ts
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unwrap } from '@manaforge/shared';
import { IN_MEMORY, openDatabase } from '../../src/db/db-client.js';
import { users } from '../../src/db/db-schema.js';

describe('openDatabase', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'manaforge-db-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('crea le cartelle mancanti, abilita WAL e chiavi esterne', () => {
    const conn = unwrap(openDatabase({ filename: join(dir, 'nested', 'data', 'test.db') }));
    expect(conn.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(conn.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    conn.close();
  });

  it('applica le migrazioni una sola volta e conserva i dati alla riapertura', () => {
    const filename = join(dir, 'test.db');
    const first = unwrap(openDatabase({ filename }));
    first.db.insert(users).values({ email: 'a@b.it', username: 'A' }).run();
    const applied = first.sqlite.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get() as { n: number };
    first.close();

    const second = unwrap(openDatabase({ filename }));
    expect(second.db.select().from(users).all()).toHaveLength(1);
    expect(second.sqlite.prepare('SELECT count(*) AS n FROM __drizzle_migrations').get()).toEqual(applied);
    second.close();
  });

  it('crea tutte le tabelle dello schema', () => {
    const conn = unwrap(openDatabase({ filename: IN_MEMORY }));
    const tables = conn.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite%' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(['cards', 'deck_cards', 'decks', 'matches', 'users']);
    conn.close();
  });

  it('restituisce DB_OPEN_FAILED se il percorso non è apribile', () => {
    const blocker = join(dir, 'file-non-cartella');
    writeFileSync(blocker, 'x');
    const result = openDatabase({ filename: join(blocker, 'test.db') });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DB_OPEN_FAILED');
  });

  it('restituisce DB_MIGRATION_FAILED se la cartella delle migrazioni non esiste', () => {
    const result = openDatabase({ filename: IN_MEMORY, migrationsDir: join(dir, 'assente') });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DB_MIGRATION_FAILED');
      expect(result.error.message).toBeTruthy();
    }
  });
});
