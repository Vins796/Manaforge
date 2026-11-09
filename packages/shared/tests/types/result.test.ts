/**
 * @nature [TEST]
 * @module ResultTest
 * @description Verifica costruttori e combinatori di `Result<T, E>`.
 * @relatedDocs docs/catalog/TEST/01-test-runner.md
 * @testFile packages/shared/tests/types/result.test.ts
 */
import { describe, expect, it } from 'vitest';
import { andThen, err, mapResult, ok, unwrap, type Result } from '../../src/types/result.js';

const parsePositive = (n: number): Result<number, 'NOT_POSITIVE'> =>
  n > 0 ? ok(n) : err('NOT_POSITIVE');

describe('Result', () => {
  it('ok/err costruiscono rami discriminati e immutabili', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('X')).toEqual({ ok: false, error: 'X' });
    expect(Object.isFrozen(ok(1))).toBe(true);
  });

  it('mapResult trasforma solo i successi', () => {
    expect(mapResult(ok(2), (n) => n * 3)).toEqual(ok(6));
    expect(mapResult(err('E') as Result<number, string>, (n) => n * 3)).toEqual(err('E'));
  });

  it('andThen concatena e cortocircuita sul primo errore', () => {
    expect(andThen(ok(5), parsePositive)).toEqual(ok(5));
    expect(andThen(ok(-1), parsePositive)).toEqual(err('NOT_POSITIVE'));
    expect(andThen(err('PREV') as Result<number, 'PREV'>, parsePositive)).toEqual(err('PREV'));
  });

  it('unwrap restituisce il valore o lancia su Err', () => {
    expect(unwrap(ok('v'))).toBe('v');
    expect(() => unwrap(err({ code: 'BOOM' }))).toThrow(/BOOM/);
  });
});
