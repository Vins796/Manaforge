/**
 * @nature [ARCH]
 * @module ViteConfig
 * @description Configurazione Vite del client desktop (React, Tailwind CSS 4, dev server sulla porta ammessa dal CORS del server).
 * @relatedDocs docs/catalog/UI/01-login-page.md
 * @testFile apps/desktop-client/tests/smoke.test.ts
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: 'localhost', port: 5173, strictPort: true },
  build: { target: 'es2023', outDir: 'dist-web' },
});
