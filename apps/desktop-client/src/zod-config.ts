/**
 * @nature [UI]
 * @module ZodConfig
 * @description Disattiva la compilazione JIT di Zod: la CSP del client vieta `eval`/`new Function`.
 *   Va importato per primo in `main.tsx`, perché gli schemi leggono l'impostazione quando vengono costruiti.
 * @relatedDocs docs/catalog/UI/01-login-page.md
 * @testFile apps/desktop-client/tests/zod-config.test.ts
 */
import { z } from 'zod';

z.config({ jitless: true });

/** Indica se la configurazione CSP-safe di Zod è attiva. */
export const isZodJitless = (): boolean => z.config().jitless === true;
