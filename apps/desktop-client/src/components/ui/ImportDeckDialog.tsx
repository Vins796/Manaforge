/**
 * @nature [UI]
 * @module ImportDeckDialog
 * @description Finestra modale "Importa dagli Appunti": precompila il testo dagli appunti (se consentito), lo importa e mostra gli errori per riga.
 * @relatedDocs docs/catalog/UI/01-deckbuilder.md
 * @testFile apps/desktop-client/tests/components/ui/ImportDeckDialog.test.tsx
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { DECK_LIST_MAX_LENGTH, type DeckListIssue, type DeckListIssueCode } from '@manaforge/shared';
import { Button } from './Button.js';

const ISSUE_LABELS: Readonly<Record<DeckListIssueCode, string>> = {
  TOO_LONG: 'Testo troppo lungo',
  INVALID_LINE: 'Riga non riconosciuta',
  INVALID_QUANTITY: 'Quantità non valida (1–99)',
  UNKNOWN_CARD: 'Carta sconosciuta',
};

/** Props di {@link ImportDeckDialog}. */
export interface ImportDeckDialogProps {
  /** Importa il testo; restituisce i problemi (vuoto = riuscito, la finestra si chiude). */
  readonly onImport: (text: string) => Promise<readonly DeckListIssue[]>;
  readonly onClose: () => void;
  /** Lettura degli appunti; default `navigator.clipboard.readText`. */
  readonly readClipboard?: () => Promise<string>;
}

const defaultReadClipboard = (): Promise<string> =>
  navigator.clipboard?.readText ? navigator.clipboard.readText() : Promise.reject(new Error('Appunti non disponibili'));

/**
 * Dialogo di import di una lista mazzo testuale.
 *
 * @param props - Callback di import e chiusura, lettore degli appunti.
 * @returns Il dialogo modale.
 */
export const ImportDeckDialog = ({ onImport, onClose, readClipboard = defaultReadClipboard }: ImportDeckDialogProps) => {
  const titleId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [issues, setIssues] = useState<readonly DeckListIssue[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    textRef.current?.focus();
    let active = true;
    readClipboard()
      .then((clip) => {
        if (active && clip.trim() !== '') setText((current) => (current === '' ? clip.slice(0, DECK_LIST_MAX_LENGTH) : current));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [readClipboard]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await onImport(text);
    setBusy(false);
    if (result.length === 0) onClose();
    else setIssues(result);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(event) => void onSubmit(event)}
        className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-line bg-panel p-6 shadow-2xl"
      >
        <h2 id={titleId} className="font-display text-2xl">
          Importa lista mazzo
        </h2>
        <p className="text-sm text-text-muted">
          Una carta per riga (<code>4 Scintilla Rovente</code>); usa le righe <code>Mazzo</code> e <code>Riserva</code> per le sezioni.
          L'import sostituisce le carte del mazzo in modifica.
        </p>
        <textarea
          ref={textRef}
          aria-label="Lista mazzo"
          rows={12}
          maxLength={DECK_LIST_MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="rounded-md border border-line bg-abyss p-3 font-mono text-sm text-text outline-none focus:border-cta"
        />
        {issues.length > 0 ? (
          <ul role="alert" className="max-h-32 overflow-auto rounded-md border border-danger/50 bg-danger/10 p-3 text-sm text-danger">
            {issues.map((issue, index) => (
              <li key={`${issue.line}-${index}`}>
                {issue.line > 0 ? `Riga ${issue.line}: ` : ''}
                {ISSUE_LABELS[issue.code]} — {issue.text}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" variant="secondary" loading={busy} disabled={text.trim() === ''}>
            Importa
          </Button>
        </div>
      </form>
    </div>
  );
};
