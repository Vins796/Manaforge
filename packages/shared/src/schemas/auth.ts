/**
 * @nature [API]
 * @module AuthSchemas
 * @description Schemi Zod e tipi dei payload REST di autenticazione, condivisi tra server e client.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile packages/shared/tests/schemas/auth.test.ts
 */
import { z } from 'zod';

/** Lunghezza minima della password. */
export const PASSWORD_MIN_LENGTH = 8;
/** Lunghezza massima della password (limita il costo di hashing di input abnormi). */
export const PASSWORD_MAX_LENGTH = 128;
/** Lunghezza minima del nome utente. */
export const USERNAME_MIN_LENGTH = 3;
/** Lunghezza massima del nome utente. */
export const USERNAME_MAX_LENGTH = 24;

/** Email normalizzata: spazi rimossi e minuscole. */
export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** Password per la registrazione. */
export const PasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/** Nome utente visibile: lettere, cifre, spazio, `_` e `-`. */
export const UsernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(/^[\p{L}\p{N} _-]+$/u, 'Sono ammessi lettere, cifre, spazio, "_" e "-"');

/** Corpo di `POST /api/auth/register`. */
export const RegisterRequestSchema = z.strictObject({
  email: EmailSchema,
  username: UsernameSchema,
  password: PasswordSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** Corpo di `POST /api/auth/login`: la password non viene validata nel formato per non rivelare le regole a un attaccante. */
export const LoginRequestSchema = z.strictObject({
  email: EmailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Utente come esposto al client (nessun hash, nessun id Google). */
export const PublicUserSchema = z.strictObject({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  avatar: z.string(),
  hasPassword: z.boolean(),
  hasGoogle: z.boolean(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

/** Risposta di login/registrazione riuscita. */
export const AuthResponseSchema = z.strictObject({
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
  user: PublicUserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/** Risposta di `GET /api/auth/google/start`. */
export const GoogleStartResponseSchema = z.strictObject({
  authUrl: z.url(),
  state: z.string().min(1),
});
export type GoogleStartResponse = z.infer<typeof GoogleStartResponseSchema>;

/** Codici di errore restituiti dalle API di autenticazione. */
export const AUTH_ERROR_CODES = [
  'VALIDATION_ERROR',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'USER_NOT_FOUND',
  'RATE_LIMITED',
  'GOOGLE_NOT_CONFIGURED',
  'GOOGLE_STATE_INVALID',
  'GOOGLE_DENIED',
  'GOOGLE_EXCHANGE_FAILED',
  'GOOGLE_EMAIL_NOT_VERIFIED',
  'GOOGLE_ACCOUNT_CONFLICT',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const;
export const AuthErrorCodeSchema = z.enum(AUTH_ERROR_CODES);
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;

/** Esito del polling `GET /api/auth/google/result`. */
export const GoogleResultResponseSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('pending') }),
  z.strictObject({ status: z.literal('complete'), auth: AuthResponseSchema }),
  z.strictObject({ status: z.literal('error'), code: AuthErrorCodeSchema }),
]);
export type GoogleResultResponse = z.infer<typeof GoogleResultResponseSchema>;

/** Corpo di ogni risposta di errore delle API. */
export const ApiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
