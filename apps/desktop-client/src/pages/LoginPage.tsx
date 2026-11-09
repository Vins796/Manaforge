/**
 * @nature [UI]
 * @module LoginPage
 * @description Pagina `/login`: tab Accedi/Registrati con validazione lato client, accesso con Google e redirect a `/home`.
 * @relatedDocs docs/catalog/UI/01-login-page.md
 * @testFile apps/desktop-client/tests/pages/LoginPage.test.tsx
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { LoginRequestSchema, RegisterRequestSchema } from '@manaforge/shared';
import { Button } from '../components/ui/Button.js';
import { TextField } from '../components/ui/TextField.js';
import { useAuthStore } from '../store/use-auth-store.js';

/** Tab della pagina. */
export type LoginTab = 'login' | 'register';

type FieldErrors = Partial<Record<'email' | 'username' | 'password' | 'confirmPassword', string>>;

const FIELD_MESSAGES: Readonly<Record<string, string>> = {
  email: 'Inserisci un indirizzo email valido.',
  username: 'Da 3 a 24 caratteri: lettere, cifre, spazio, "_" o "-".',
  password: 'La password deve avere da 8 a 128 caratteri.',
};

const toFieldErrors = (issues: readonly { path: readonly PropertyKey[] }[]): FieldErrors => {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0]) as keyof FieldErrors;
    errors[field] ??= FIELD_MESSAGES[field] ?? 'Valore non valido.';
  }
  return errors;
};

/** Logo originale di Manaforge: cristallo esagonale su incudine stilizzata. */
const ForgeMark = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" className="size-16">
    <defs>
      <linearGradient id="mf-crystal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffb36b" />
        <stop offset="1" stopColor="#ea580c" />
      </linearGradient>
    </defs>
    <path d="M32 4 50 14v20L32 44 14 34V14Z" fill="url(#mf-crystal)" />
    <path d="M32 4v40M14 14l36 20M50 14 14 34" stroke="#0b0e14" strokeOpacity=".35" strokeWidth="1.5" fill="none" />
    <path d="M8 50h48l-6 6H14Z" fill="#c9a45c" />
  </svg>
);

/**
 * Schermata di autenticazione.
 *
 * @param props - Tab iniziale (default "Accedi").
 * @returns La pagina di login.
 */
export const LoginPage = ({ initialTab = 'login' }: { readonly initialTab?: LoginTab }) => {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const serverError = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const cancelGoogle = useAuthStore((s) => s.cancelGoogle);
  const clearError = useAuthStore((s) => s.clearError);

  const [tab, setTab] = useState<LoginTab>(initialTab);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (status === 'authenticated') void navigate('/home', { replace: true });
  }, [status, navigate]);

  const busy = status === 'authenticating' || status === 'awaiting-google';

  const switchTab = (next: LoginTab) => {
    setTab(next);
    setFieldErrors({});
    setPassword('');
    setConfirmPassword('');
    clearError();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (tab === 'login') {
      const parsed = LoginRequestSchema.safeParse({ email, password });
      if (!parsed.success) return setFieldErrors(toFieldErrors(parsed.error.issues));
      setFieldErrors({});
      await login(parsed.data);
      return;
    }
    const parsed = RegisterRequestSchema.safeParse({ email, username, password });
    const errors = parsed.success ? {} : toFieldErrors(parsed.error.issues);
    if (password !== confirmPassword) errors.confirmPassword = 'Le password non coincidono.';
    setFieldErrors(errors);
    if (parsed.success && Object.keys(errors).length === 0) await register(parsed.data);
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,#1c2230,#0b0e14_60%)] p-6">
      <section className="w-full max-w-md rounded-xl border border-line bg-panel/90 p-8 shadow-2xl" aria-labelledby="login-title">
        <header className="mb-6 flex flex-col items-center gap-2 text-center">
          <ForgeMark />
          <h1 id="login-title" className="font-display text-3xl tracking-[0.2em] text-text">
            MANAFORGE
          </h1>
        </header>

        <div role="tablist" aria-label="Modalità di accesso" className="mb-6 grid grid-cols-2 rounded-md border border-line p-1">
          {(
            [
              ['login', 'Accedi'],
              ['register', 'Registrati'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls="auth-panel"
              onClick={() => switchTab(id)}
              className={`rounded px-3 py-2 text-sm font-semibold transition ${tab === id ? 'bg-cta text-white' : 'text-text-muted hover:text-text'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form id="auth-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField label="Email" type="email" autoComplete="email" value={email} error={fieldErrors.email} onChange={(e) => setEmail(e.target.value)} />
          {tab === 'register' ? (
            <TextField label="Nome utente" autoComplete="username" value={username} error={fieldErrors.username} onChange={(e) => setUsername(e.target.value)} />
          ) : null}
          <TextField
            label="Password"
            type="password"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            value={password}
            error={fieldErrors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {tab === 'register' ? (
            <TextField
              label="Conferma password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              error={fieldErrors.confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          ) : null}

          {serverError ? (
            <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" loading={status === 'authenticating'} disabled={busy} className="mt-2">
            {tab === 'login' ? 'Accedi' : 'Crea account'}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-text-muted">
          <span className="h-px flex-1 bg-line" />
          oppure
          <span className="h-px flex-1 bg-line" />
        </div>

        {status === 'awaiting-google' ? (
          <div className="flex flex-col items-center gap-3 text-center" aria-live="polite">
            <p className="text-sm text-text-muted">Completa l&apos;accesso nella finestra del browser…</p>
            <Button variant="ghost" onClick={cancelGoogle}>
              Annulla
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void loginWithGoogle()}>
            Continua con Google
          </Button>
        )}
      </section>
    </main>
  );
};
