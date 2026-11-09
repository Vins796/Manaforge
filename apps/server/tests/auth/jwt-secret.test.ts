/**
 * @nature [TEST]
 * @module JwtSecretTest
 * @description Verifica creazione al primo avvio, riuso, permessi e gestione di file corrotti o non leggibili.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/auth/jwt-secret.test.ts
 */
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JWT_SECRET_BYTES, loadOrCreateJwtSecret } from '../../src/auth/jwt-secret.js';

describe('loadOrCreateJwtSecret', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'manaforge-secret-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('crea il segreto con permessi 0600 e lo riusa alle letture successive', () => {
    const file = join(dir, 'data', 'jwt.secret');
    const first = loadOrCreateJwtSecret(file);
    expect(first.ok && first.value.byteLength).toBe(JWT_SECRET_BYTES);
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(loadOrCreateJwtSecret(file)).toEqual(first);
  });

  it('segnala un file di lunghezza errata invece di sovrascriverlo', () => {
    const file = join(dir, 'jwt.secret');
    writeFileSync(file, 'troppo corto');
    expect(loadOrCreateJwtSecret(file)).toMatchObject({ ok: false, error: { code: 'JWT_SECRET_INVALID' } });
  });

  it('segnala errori di I/O in lettura e in creazione', () => {
    const asDir = join(dir, 'una-cartella');
    mkdirSync(asDir);
    expect(loadOrCreateJwtSecret(asDir)).toMatchObject({ ok: false, error: { code: 'JWT_SECRET_IO' } });

    const blocker = join(dir, 'file');
    writeFileSync(blocker, 'x');
    expect(loadOrCreateJwtSecret(join(blocker, 'jwt.secret'))).toMatchObject({ ok: false, error: { code: 'JWT_SECRET_IO' } });
  });
});
