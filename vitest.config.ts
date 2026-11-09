import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const PACKAGES = ['shared', 'cards', 'engine', 'ai', 'net', 'db'] as const;

/** Risolve i package interni ai sorgenti TS, così i test non richiedono una build preventiva. */
const alias = Object.fromEntries(
  PACKAGES.map((name) => [
    `@manaforge/${name}`,
    fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url)),
  ]),
);

export default defineConfig({
  test: {
    projects: PACKAGES.map((name) => ({
      resolve: { alias },
      test: {
        name,
        root: `./packages/${name}`,
        include: ['test/**/*.test.ts'],
        environment: 'node',
      },
    })),
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
