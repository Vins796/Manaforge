/**
 * @nature [ARCH]
 * @module ServerConfig
 * @description Lettura e validazione della configurazione del server dalle variabili d'ambiente `MANAFORGE_*`.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/config.test.ts
 */
import { z } from 'zod';
import { err, ok, type Result } from '@manaforge/shared';

/** Porta predefinita del server locale. */
export const DEFAULT_PORT = 47_821;
/** Origini del client ammesse di default (dev server Vite e WebView Tauri su Linux/Windows). */
export const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'tauri://localhost', 'http://tauri.localhost'] as const;

const EnvSchema = z.object({
  MANAFORGE_HOST: z.string().min(1).default('127.0.0.1'),
  MANAFORGE_PORT: z.coerce.number().int().min(0).max(65_535).default(DEFAULT_PORT),
  MANAFORGE_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((o) => o.trim()).filter(Boolean) : [...DEFAULT_ALLOWED_ORIGINS])),
  MANAFORGE_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  MANAFORGE_GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
});

/** Configurazione validata del server. */
export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly allowedOrigins: readonly string[];
  readonly google: { readonly clientId: string; readonly clientSecret?: string | undefined } | null;
}

/**
 * Valida le variabili d'ambiente e produce la configurazione.
 *
 * @param env - Variabili d'ambiente (in produzione `process.env`).
 * @returns La configurazione, oppure il messaggio di errore di validazione.
 */
export const loadServerConfig = (env: Readonly<Record<string, string | undefined>>): Result<ServerConfig, string> => {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) return err(z.prettifyError(parsed.error));
  const data = parsed.data;
  return ok({
    host: data.MANAFORGE_HOST,
    port: data.MANAFORGE_PORT,
    allowedOrigins: data.MANAFORGE_ALLOWED_ORIGINS,
    google: data.MANAFORGE_GOOGLE_CLIENT_ID
      ? { clientId: data.MANAFORGE_GOOGLE_CLIENT_ID, clientSecret: data.MANAFORGE_GOOGLE_CLIENT_SECRET }
      : null,
  });
};
