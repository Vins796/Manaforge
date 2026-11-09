import { describe, expect, it } from 'vitest';
import { andThen, err, mapResult, ok, unwrap, type Result } from '../src/index.js';

const parsePositive = (n: number): Result<number, 'NOT_POSITIVE'> =>
  n > 0 ? ok(n) : err('NOT_POSITIVE');

describe('Result', () => {
  it('ok/err costruiscono rami discriminati e immutabili', () => {
    const a = ok(1);
    const b = err('X');
    expect(a).toEqual({ ok: true, value: 1 });
    expect(b).toEqual({ ok: false, error: 'X' });
    expect(Object.isFrozen(a)).toBe(true);
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
