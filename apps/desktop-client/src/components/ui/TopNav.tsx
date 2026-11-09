/**
 * @nature [UI]
 * @module TopNav
 * @description Barra superiore comune (App Flow §2): logo, navigazione Home / Mazzi / Collezione, nome utente e logout.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/TopNav.test.tsx
 */
import { NavLink, useNavigate } from 'react-router';
import { useAuthStore } from '../../store/use-auth-store.js';
import { Button } from './Button.js';

const LINKS = [
  { to: '/home', label: 'Home' },
  { to: '/decks', label: 'Mazzi' },
  { to: '/collection', label: 'Collezione' },
] as const;

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold tracking-wide transition focus-visible:outline-2 focus-visible:outline-cta ${
    isActive ? 'bg-cta/15 text-cta' : 'text-text-muted hover:text-text'
  }`;

/**
 * Barra di navigazione principale.
 *
 * @returns L'elemento `<nav>`.
 */
export const TopNav = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const onLogout = () => {
    logout();
    void navigate('/login', { replace: true });
  };

  return (
    <nav className="flex items-center justify-between gap-4 border-b border-line bg-panel px-6 py-3" aria-label="Navigazione principale">
      <div className="flex items-center gap-6">
        <span className="font-display text-xl tracking-[0.2em]">MANAFORGE</span>
        <ul className="flex gap-1">
          {LINKS.map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} className={linkClass}>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-text-muted">{user?.username}</span>
        <Button variant="ghost" onClick={onLogout}>
          Esci
        </Button>
      </div>
    </nav>
  );
};
