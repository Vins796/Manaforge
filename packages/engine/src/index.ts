/**
 * @nature [ARCH]
 * @module EngineIndex
 * @description Barrel pubblico di `@manaforge/engine`. I moduli di regola vengono aggiunti dalla Fase 3.
 * @relatedDocs docs/catalog/ARCH/01-monorepo-setup.md
 * @testFile packages/engine/tests/smoke.test.ts
 */
import { APP_NAME } from '@manaforge/shared';

/** Identificativo del package, usato nei log diagnostici. */
export const ENGINE_ID = `${APP_NAME}/engine`;
