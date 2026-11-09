/**
 * @nature [UI]
 * @module Button
 * @description Pulsante del design system: varianti CTA (arancione), secondaria (azzurra) e ghost; stato di caricamento accessibile.
 * @relatedDocs docs/catalog/UI/01-login-page.md
 * @testFile apps/desktop-client/tests/components/ui/Button.test.tsx
 */
import type { ButtonHTMLAttributes } from 'react';

/** Varianti visive del pulsante. */
export type ButtonVariant = 'cta' | 'secondary' | 'ghost';

/** Props di {@link Button}. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  /** Mostra lo stato di attesa e disabilita il pulsante. */
  readonly loading?: boolean;
}

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  cta: 'bg-linear-to-b from-cta to-cta-deep text-white shadow-cta hover:brightness-110',
  secondary: 'bg-linear-to-b from-secondary-light to-secondary text-white hover:brightness-110',
  ghost: 'border border-line bg-transparent text-text hover:bg-panel',
};

/**
 * Pulsante standard dell'interfaccia.
 *
 * @param props - Props HTML del pulsante più `variant` e `loading`.
 * @returns L'elemento `<button>`.
 */
export const Button = ({ variant = 'cta', loading = false, disabled, className = '', type = 'button', children, ...rest }: ButtonProps) => (
  <button
    {...rest}
    type={type}
    disabled={disabled === true || loading}
    aria-busy={loading || undefined}
    className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 font-semibold tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
  >
    {loading ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
    {children}
  </button>
);
