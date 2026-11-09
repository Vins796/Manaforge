/**
 * @nature [UI]
 * @module HomeHub
 * @description Pagina `/home`: barra di navigazione comune e benvenuto con accesso rapido a Mazzi e Collezione. Il Play Blade arriva nella Fase 4.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/pages/HomeHub.test.tsx
 */
import { Link } from 'react-router';
import { TopNav } from '../components/ui/TopNav.js';
import { useAuthStore } from '../store/use-auth-store.js';

/**
 * Hub principale dopo l'accesso.
 *
 * @returns La pagina Home.
 */
export const HomeHub = () => {
  const user = useAuthStore((s) => s.user);
  return (
    <main className="flex min-h-full flex-col bg-abyss">
      <TopNav />
      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-4xl">Benvenuto, {user?.username}</h1>
        <p className="text-text-muted">La forgia è accesa: costruisci il tuo mazzo. Le partite arriveranno presto.</p>
        <div className="flex gap-3">
          <Link to="/decks" className="rounded-md bg-linear-to-b from-cta to-cta-deep px-5 py-2.5 font-semibold text-white shadow-cta hover:brightness-110">
            I miei mazzi
          </Link>
          <Link to="/collection" className="rounded-md border border-line px-5 py-2.5 font-semibold hover:bg-panel">
            Collezione
          </Link>
        </div>
      </section>
    </main>
  );
};
