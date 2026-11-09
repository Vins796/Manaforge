/**
 * @nature [ARCH]
 * @module Result
 * @description Tipo discriminato `Result<T, E>` per gli errori di dominio attesi, alternativo a `throw`.
 * @relatedDocs docs/catalog/ARCH/01-monorepo-setup.md
 * @testFile packages/shared/tests/types/result.test.ts
 */

/**
 * Esito di un'operazione che può fallire in modo previsto.
 *
 * @typeParam T - Tipo del valore in caso di successo.
 * @typeParam E - Tipo dell'errore in caso di fallimento.
 */
export type Result<T, E> = Ok<T> | Err<E>;

/** Ramo di successo di {@link Result}. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** Ramo di fallimento di {@link Result}. */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Costruisce un {@link Ok} congelato.
 *
 * @param value - Valore di successo.
 * @returns Un `Result` di successo.
 */
export const ok = <T>(value: T): Ok<T> => Object.freeze({ ok: true, value });

/**
 * Costruisce un {@link Err} congelato.
 *
 * @param error - Descrizione strutturata dell'errore.
 * @returns Un `Result` di fallimento.
 */
export const err = <E>(error: E): Err<E> => Object.freeze({ ok: false, error });

/**
 * Trasforma il valore se il risultato è `Ok`, altrimenti propaga l'errore.
 *
 * @param result - Risultato di partenza.
 * @param fn - Trasformazione del valore di successo.
 * @returns Nuovo `Result` trasformato.
 */
export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

/**
 * Concatena un'operazione che può fallire; cortocircuita sul primo errore.
 *
 * @param result - Risultato di partenza.
 * @param fn - Operazione successiva che restituisce un `Result`.
 * @returns Il risultato di `fn`, oppure l'errore originale.
 */
export const andThen = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> => (result.ok ? fn(result.value) : result);

/**
 * Estrae il valore o lancia: solo per test o invarianti.
 *
 * @param result - Risultato da estrarre.
 * @returns Il valore di successo.
 * @throws Error se `result` è un `Err`.
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.ok) return result.value;
  throw new Error(`unwrap() chiamato su Err: ${JSON.stringify(result.error)}`);
};
