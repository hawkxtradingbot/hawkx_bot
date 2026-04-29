-- ============================================================
-- HawkX V11 — DEVNET Schema
-- Upgraded from V10: mode flag, SAP PIN, watchlist,
-- session timeout, trade notes, rate limiting
-- ============================================================

PRAGMA journal_mode=WAL;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id                 INTEGER PRIMARY KEY,
  username                TEXT,
  language                TEXT    DEFAULT 'en',
  rank                    INTEGER DEFAULT 1,
  cumulative_volume_sol   REAL    DEFAULT 0,
  join_date               TEXT    DEFAULT (datetime('now')),
  trial_active            INTEGER DEFAULT 1,
  trial_end_date          TEXT    DEFAULT (datetime('now', '+7 days')),
  referrer_id             INTEGER,
  joiner_discount         INTEGER DEFAULT 0,
  active_wallet_id        INTEGER,
  created_at              TEXT    DEFAULT (datetime('now')),

  -- V11 #01: Beginner / Pro mode toggle
  mode                    TEXT    DEFAULT 'beginner',

  -- V11 #02: SAP — Secure Action Password (bcrypt hash, never plain)
  sap_hash                TEXT    DEFAULT NULL,
  sap_enabled             INTEGER DEFAULT 0,

  -- V11 #26: Session timeout (seconds, 0 = OFF)
  session_timeout_sec     INTEGER DEFAULT 14400,
  last_active_at          TEXT    DEFAULT (datetime('now')),

  -- V11 #29: Rate limiting
  trade_count_minute      INTEGER DEFAULT 0,
  trade_window_start      TEXT    DEFAULT (datetime('now'))
);

-- ── WALLETS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  wallet_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL,
  public_key          TEXT    NOT NULL,
  encrypted_private_key TEXT  NOT NULL,
  encryption_salt     TEXT    NOT NULL,
  encryption_iv       TEXT    NOT NULL,
  encryption_tag      TEXT    NOT NULL,
  label               TEXT    DEFAULT 'Wallet',
  created_at          TEXT    DEFAULT (datetime('now'))
);

-- V11 #27: Withdrawal whitelist
CREATE TABLE IF NOT EXISTS withdrawal_whitelist (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  address         TEXT    NOT NULL,
  label           TEXT    DEFAULT '',
  added_at        TEXT    DEFAULT (datetime('now'))
);

-- ── TRADES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  trade_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  wallet_id         INTEGER,
  token_ca          TEXT    NOT NULL,
  token_name        TEXT,
  platform          TEXT,
  action            TEXT    NOT NULL,
  sol_amount        REAL    NOT NULL,
  token_amount      REAL,
  price_sol         REAL,
  fee_sol           REAL,
  fee_rate          REAL,
  priority_fee_sol  REAL    DEFAULT 0,
  tx_hash           TEXT,
  status            TEXT    DEFAULT 'pending',
  timestamp         TEXT    DEFAULT (datetime('now'))
);

-- ── POSITIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS positions (
  position_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  wallet_id         INTEGER,
  token_ca          TEXT    NOT NULL,
  token_name        TEXT,
  buy_price         REAL    NOT NULL,
  sol_invested      REAL    NOT NULL,
  token_amount      REAL    NOT NULL,
  platform          TEXT,
  opened_at         TEXT    DEFAULT (datetime('now')),
  stop_loss_pct     REAL    DEFAULT -30,
  take_profit_pct   REAL    DEFAULT 150,
  status            TEXT    DEFAULT 'open',

  -- V11 #24: Trade journal note
  note              TEXT    DEFAULT NULL
);

-- ── REFERRALS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_chain (
  chain_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  level             INTEGER NOT NULL,
  referral_user_id  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_earnings (
  earning_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  from_user_id  INTEGER,
  level         INTEGER,
  fee_sol       REAL,
  earned_sol    REAL,
  trade_id      INTEGER,
  paid          INTEGER DEFAULT 0,
  created_at    TEXT    DEFAULT (datetime('now'))
);

-- V11 #39: Referral milestone tracking
CREATE TABLE IF NOT EXISTS referral_milestones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  milestone       INTEGER NOT NULL,  -- 5, 25, 100
  reward_sol      REAL    NOT NULL,
  paid            INTEGER DEFAULT 0,
  paid_at         TEXT    DEFAULT NULL,
  created_at      TEXT    DEFAULT (datetime('now'))
);

-- ── SETTINGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  user_id                 INTEGER PRIMARY KEY,
  auto_buy                INTEGER DEFAULT 1,
  slippage_pct            REAL    DEFAULT 10,
  max_buy_sol             REAL    DEFAULT 0.1,
  min_liquidity_sol       REAL    DEFAULT 0,
  min_mcap_sol            REAL    DEFAULT 0,
  max_mcap_sol            REAL    DEFAULT 999999999,
  trailing_stop_pct       REAL    DEFAULT 20,
  take_profit_pct         REAL    DEFAULT 150,
  stop_loss_pct           REAL    DEFAULT -30,
  speed_mode              TEXT    DEFAULT 'standard',
  priority_fee_manual_sol REAL    DEFAULT 0.01,
  notifications_enabled   TEXT    DEFAULT '{"all":true}',
  auto_sell    INTEGER DEFAULT 0,
  mev_protect  INTEGER DEFAULT 1,
  fomo_threshold_pct      REAL    DEFAULT 300,

  -- V11 #18: Weekly PnL summary toggle
  weekly_summary          INTEGER DEFAULT 1,

  -- V11 #38: Daily challenge toggle
  daily_challenge         INTEGER DEFAULT 1
);

-- ── SYSTEM CONFIG ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO system_config VALUES ('kill_switch_active', '0');
INSERT OR IGNORE INTO system_config VALUES ('rpc_primary',        'devnet');
INSERT OR IGNORE INTO system_config VALUES ('grpc_status',        'devnet_mock');
INSERT OR IGNORE INTO system_config VALUES ('devnet_mode',        '1');
INSERT OR IGNORE INTO system_config VALUES ('bot_version',        'V11');

-- ── BLACKLISTS ───────────────────────────────────────────────
-- NOTE: rug check removed in V11 — deployer blacklist kept for manual admin use
CREATE TABLE IF NOT EXISTS global_blacklist (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  deployer_address TEXT NOT NULL,
  added_by_admin   INTEGER,
  reason           TEXT,
  added_at         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_blacklist (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER,
  address   TEXT,
  type      TEXT,
  added_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_whitelist (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER,
  wallet_address TEXT,
  label          TEXT,
  added_at       TEXT DEFAULT (datetime('now'))
);

-- ── MOCK TRADES (devnet only) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS mock_trades (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER,
  token_ca    TEXT,
  token_name  TEXT,
  action      TEXT,
  sol_amount  REAL,
  mock_price  REAL,
  timestamp   TEXT DEFAULT (datetime('now'))
);

-- ── V11 WATCHLIST (#21) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  token_ca    TEXT    NOT NULL,
  token_name  TEXT,
  added_price REAL    DEFAULT 0,
  alert_pct   REAL    DEFAULT 20,   -- alert when price moves +/- this %
  added_at    TEXT    DEFAULT (datetime('now'))
);

-- ── V11 DAILY CHALLENGE (#38) ────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_challenges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  challenge_date TEXT   NOT NULL,
  trades_done   INTEGER DEFAULT 0,
  target        INTEGER DEFAULT 3,
  completed     INTEGER DEFAULT 0,
  reward_sol    REAL    DEFAULT 0.01,
  paid          INTEGER DEFAULT 0
);

-- ── V11 SUSPICIOUS ACTIVITY LOG (#30) ────────────────────────
CREATE TABLE IF NOT EXISTS suspicious_activity (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  reason      TEXT    NOT NULL,
  detail      TEXT,
  flagged_at  TEXT    DEFAULT (datetime('now')),
  cleared     INTEGER DEFAULT 0,
  cleared_by  INTEGER DEFAULT NULL
);
