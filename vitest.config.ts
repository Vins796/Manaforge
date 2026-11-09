/**
 * @nature [TEST]
 * @module VitestConfig
 * @description Configurazione Vitest multi-progetto: un progetto per workspace, alias ai sorgenti TS, copertura v8.
 * @relatedDocs docs/catalog/TEST/01-test-runner.md
 * @testFile packages/shared/tests/smoke.test.ts
 */
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/** Risolve i package interni ai sorgenti, così i test non richiedono una build preventiva. */
const alias = {
  '@manaforge/shared': fromRoot('./packages/shared/src/index.ts'),
  '@manaforge/engine': fromRoot('./packages/engine/src/index.ts'),
};

const nodeProject = (name: string, root: string) => ({
  resolve: { alias },
  test: { name, root, environment: 'node' as const, include: ['tests/**/*.test.ts'] },
});

export default defineConfig({
  test: {
    projects: [
      nodeProject('shared', './packages/shared'),
      nodeProject('engine', './packages/engine'),
      nodeProject('server', './apps/server'),
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'desktop-client',
          root: './apps/desktop-client',
          environment: 'jsdom',
          include: ['tests/**/*.test.{ts,tsx}'],
          setupFiles: ['./tests/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
      // Entry point di solo wiring (eccezione documentata in .cursorrules §4).
      exclude: ['apps/*/src/main*.{ts,tsx}'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        'packages/engine/src/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  },
});
