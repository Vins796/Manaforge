/**
 * @nature [API]
 * @module GoogleCredentials
 * @description Converte il JSON del client OAuth scaricato da Google Cloud Console nelle variabili `MANAFORGE_GOOGLE_*` del file `.env`.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/auth/google-credentials.test.ts
 */
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { err, ok, type Result } from '@manaforge/shared';

/** Credenziali estratte dal JSON di Google. */
export interface GoogleClientCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

/** Errori di lettura/scrittura delle credenziali. */
export type GoogleCredentialsError =
  | { readonly code: 'INVALID_JSON' | 'WRONG_CLIENT_TYPE' | 'MISSING_FIELDS'; readonly message: string }
  | { readonly code: 'IO_ERROR'; readonly message: string };

const InstalledClientSchema = z.object({
  installed: z.object({
    client_id: z.string().regex(/^[\w-]+\.apps\.googleusercontent\.com$/, 'client_id non valido'),
    client_secret: z.string().min(1),
  }),
});

/** Nomi delle variabili scritte nel `.env`. */
export const GOOGLE_ENV_KEYS = { clientId: 'MANAFORGE_GOOGLE_CLIENT_ID', clientSecret: 'MANAFORGE_GOOGLE_CLIENT_SECRET' } as const;

/**
 * Estrae le credenziali dal JSON di un client OAuth di tipo "App desktop" (`{ "installed": { ... } }`).
 *
 * @param raw - Contenuto del file `client_secret_*.json`.
 * @returns Le credenziali, oppure un errore che spiega cosa correggere.
 */
export const parseGoogleClientJson = (raw: string): Result<GoogleClientCredentials, GoogleCredentialsError> => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return err({ code: 'INVALID_JSON', message: 'Il file non contiene JSON valido.' });
  }
  if (typeof json === 'object' && json !== null && 'web' in json) {
    return err({
      code: 'WRONG_CLIENT_TYPE',
      message: 'Il client è di tipo "Applicazione web": crea un client di tipo "App desktop".',
    });
  }
  const parsed = InstalledClientSchema.safeParse(json);
  if (!parsed.success) {
    return err({ code: 'MISSING_FIELDS', message: `JSON del client non riconosciuto:\n${z.prettifyError(parsed.error)}` });
  }
  return ok({ clientId: parsed.data.installed.client_id, clientSecret: parsed.data.installed.client_secret });
};

/**
 * Inserisce o aggiorna le variabili Google in un contenuto `.env`, preservando le altre righe.
 *
 * @param current - Contenuto attuale del `.env` (stringa vuota se assente).
 * @param credentials - Credenziali da scrivere.
 * @returns Il nuovo contenuto, terminato da newline.
 */
export const upsertGoogleEnv = (current: string, credentials: GoogleClientCredentials): string => {
  const values: Record<string, string> = {
    [GOOGLE_ENV_KEYS.clientId]: credentials.clientId,
    [GOOGLE_ENV_KEYS.clientSecret]: credentials.clientSecret,
  };
  const seen = new Set<string>();
  const lines = current
    .split(/\r?\n/)
    .filter((line, index, all) => !(index === all.length - 1 && line === ''))
    .map((line) => {
      const key = /^\s*([A-Z0-9_]+)\s*=/.exec(line)?.[1];
      if (key && key in values) {
        seen.add(key);
        return `${key}=${values[key]}`;
      }
      return line;
    });
  for (const [key, value] of Object.entries(values)) if (!seen.has(key)) lines.push(`${key}=${value}`);
  return `${lines.join('\n')}\n`;
};

/**
 * Legge il JSON di Google e scrive/aggiorna il file `.env` con permessi 0600.
 *
 * @param paths - Percorso del JSON scaricato e del `.env` di destinazione.
 * @returns Le credenziali scritte, oppure un errore.
 */
export const writeGoogleEnvFromJson = ({
  jsonPath,
  envPath,
}: {
  readonly jsonPath: string;
  readonly envPath: string;
}): Result<GoogleClientCredentials, GoogleCredentialsError> => {
  let raw: string;
  try {
    raw = readFileSync(jsonPath, 'utf8');
  } catch (cause) {
    return err({ code: 'IO_ERROR', message: `Impossibile leggere ${jsonPath}: ${String(cause)}` });
  }
  const credentials = parseGoogleClientJson(raw);
  if (!credentials.ok) return credentials;

  let current = '';
  try {
    current = readFileSync(envPath, 'utf8');
  } catch {
    // .env assente: verrà creato.
  }
  try {
    writeFileSync(envPath, upsertGoogleEnv(current, credentials.value), { mode: 0o600 });
    // `mode` vale solo alla creazione: un .env preesistente va ristretto esplicitamente.
    chmodSync(envPath, 0o600);
  } catch (cause) {
    return err({ code: 'IO_ERROR', message: `Impossibile scrivere ${envPath}: ${String(cause)}` });
  }
  return credentials;
};
