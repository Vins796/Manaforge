/**
 * @nature [TEST]
 * @module CardRoutesTest
 * @description Test API del catalogo: elenco carte protetto e senza percorsi locali, illustrazioni SVG servite dalla cache con header di sicurezza.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/server/tests/routes/cards.test.ts
 */
import { existsSync, rmSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardListResponseSchema, err, unwrap } from '@manaforge/shared';
import { buildApp } from '../../src/app.js';
import { syncCatalog } from '../../src/catalog/catalog-sync.js';
import { loadTestCatalog } from '../helpers/catalog-fixtures.js';
import { appDeps, createTestContext, type TestContext } from '../helpers/test-context.js';

describe('rotte /api/cards', () => {
  let ctx: TestContext;
  let app: FastifyInstance;
  let token: string;

  beforeEach(async () => {
    ctx = createTestContext();
    unwrap(syncCatalog(ctx.conn.db, loadTestCatalog()));
    app = await buildApp({ ...appDeps(ctx), google: null, allowedOrigins: [] });
    const user = ctx.users.insert({ email: 'ada@example.com', username: 'Ada' });
    token = (await ctx.tokens.issue(user.id)).token;
  });

  afterEach(async () => {
    await app.close();
    ctx.conn.close();
    rmSync(ctx.cacheDir, { recursive: true, force: true });
  });

  it('GET /api/cards richiede la sessione (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cards' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/cards restituisce il catalogo ordinato, senza percorsi locali', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cards', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    const { cards } = CardListResponseSchema.parse(res.json());
    expect(cards.map((card) => card.id)).toEqual(['TS1-001', 'TS1-003', 'TS1-002']);
    expect(cards[2]).toMatchObject({ name: 'Drago di Prova', typeLine: 'Creatura — Drago', power: 4, keywords: ['ALATO'] });
    expect(res.body).not.toContain('localImage');
    expect(res.body).not.toContain('catalogVersion');
  });

  it('GET /api/cards/:id/image/:variant genera e serve lo SVG dalla cache', async () => {
    const normal = await app.inject({ method: 'GET', url: '/api/cards/TS1-002/image/normal' });
    expect(normal.statusCode).toBe(200);
    expect(normal.headers['content-type']).toBe('image/svg+xml; charset=utf-8');
    expect(normal.headers['x-content-type-options']).toBe('nosniff');
    expect(normal.headers['content-security-policy']).toContain("default-src 'none'");
    expect(normal.body).toMatch(/^<svg[\s\S]*<\/svg>$/);

    const crop = await app.inject({ method: 'GET', url: '/api/cards/TS1-002/image/crop' });
    expect(crop.statusCode).toBe(200);
    expect(crop.body).not.toBe(normal.body);

    const paths = ctx.cards.findById('TS1-002');
    expect(paths?.localImageNormalPath && existsSync(paths.localImageNormalPath)).toBe(true);
  });

  it('risponde 404 per carte inesistenti, id malformati o varianti sconosciute', async () => {
    for (const url of ['/api/cards/TS1-999/image/normal', '/api/cards/..%2Fetc/image/normal', '/api/cards/TS1-002/image/big']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    }
  });

  it('risponde 500 senza dettagli se la scrittura della cache fallisce', async () => {
    await app.close();
    const imageCache = { ensureCardImages: vi.fn(() => err({ code: 'IMAGE_WRITE_FAILED' as const, message: 'EACCES /segreto' })) };
    app = await buildApp({ ...appDeps(ctx), imageCache, google: null, allowedOrigins: [] });
    const res = await app.inject({ method: 'GET', url: '/api/cards/TS1-002/image/normal' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('INTERNAL_ERROR');
    expect(res.body).not.toContain('segreto');
  });
});
