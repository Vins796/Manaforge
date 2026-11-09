/**
 * @nature [TEST]
 * @module GoogleCredentialsTest
 * @description Verifica parsing del JSON di Google, aggiornamento del `.env` e scrittura su disco con permessi 0600.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/auth/google-credentials.test.ts
 */
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unwrap } from '@manaforge/shared';
import { loadServerConfig } from '../../src/config.js';
import { parseGoogleClientJson, upsertGoogleEnv, writeGoogleEnvFromJson } from '../../src/auth/google-credentials.js';

const desktopJson = JSON.stringify({
  installed: {
    client_id: '1234-abc.apps.googleusercontent.com',
    project_id: 'manaforge',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    client_secret: 'GOCSPX-test-secret',
    redirect_uris: ['http://localhost'],
  },
});
const creds = { clientId: '1234-abc.apps.googleusercontent.com', clientSecret: 'GOCSPX-test-secret' };

describe('parseGoogleClientJson', () => {
  it('estrae client_id e client_secret da un client "App desktop"', () => {
    expect(parseGoogleClientJson(desktopJson)).toEqual({ ok: true, value: creds });
  });

  it.each([
    ['{non json', 'INVALID_JSON'],
    [JSON.stringify({ web: { client_id: 'x.apps.googleusercontent.com', client_secret: 's' } }), 'WRONG_CLIENT_TYPE'],
    [JSON.stringify({ installed: { client_id: 'non-google-id', client_secret: 's' } }), 'MISSING_FIELDS'],
    [JSON.stringify({ installed: { client_id: 'x.apps.googleusercontent.com' } }), 'MISSING_FIELDS'],
    ['null', 'MISSING_FIELDS'],
  ])('rifiuta %s con %s', (raw, code) => {
    expect(parseGoogleClientJson(raw)).toMatchObject({ ok: false, error: { code } });
  });
});

describe('upsertGoogleEnv', () => {
  it('crea le variabili in un file vuoto', () => {
    expect(upsertGoogleEnv('', creds)).toBe(
      'MANAFORGE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com\nMANAFORGE_GOOGLE_CLIENT_SECRET=GOCSPX-test-secret\n',
    );
  });

  it('aggiorna i valori esistenti preservando commenti e altre variabili', () => {
    const current = '# config\r\nMANAFORGE_PORT=5000\nMANAFORGE_GOOGLE_CLIENT_ID=vecchio\n';
    expect(upsertGoogleEnv(current, creds)).toBe(
      '# config\nMANAFORGE_PORT=5000\nMANAFORGE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com\nMANAFORGE_GOOGLE_CLIENT_SECRET=GOCSPX-test-secret\n',
    );
  });
});

describe('writeGoogleEnvFromJson', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'manaforge-gcreds-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('scrive un .env leggibile da loadServerConfig con permessi 0600', () => {
    const jsonPath = join(dir, 'client_secret.json');
    const envPath = join(dir, '.env');
    writeFileSync(jsonPath, desktopJson);
    writeFileSync(envPath, 'MANAFORGE_PORT=47821\n');

    expect(writeGoogleEnvFromJson({ jsonPath, envPath })).toEqual({ ok: true, value: creds });
    const content = readFileSync(envPath, 'utf8');
    const env = Object.fromEntries(content.trim().split('\n').map((l) => l.split('=') as [string, string]));
    expect(unwrap(loadServerConfig(env)).google).toEqual(creds);
    if (process.platform !== 'win32') expect(statSync(envPath).mode & 0o777).toBe(0o600);
  });

  it('crea il .env se assente e propaga gli errori di parsing', () => {
    const jsonPath = join(dir, 'c.json');
    writeFileSync(jsonPath, desktopJson);
    expect(writeGoogleEnvFromJson({ jsonPath, envPath: join(dir, 'nuovo.env') }).ok).toBe(true);

    writeFileSync(jsonPath, '{}');
    expect(writeGoogleEnvFromJson({ jsonPath, envPath: join(dir, 'x.env') })).toMatchObject({ ok: false, error: { code: 'MISSING_FIELDS' } });
  });

  it('segnala errori di lettura e scrittura', () => {
    expect(writeGoogleEnvFromJson({ jsonPath: join(dir, 'assente.json'), envPath: join(dir, '.env') })).toMatchObject({
      ok: false,
      error: { code: 'IO_ERROR' },
    });
    const jsonPath = join(dir, 'c.json');
    writeFileSync(jsonPath, desktopJson);
    expect(writeGoogleEnvFromJson({ jsonPath, envPath: join(dir, 'cartella-inesistente', '.env') })).toMatchObject({
      ok: false,
      error: { code: 'IO_ERROR' },
    });
  });
});
