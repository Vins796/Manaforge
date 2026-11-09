/**
 * @nature [API]
 * @module AuthService
 * @description Casi d'uso di autenticazione: registrazione, login manuale, login/collegamento Google, profilo corrente.
 * @relatedDocs docs/catalog/API/01-authentication.md
 * @testFile apps/server/tests/auth/auth-service.test.ts
 */
import {
  USERNAME_MAX_LENGTH,
  UsernameSchema,
  err,
  ok,
  type AuthResponse,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
  type Result,
} from '@manaforge/shared';
import type { User } from '../db/db-schema.js';
import { isUniqueViolation, type UserRepository } from '../db/user-repository.js';
import { burnPasswordVerification, hashPassword, verifyPassword } from './password.js';
import type { TokenService } from './token-service.js';

/** Nome utente usato quando il profilo Google non ne fornisce uno valido. */
export const FALLBACK_USERNAME = 'Forgiatore';

/** Profilo Google ottenuto dall'endpoint userinfo. */
export interface GoogleProfile {
  readonly sub: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name?: string | undefined;
}

/** Casi d'uso di autenticazione. */
export interface AuthService {
  register(input: RegisterRequest): Promise<Result<AuthResponse, 'EMAIL_TAKEN'>>;
  login(input: LoginRequest): Promise<Result<AuthResponse, 'INVALID_CREDENTIALS'>>;
  loginWithGoogle(
    profile: GoogleProfile,
  ): Promise<Result<AuthResponse, 'GOOGLE_EMAIL_NOT_VERIFIED' | 'GOOGLE_ACCOUNT_CONFLICT'>>;
  getProfile(userId: string): Result<PublicUser, 'USER_NOT_FOUND'>;
}

/** Dipendenze di {@link createAuthService}. */
export interface AuthServiceDeps {
  readonly users: UserRepository;
  readonly tokens: TokenService;
}

/**
 * Converte una riga `users` nella rappresentazione pubblica (senza segreti).
 *
 * @param user - Riga del DB.
 * @returns L'utente pubblico.
 */
export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  username: user.username,
  avatar: user.avatar,
  hasPassword: user.passwordHash !== null,
  hasGoogle: user.googleId !== null,
});

/**
 * Ricava un nome utente valido dal profilo Google (nome visualizzato o parte locale dell'email).
 *
 * @param profile - Profilo Google.
 * @returns Un nome utente conforme a `UsernameSchema`.
 */
export const deriveUsername = (profile: Pick<GoogleProfile, 'email' | 'name'>): string => {
  const sanitize = (raw: string): string =>
    raw.replace(/[^\p{L}\p{N} _-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, USERNAME_MAX_LENGTH).trim();
  for (const candidate of [profile.name ?? '', profile.email.split('@')[0] ?? '']) {
    const cleaned = sanitize(candidate);
    if (UsernameSchema.safeParse(cleaned).success) return cleaned;
  }
  return FALLBACK_USERNAME;
};

/**
 * Crea il servizio di autenticazione.
 *
 * @param deps - Repository utenti e servizio token.
 * @returns L'{@link AuthService}.
 */
export const createAuthService = ({ users, tokens }: AuthServiceDeps): AuthService => {
  const respond = async (user: User): Promise<AuthResponse> => {
    const { token, expiresAt } = await tokens.issue(user.id);
    return { token, expiresAt: expiresAt.toISOString(), user: toPublicUser(user) };
  };

  return {
    async register({ email, username, password }) {
      if (users.findByEmail(email)) return err('EMAIL_TAKEN');
      const passwordHash = await hashPassword(password);
      try {
        return ok(await respond(users.insert({ email, username, passwordHash })));
      } catch (cause) {
        // Corsa tra due registrazioni concorrenti con la stessa email.
        if (isUniqueViolation(cause)) return err('EMAIL_TAKEN');
        throw cause;
      }
    },

    async login({ email, password }) {
      const user = users.findByEmail(email);
      if (!user?.passwordHash) {
        await burnPasswordVerification(password);
        return err('INVALID_CREDENTIALS');
      }
      if (!(await verifyPassword(user.passwordHash, password))) return err('INVALID_CREDENTIALS');
      return ok(await respond(user));
    },

    async loginWithGoogle(profile) {
      const linked = users.findByGoogleId(profile.sub);
      if (linked) return ok(await respond(linked));
      if (!profile.emailVerified) return err('GOOGLE_EMAIL_NOT_VERIFIED');

      const email = profile.email.trim().toLowerCase();
      const existing = users.findByEmail(email);
      if (existing) {
        if (existing.googleId !== null) return err('GOOGLE_ACCOUNT_CONFLICT');
        const updated = users.setGoogleId(existing.id, profile.sub) ?? existing;
        return ok(await respond(updated));
      }
      try {
        return ok(await respond(users.insert({ email, username: deriveUsername(profile), googleId: profile.sub })));
      } catch (cause) {
        if (isUniqueViolation(cause)) return err('GOOGLE_ACCOUNT_CONFLICT');
        throw cause;
      }
    },

    getProfile(userId) {
      const user = users.findById(userId);
      return user ? ok(toPublicUser(user)) : err('USER_NOT_FOUND');
    },
  };
};
