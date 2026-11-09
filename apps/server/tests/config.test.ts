/**
 * @nature [TEST]
 * @module ServerConfigTest
 * @description Verifica default, override e validazione delle variabili d'ambiente.
 * @relatedDocs docs/catalog/TEST/03-auth-tests.md
 * @testFile apps/server/tests/config.test.ts
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_ALLOWED_ORIGINS, DEFAULT_PORT, loadServerConfig } from '../src/config.js';

describe('loadServerConfig', () => {
  it('applica i default sicuri (solo loopback, Google disattivato)', () => {
    expect(loadServerConfig({})).toEqual({
      ok: true,
      value: { host: '127.0.0.1', port: DEFAULT_PORT, allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS], google: null },
    });
  });

  it('legge override e credenziali Google', () => {
    const result = loadServerConfig({
      MANAFORGE_HOST: '0.0.0.0',
      MANAFORGE_PORT: '0',
      MANAFORGE_ALLOWED_ORIGINS: 'http://a.test, ,http://b.test',
      MANAFORGE_GOOGLE_CLIENT_ID: 'cid',
      MANAFORGE_GOOGLE_CLIENT_SECRET: 'sec',
    });
    expect(result).toEqual({
      ok: true,
      value: { host: '0.0.0.0', port: 0, allowedOrigins: ['http://a.test', 'http://b.test'], google: { clientId: 'cid', clientSecret: 'sec' } },
    });
  });

  it.each([{ MANAFORGE_PORT: 'abc' }, { MANAFORGE_PORT: '70000' }, { MANAFORGE_GOOGLE_CLIENT_ID: '' }])('rifiuta %j', (env) => {
    const result = loadServerConfig(env);
    expect(result.ok).toBe(false);
  });
});
