/**
 * Tipo discriminato per errori di dominio attesi, alternativo a `throw`.
 *
 * @remarks
 * Convenzione di progetto (AGENT_RULES §2): le funzioni di dominio restituiscono `Result`
 * per i fallimenti previsti (input non valido, azione illegale, credenziali errate);
 * `throw` è riservato a violazioni di invarianti / errori di programmazione.
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
 * Costruisce un {@link Ok}.
 *
 * @param value - Valore di successo.
 * @returns Un `Result` di successo congelato.
 * @example
 * ```ts
 * const r = ok(42); // { ok: true, value: 42 }
 * ```
 */
export const ok = <T>(value: T): Ok<T> => Object.freeze({ ok: true, value });

/**
 * Costruisce un {@link Err}.
 *
 * @param error - Descrizione strutturata dell'errore.
 * @returns Un `Result` di fallimento congelato.
 */
export const err = <E>(error: E): Err<E> => Object.freeze({ ok: false, error });

/**
 * Applica `fn` al valore se il risultato è `Ok`, altrimenti propaga l'errore.
 *
 * @param result - Risultato di partenza.
 * @param fn - Trasformazione del valore di successo.
 * @returns Nuovo `Result` trasformato.
 */
export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

/**
 * Concatena un'operazione che può fallire (bind monadico).
 *
 * @param result - Risultato di partenza.
 * @param fn - Operazione successiva che restituisce a sua volta un `Result`.
 * @returns Il risultato di `fn`, oppure l'errore originale.
 */
export const andThen = <T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>,
): Result<U, E | F> => (result.ok ? fn(result.value) : result);

/**
 * Estrae il valore o lancia un'eccezione: da usare **solo** nei test o dove il fallimento
 * indica un errore di programmazione.
 *
 * @param result - Risultato da estrarre.
 * @returns Il valore di successo.
 * @throws Error se `result` è un `Err`.
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.ok) return result.value;
  throw new Error(`unwrap() chiamato su Err: ${JSON.stringify(result.error)}`);
};
