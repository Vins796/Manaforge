# 05 — Backend Schema (SQLite, stato in-memory, permessi)

## 1. Database SQLite (`<userData>/manaforge.db`)

Convenzioni: chiavi primarie `TEXT` UUID v7 (ordinabili), timestamp `INTEGER` epoch ms UTC, `STRICT` tables,
`foreign_keys=ON`, `ON DELETE CASCADE` dal profilo verso i suoi dati.

```sql
CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  applied_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE profiles (
  id                 TEXT PRIMARY KEY,
  display_name       TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(display_name) BETWEEN 3 AND 24),
  password_hash      BLOB NOT NULL,          -- scrypt 64 byte
  password_salt      BLOB NOT NULL,          -- 16 byte
  kdf_params         TEXT NOT NULL,          -- JSON {N,r,p,keylen}
  public_key         BLOB NOT NULL,          -- Ed25519 raw 32 byte
  private_key_enc    BLOB NOT NULL,          -- AES-256-GCM(ciphertext‖tag)
  private_key_iv     BLOB NOT NULL,          -- 12 byte
  private_key_salt   BLOB NOT NULL,          -- 16 byte (KDF chiave di cifratura)
  failed_attempts    INTEGER NOT NULL DEFAULT 0,
  locked_until       INTEGER,
  created_at         INTEGER NOT NULL,
  last_login_at      INTEGER
) STRICT;

CREATE TABLE collection_cards (
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_code   TEXT NOT NULL,                 -- es. "FRG-042"
  quantity    INTEGER NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (profile_id, card_code)
) STRICT;

CREATE TABLE decks (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  format      TEXT NOT NULL DEFAULT 'standard',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (profile_id, name)
) STRICT;

CREATE TABLE deck_cards (
  deck_id    TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  card_code  TEXT NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (deck_id, card_code)
) STRICT;

CREATE TABLE matches (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL CHECK (mode IN ('bot','p2p')),
  opponent_name   TEXT NOT NULL,
  opponent_key    BLOB,                      -- chiave pubblica avversario (p2p)
  deck_id         TEXT REFERENCES decks(id) ON DELETE SET NULL,
  result          TEXT CHECK (result IN ('win','loss','draw','aborted','desync')),
  started_at      INTEGER NOT NULL,
  ended_at        INTEGER,
  protocol_ver    INTEGER NOT NULL,
  cardset_hash    TEXT NOT NULL
) STRICT;

CREATE TABLE match_replays (
  match_id     TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  seed         BLOB NOT NULL,                -- 16 byte
  actions      BLOB NOT NULL,                -- JSON compresso (gzip) della lista azioni
  final_hash   TEXT NOT NULL
) STRICT;

CREATE TABLE rewards (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('pack')),
  opened      INTEGER NOT NULL DEFAULT 0 CHECK (opened IN (0,1)),
  created_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE settings (
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,                 -- JSON validato da Zod
  PRIMARY KEY (profile_id, key)
) STRICT;

CREATE INDEX idx_matches_profile ON matches(profile_id, started_at DESC);
CREATE INDEX idx_decks_profile   ON decks(profile_id);
```

Le definizioni delle carte **non** stanno nel DB: sono dati versionati in `packages/cards` (hash del set = `cardset_hash`).

## 2. Stato in-memory (processo main)

```ts
interface MainRuntimeState {
  session: { profileId: string; privateKey: KeyObject; startedAt: number } | null;
  match: {
    id: string;
    mode: 'bot' | 'p2p';
    engineState: GameState;          // packages/engine
    actionLog: SignedAction[];       // sorgente di verità per replay/lockstep
    peer?: { publicKey: Uint8Array; seq: number; lastSeenAt: number };
    bot?: { level: 'apprentice' | 'adept' | 'master' };
  } | null;
}
```

- La chiave privata decifrata esiste **solo** in memoria durante la sessione; azzerata al logout.
- Il renderer riceve **viste filtrate** dello stato (`PlayerView`): mai la mano o il mazzo avversario.

## 3. Permessi e confini di fiducia

| Attore | Può | Non può |
|---|---|---|
| Renderer | invocare canali IPC whitelisted, ricevere `PlayerView` ed eventi | accedere a FS/DB/chiavi, leggere stato completo |
| Preload | esporre `window.manaforge` tipizzato | contenere logica di dominio |
| Main | DB, crittografia, engine autorevole, firma messaggi | eseguire codice remoto |
| Peer remoto | inviare azioni firmate validate | modificare lo stato direttamente, vedere informazioni nascoste |

Ogni canale IPC richiede (salvo `auth:*`) una **sessione attiva**; il main verifica che l'azione di gioco provenga
dal giocatore che ha priorità. I canali sono definiti in `packages/shared/src/ipc` e documentati in `docs/catalog/api/`.
