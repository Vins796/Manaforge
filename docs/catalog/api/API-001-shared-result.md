# API-001 — `Result<T,E>` e costanti condivise

- **Package:** `@manaforge/shared` · **Step:** 1.1 · **Versione:** 0.1.0

## Firme
| Simbolo | Firma | Note |
|---|---|---|
| `Result<T,E>` | `Ok<T> \| Err<E>` | discriminato su `ok` |
| `ok` | `<T>(value: T) => Ok<T>` | oggetto congelato |
| `err` | `<E>(error: E) => Err<E>` | oggetto congelato |
| `mapResult` | `(r: Result<T,E>, fn: (T) => U) => Result<U,E>` | |
| `andThen` | `(r: Result<T,E>, fn: (T) => Result<U,F>) => Result<U,E\|F>` | cortocircuita su `Err` |
| `unwrap` | `(r: Result<T,E>) => T` | lancia `Error` su `Err`; solo test/invarianti |
| `APP_NAME` | `'Manaforge'` | |
| `PROTOCOL_VERSION` | `1` | handshake P2P (RF-44) |
| `STARTING_LIFE` | `20` | |
| `OPENING_HAND_SIZE` | `7` | |

## Codice e test
`packages/shared/src/result.ts`, `packages/shared/src/constants.ts` — `packages/shared/test/result.test.ts`, `packages/shared/test/smoke.test.ts`.
