/**
 * @nature [UI]
 * @module TextField
 * @description Campo di testo etichettato con messaggio di errore collegato via `aria-describedby`.
 * @relatedDocs docs/catalog/UI/01-login-page.md
 * @testFile apps/desktop-client/tests/components/ui/TextField.test.tsx
 */
import { useId, type InputHTMLAttributes } from 'react';

/** Props di {@link TextField}. */
export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  readonly label: string;
  readonly error?: string | undefined;
}

/**
 * Campo di input con etichetta ed errore accessibili.
 *
 * @param props - Etichetta, errore opzionale e props HTML dell'input.
 * @returns Il gruppo etichetta + input + errore.
 */
export const TextField = ({ label, error, className = '', ...rest }: TextFieldProps) => {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-text-muted">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-md border bg-abyss px-3 py-2 text-text outline-none transition placeholder:text-text-muted/60 focus:border-cta ${error ? 'border-danger' : 'border-line'}`}
      />
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};
