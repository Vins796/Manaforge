/**
 * @nature [API]
 * @module Password
 * @description Hashing e verifica delle password con Argon2id (parametri OWASP).
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/auth/password.test.ts
 */
import { hash, verify, type Options } from '@node-rs/argon2';

/**
 * Valore di `Algorithm.Argon2id` di `@node-rs/argon2`: l'enum è un `const enum` ambientale,
 * non importabile con `verbatimModuleSyntax`. Verificato dal test sul prefisso `$argon2id$`.
 */
const ARGON2ID = 2;

/** Parametri Argon2id raccomandati da OWASP (19 MiB, 2 iterazioni, parallelismo 1). */
export const ARGON2_OPTIONS: Readonly<Options> = Object.freeze({
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

/**
 * Calcola l'hash Argon2id (formato PHC, salt incluso) di una password.
 *
 * @param password - Password in chiaro.
 * @returns Hash in formato `$argon2id$...`.
 */
export const hashPassword = (password: string): Promise<string> => hash(password, ARGON2_OPTIONS);

/**
 * Verifica una password contro un hash. Un hash malformato vale come password errata.
 *
 * @param passwordHash - Hash salvato nel DB.
 * @param password - Password in chiaro inviata dall'utente.
 * @returns `true` se coincidono.
 */
export const verifyPassword = async (passwordHash: string, password: string): Promise<boolean> => {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
};

let dummyHash: Promise<string> | undefined;

/**
 * Esegue una verifica a vuoto con lo stesso costo di una reale, per non rivelare
 * tramite i tempi di risposta se un'email è registrata.
 *
 * @param password - Password inviata dall'utente.
 */
export const burnPasswordVerification = async (password: string): Promise<void> => {
  dummyHash ??= hashPassword('manaforge-timing-equalizer');
  await verifyPassword(await dummyHash, password);
};
