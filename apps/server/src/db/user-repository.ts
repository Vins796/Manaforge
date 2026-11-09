/**
 * @nature [DATA]
 * @module UserRepository
 * @description Accesso alla tabella `users`: ricerca per id/email/googleId, inserimento e collegamento Google.
 * @relatedDocs docs/catalog/DATA/01-sqlite-schema.md
 * @testFile apps/server/tests/db/user-repository.test.ts
 */
import { eq } from 'drizzle-orm';
import type { AppDatabase } from './db-client.js';
import { users, type NewUser, type User } from './db-schema.js';

/** Operazioni sulla tabella `users`. */
export interface UserRepository {
  findById(id: string): User | undefined;
  findByEmail(email: string): User | undefined;
  findByGoogleId(googleId: string): User | undefined;
  /** Inserisce un utente. Lancia in caso di violazione di vincoli (es. email duplicata). */
  insert(user: NewUser): User;
  /** Collega un account Google a un utente esistente. */
  setGoogleId(userId: string, googleId: string): User | undefined;
}

/**
 * Crea il repository degli utenti.
 *
 * @param db - Istanza Drizzle.
 * @returns Il {@link UserRepository}.
 */
export const createUserRepository = (db: AppDatabase): UserRepository => ({
  findById: (id) => db.select().from(users).where(eq(users.id, id)).get(),
  findByEmail: (email) => db.select().from(users).where(eq(users.email, email)).get(),
  findByGoogleId: (googleId) => db.select().from(users).where(eq(users.googleId, googleId)).get(),
  insert: (user) => db.insert(users).values(user).returning().get(),
  setGoogleId: (userId, googleId) =>
    db.update(users).set({ googleId }).where(eq(users.id, userId)).returning().get(),
});

/**
 * Indica se un errore SQLite è una violazione di vincolo UNIQUE.
 *
 * @param cause - Errore catturato.
 * @returns `true` per `SQLITE_CONSTRAINT_UNIQUE`.
 */
export const isUniqueViolation = (cause: unknown): boolean => {
  let current: unknown = cause;
  while (typeof current === 'object' && current !== null) {
    if ((current as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
};
