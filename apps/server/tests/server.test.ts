/**
 * @nature [TEST]
 * @module ServerTest
 * @description Avvia il server reale su una home temporanea e porta casuale, verifica persistenza e errori di avvio.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/server.test.ts
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { unwrap } from '@manaforge/shared';
import { loadServerConfig } from '../src/config.js';
import { startServer } from '../src/server.js';

const config = (env: Record<string, string> = {}) => unwrap(loadServerConfig({ MANAFORGE_PORT: '0', ...env }));

describe('startServer', () => {
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'manaforge-home-'));
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it('crea DB e segreto in ~/.manaforge e mantiene le sessioni dopo un riavvio', async () => {
    const first = unwrap(await startServer({ homeDir: home, config: config({ MANAFORGE_GOOGLE_CLIENT_ID: 'cid' }) }));
    expect(existsSync(join(home, '.manaforge', 'data', 'manaforge.db'))).toBe(true);
    expect(existsSync(join(home, '.manaforge', 'data', 'jwt.secret'))).toBe(true);

    const reg = await fetch(`${first.url}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.it', username: 'Ada', password: 'password-sicura' }),
    });
    expect(reg.status).toBe(201);
    const { token } = (await reg.json()) as { token: string };
    expect((await fetch(`${first.url}/api/auth/google/start`)).status).toBe(200);
    await first.close();

    const second = unwrap(await startServer({ homeDir: home, config: config() }));
    const me = await fetch(`${second.url}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } });
    expect(me.status).toBe(200);
    expect((await fetch(`${second.url}/api/auth/google/start`)).status).toBe(503);
    await second.close();
  });

  it('fallisce con home non valida, DB non apribile o segreto corrotto', async () => {
    expect((await startServer({ homeDir: 'relativa', config: config() })).ok).toBe(false);

    mkdirSync(join(home, '.manaforge'), { recursive: true });
    writeFileSync(join(home, '.manaforge', 'data'), 'non una cartella');
    expect(await startServer({ homeDir: home, config: config() })).toMatchObject({ ok: false, error: expect.stringContaining('DB_OPEN_FAILED') });

    const home2 = mkdtempSync(join(tmpdir(), 'manaforge-home-'));
    mkdirSync(join(home2, '.manaforge', 'data'), { recursive: true });
    writeFileSync(join(home2, '.manaforge', 'data', 'jwt.secret'), 'corto');
    expect(await startServer({ homeDir: home2, config: config() })).toMatchObject({ ok: false, error: expect.stringContaining('JWT_SECRET_INVALID') });
    rmSync(home2, { recursive: true, force: true });
  });

  it('importa il catalogo distribuito al primo avvio', async () => {
    const server = unwrap(await startServer({ homeDir: home, config: config() }));
    await server.close();
    const db = new Database(join(home, '.manaforge', 'data', 'manaforge.db'), { readonly: true });
    const { total } = db.prepare('SELECT count(*) AS total FROM cards').get() as { total: number };
    db.close();
    expect(total).toBeGreaterThanOrEqual(40);
  });

  it('non si avvia con un catalogo non valido', async () => {
    const result = await startServer({ homeDir: home, config: config(), catalogSources: [{ schemaVersion: 1 }] });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('CATALOG_INVALID') });
  });

  it('fallisce se la porta è già occupata', async () => {
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const port = (blocker.address() as { port: number }).port;
    const result = await startServer({ homeDir: home, config: config({ MANAFORGE_PORT: String(port) }) });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('Impossibile mettersi in ascolto') });
    await new Promise((resolve) => blocker.close(resolve));
  });
});
