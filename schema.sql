-- HawkX V10 Devnet Schema
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  username TEXT,
  language TEXT DEFAULT 'en',
  rank INTEGER DEFAULT 1,
  cumulative_volume_sol REAL DEFAULT 0,
  join_date TEXT DEFAULT (datetime('now')),
  trial_active INTEGER DEFAULT 1,
  trial_end_date TEXT DEFAULT (datetime('now', '+7 days')),
  referrer_id INTEGER,
  joiner_discount INTEGER DEFAULT 0,
  active_wallet_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallets (
  wallet_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  encryption_salt TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  label TEXT DEFAULT 'Wallet',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trades (
  trade_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  wallet_id INTEGER,
  token_ca TEXT NOT NULL,
  token_name TEXT,
  platform TEXT,
  action TEXT NOT NULL,
  sol_amount REAL NOT NULL,
  token_amount REAL,
  price_sol REAL,
  fee_sol REAL,
  fee_rate REAL,
  priority_fee_sol REAL DEFAULT 0,
  tx_hash TEXT,
  status TEXT DEFAULT 'pending',
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS positions (
  position_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  wallet_id INTEGER,
  token_ca TEXT NOT NULL,
  token_name TEXT,
  buy_price REAL NOT NULL,
  sol_invested REAL NOT NULL,
  token_amount REAL NOT NULL,
  platform TEXT,
  opened_at TEXT DEFAULT (datetime('now')),
  stop_loss_pct REAL DEFAULT -30,
  take_profit_pct REAL DEFAULT 150,
  status TEXT DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS referral_chain (
  chain_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  level INTEGER NOT NULL,
  referral_user_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_earnings (
  earning_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  from_user_id INTEGER,
  level INTEGER,
  fee_sol REAL,
  earned_sol REAL,
  trade_id INTEGER,
  paid INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY,
  auto_buy INTEGER DEFAULT 1,
  slippage_pct REAL DEFAULT 10,
  max_buy_sol REAL DEFAULT 0.1,
  min_liquidity_sol REAL DEFAULT 0,
  min_mcap_sol REAL DEFAULT 0,
  max_mcap_sol REAL DEFAULT 999999999,
  trailing_stop_pct REAL DEFAULT 20,
  take_profit_pct REAL DEFAULT 150,
  stop_loss_pct REAL DEFAULT -30,
  speed_mode TEXT DEFAULT 'standard',
  priority_fee_manual_sol REAL DEFAULT 0.01,
  notifications_enabled TEXT DEFAULT '{"all":true}',
  fomo_threshold_pct REAL DEFAULT 300
);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO system_config VALUES ('kill_switch_active', '0');
INSERT OR IGNORE INTO system_config VALUES ('rpc_primary', 'devnet');
INSERT OR IGNORE INTO system_config VALUES ('grpc_status', 'devnet_mock');
INSERT OR IGNORE INTO system_config VALUES ('devnet_mode', '1');

CREATE TABLE IF NOT EXISTS global_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deployer_address TEXT NOT NULL,
  added_by_admin INTEGER,
  reason TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  address TEXT,
  type TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  wallet_address TEXT,
  label TEXT,
  added_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mock_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  token_ca TEXT,
  token_name TEXT,
  action TEXT,
  sol_amount REAL,
  mock_price REAL,
  timestamp TEXT DEFAULT (datetime('now'))
);