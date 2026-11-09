/**
 * @nature [UI]
 * @module HomeHub
 * @description Pagina `/home` minima dello step 1.3: benvenuto e logout. Play Blade, mazzi e collezione arrivano nella Fase 2.
 * @relatedDocs docs/catalog/UI/01-login-page.md
 * @testFile apps/desktop-client/tests/pages/HomeHub.test.tsx
 */
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/Button.js';
import { useAuthStore } from '../store/use-auth-store.js';

/**
 * Hub principale dopo l'accesso.
 *
 * @returns La pagina Home.
 */
export const HomeHub = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const onLogout = () => {
    logout();
    void navigate('/login', { replace: true });
  };

  return (
    <main className="flex min-h-full flex-col bg-abyss">
      <nav className="flex items-center justify-between border-b border-line bg-panel px-6 py-3" aria-label="Navigazione principale">
        <span className="font-display text-xl tracking-[0.2em]">MANAFORGE</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-muted">{user?.username}</span>
          <Button variant="ghost" onClick={onLogout}>
            Esci
          </Button>
        </div>
      </nav>
      <section className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="font-display text-4xl">Benvenuto, {user?.username}</h1>
        <p className="text-text-muted">La forgia è accesa. Mazzi e partite arriveranno presto.</p>
      </section>
    </main>
  );
};
