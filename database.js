// database.js V12 — Complete with all new functions
const Database = require("better-sqlite3");
const fs   = require("fs");
const path = require("path");
const config = require("./config");

let db;

function getDb() {
  if (!db) {
    db = new Database(config.DB_PATH);
    db.pragma("journal_mode = WAL");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    db.exec(schema);
    runMigrations(db);
    console.log("[DB] SQLite WAL ready:", config.DB_PATH);
  }
  return db;
}

function runMigrations(d) {
  const migrations = [
    "ALTER TABLE users ADD COLUMN referral_code TEXT",
    "ALTER TABLE users ADD COLUMN custom_code TEXT",
    "ALTER TABLE positions ADD COLUMN source TEXT DEFAULT 'manual'",
    "ALTER TABLE positions ADD COLUMN source_ref TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN promoter_status INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN auto_sell INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN mev_protect INTEGER DEFAULT 1",
    "ALTER TABLE settings ADD COLUMN speed_mode TEXT DEFAULT 'standard'",
    "ALTER TABLE settings ADD COLUMN sell_slippage_pct REAL DEFAULT 10",
    "ALTER TABLE settings ADD COLUMN confirm_trades INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN weekly_summary INTEGER DEFAULT 1",
    "ALTER TABLE settings ADD COLUMN jito_tip REAL DEFAULT 0.001",
    "ALTER TABLE settings ADD COLUMN buy_amt_1 REAL DEFAULT 0.1",
    "ALTER TABLE settings ADD COLUMN buy_amt_2 REAL DEFAULT 0.5",
    "ALTER TABLE settings ADD COLUMN buy_amt_3 REAL DEFAULT 1.0",
    "ALTER TABLE settings ADD COLUMN sell_pct_1 REAL DEFAULT 25",
    "ALTER TABLE settings ADD COLUMN sell_pct_2 REAL DEFAULT 50",
    "ALTER TABLE settings ADD COLUMN sell_pct_3 REAL DEFAULT 100",
    "ALTER TABLE settings ADD COLUMN max_open_positions INTEGER DEFAULT 10",
    "ALTER TABLE settings ADD COLUMN daily_loss_limit REAL DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN daily_trade_limit INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN sniper_rt_enabled INTEGER DEFAULT 0",
      "ALTER TABLE settings ADD COLUMN sniper_rt_launchlab INTEGER DEFAULT 0",
      "ALTER TABLE settings ADD COLUMN sniper_rt_jito REAL DEFAULT 0.005",
    "ALTER TABLE settings ADD COLUMN sniper_rt_amount REAL DEFAULT 0.1",
    "ALTER TABLE settings ADD COLUMN sniper_rt_slippage REAL DEFAULT 50",
    "ALTER TABLE settings ADD COLUMN sniper_rt_fee REAL DEFAULT 0.003",
    "ALTER TABLE settings ADD COLUMN sniper_rt_mev INTEGER DEFAULT 1",
    "ALTER TABLE settings ADD COLUMN sniper_rt_raydium INTEGER DEFAULT 1",
    "ALTER TABLE settings ADD COLUMN sniper_rt_migrating INTEGER DEFAULT 1",
    "ALTER TABLE copy_wallets ADD COLUMN wallet_id INTEGER DEFAULT NULL",
    "ALTER TABLE copy_wallets ADD COLUMN slippage REAL DEFAULT 50",
    "ALTER TABLE copy_wallets ADD COLUMN gas_fee REAL DEFAULT 0.005",
    "ALTER TABLE copy_wallets ADD COLUMN copy_sell INTEGER DEFAULT 1",
    "ALTER TABLE settings ADD COLUMN auto_buy_enabled INTEGER DEFAULT 0",
      "ALTER TABLE settings ADD COLUMN auto_buy_sol REAL DEFAULT 0.1",
      "ALTER TABLE settings ADD COLUMN auto_buy_slippage REAL DEFAULT 10",
      "ALTER TABLE settings ADD COLUMN auto_buy_gas REAL DEFAULT 0.005",
      "ALTER TABLE settings ADD COLUMN auto_buy_mev INTEGER DEFAULT 1",
      "ALTER TABLE settings ADD COLUMN auto_buy_max INTEGER DEFAULT 1",
      "ALTER TABLE copy_wallets ADD COLUMN auto_sell_enabled INTEGER DEFAULT 0",
      "ALTER TABLE copy_wallets ADD COLUMN auto_sell_template_id INTEGER DEFAULT NULL",
      "ALTER TABLE copy_channels ADD COLUMN auto_sell_enabled INTEGER DEFAULT 0",
      "ALTER TABLE copy_channels ADD COLUMN auto_sell_template_id INTEGER DEFAULT NULL",
      "ALTER TABLE sniper_configs ADD COLUMN auto_sell_enabled INTEGER DEFAULT 0",
      "ALTER TABLE copy_wallets ADD COLUMN min_sol REAL DEFAULT 0",
      "ALTER TABLE copy_wallets ADD COLUMN copy_pct REAL DEFAULT 100",
      "ALTER TABLE copy_wallets ADD COLUMN delay_seconds INTEGER DEFAULT 0",
      "ALTER TABLE copy_wallets ADD COLUMN slippage REAL DEFAULT 50",
      "ALTER TABLE copy_wallets ADD COLUMN gas_fee REAL DEFAULT 0.005",
      "ALTER TABLE copy_wallets ADD COLUMN mev_protection INTEGER DEFAULT 1",
      "ALTER TABLE copy_wallets ADD COLUMN copy_sell INTEGER DEFAULT 1",
      "ALTER TABLE copy_wallets ADD COLUMN trades_executed INTEGER DEFAULT 0",
      "ALTER TABLE snipes ADD COLUMN label TEXT DEFAULT NULL",
      "ALTER TABLE snipes ADD COLUMN gas REAL DEFAULT 0.005",
      "ALTER TABLE snipes ADD COLUMN mev INTEGER DEFAULT 0",
      "ALTER TABLE sniper_configs ADD COLUMN auto_sell_template_id INTEGER DEFAULT NULL",
      "ALTER TABLE snipes ADD COLUMN auto_sell_template_id INTEGER DEFAULT NULL",
      "ALTER TABLE settings ADD COLUMN lb_display_name TEXT DEFAULT NULL",
      "ALTER TABLE settings ADD COLUMN lb_anonymous INTEGER DEFAULT 0",
      `CREATE TABLE IF NOT EXISTS tracked_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_ca TEXT UNIQUE NOT NULL,
        label TEXT DEFAULT '',
        added_by INTEGER,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS airdrop_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_ca TEXT NOT NULL,
        label TEXT DEFAULT '',
        criteria_json TEXT DEFAULT '[]',
        rows_json TEXT DEFAULT '[]',
        total_amount REAL DEFAULT 0,
        recipient_count INTEGER DEFAULT 0,
        reward_type TEXT DEFAULT 'SOL',
        created_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')))`,
      `CREATE TABLE IF NOT EXISTS reward_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_ca TEXT,
        reward_type TEXT DEFAULT 'SOL',
        amount REAL DEFAULT 0,
        reason TEXT DEFAULT '',
        status TEXT DEFAULT 'sent',
        tx_hash TEXT DEFAULT '',
        sent_by INTEGER,
        created_at TEXT DEFAULT (datetime('now')))`,
      "ALTER TABLE users ADD COLUMN promoter_rate REAL DEFAULT 0",
      "ALTER TABLE settings ADD COLUMN auto_sell_enabled INTEGER DEFAULT 0",
      "ALTER TABLE settings ADD COLUMN auto_sell_template_id INTEGER DEFAULT NULL",
      `CREATE TABLE IF NOT EXISTS auto_sell_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT DEFAULT 'My Template',
        active INTEGER DEFAULT 1,
        sl_1 REAL DEFAULT 0,
        sl_1_trail INTEGER DEFAULT 0,
        sl_2 REAL DEFAULT 0,
        sl_2_trail INTEGER DEFAULT 0,
        sl_3 REAL DEFAULT 0,
        sl_3_trail INTEGER DEFAULT 0,
        tp_1 REAL DEFAULT 0,
        tp_1_pct REAL DEFAULT 100,
        tp_1_trail INTEGER DEFAULT 0,
        tp_2 REAL DEFAULT 0,
        tp_2_pct REAL DEFAULT 100,
        tp_2_trail INTEGER DEFAULT 0,
        tp_3 REAL DEFAULT 0,
        tp_3_pct REAL DEFAULT 100,
        tp_3_trail INTEGER DEFAULT 0,
        tp_4 REAL DEFAULT 0,
        tp_4_pct REAL DEFAULT 100,
        tp_4_trail INTEGER DEFAULT 0,
        tp_5 REAL DEFAULT 0,
        tp_5_pct REAL DEFAULT 100,
        tp_5_trail INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')))`,
    "ALTER TABLE copy_channels ADD COLUMN wallet_id INTEGER DEFAULT NULL",
    "ALTER TABLE copy_channels ADD COLUMN gas_fee REAL DEFAULT 0.005",
    "ALTER TABLE copy_channels ADD COLUMN skipped_signals INTEGER DEFAULT 0",
    "ALTER TABLE copy_channels ADD COLUMN min_token_age INTEGER DEFAULT 0",
    "ALTER TABLE positions ADD COLUMN entry_mcap REAL DEFAULT 0",
    "ALTER TABLE positions ADD COLUMN auto_sell_template_id INTEGER DEFAULT NULL",
    `CREATE TABLE IF NOT EXISTS copy_wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      wallet_address TEXT NOT NULL,
      label TEXT DEFAULT '',
      sol_amount REAL DEFAULT 0.1,
      mirror_sells INTEGER DEFAULT 0,
      max_sol REAL DEFAULT 1,
      auto_sell_enabled INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS copy_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT DEFAULT '',
      channel_type TEXT DEFAULT 'public',
      status TEXT DEFAULT 'active',
      buy_amount REAL DEFAULT 0.1,
      slippage REAL DEFAULT 50,
      tip REAL DEFAULT 0.001,
      mev_protection INTEGER DEFAULT 1,
      auto_sell_enabled INTEGER DEFAULT 0,
      stop_loss_pct REAL DEFAULT 0,
      take_profit_pct REAL DEFAULT 0,
      min_mcap REAL DEFAULT 0,
      max_mcap REAL DEFAULT 0,
      min_liquidity REAL DEFAULT 0,
      max_buy_tax REAL DEFAULT 100,
      mint_auth_revoked INTEGER DEFAULT 0,
      freeze_auth_revoked INTEGER DEFAULT 0,
      duplicate_buys INTEGER DEFAULT 1,
      only_renounced INTEGER DEFAULT 0,
      max_buys_per_signal INTEGER DEFAULT 1,
      blacklist TEXT DEFAULT '[]',
      signals_caught INTEGER DEFAULT 0,
      trades_executed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS sniper_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      label TEXT DEFAULT 'Setup 1',
      snipe_type TEXT DEFAULT 'auto',
      snipe_amount REAL DEFAULT 0.1,
      snipe_slippage REAL DEFAULT 50,
      snipe_tip REAL DEFAULT 0.005,
      snipe_fee REAL DEFAULT 0.003,
      mev_protection INTEGER DEFAULT 1,
      auto_sell INTEGER DEFAULT 0,
      max_snipes INTEGER DEFAULT 5,
      min_liquidity REAL DEFAULT 0,
      max_liquidity REAL DEFAULT 0,
      market_cap_min REAL DEFAULT 0,
      dev_holding_max REAL DEFAULT 100,
      platform_raydium INTEGER DEFAULT 1,
      platform_pumpfun INTEGER DEFAULT 1,
      platform_moonshot INTEGER DEFAULT 1,
      platform_launchlab INTEGER DEFAULT 0,
      platform_meteora INTEGER DEFAULT 0,
      mint_auth_revoked INTEGER DEFAULT 0,
      freeze_auth_revoked INTEGER DEFAULT 0,
      require_twitter INTEGER DEFAULT 0,
      require_website INTEGER DEFAULT 0,
      require_telegram INTEGER DEFAULT 0,
      use_lightning_rpc INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS snipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      config_id INTEGER,
      token_ca TEXT,
      snipe_type TEXT DEFAULT 'migration',
      sol_amount REAL DEFAULT 0.1,
      slippage REAL DEFAULT 50,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS limit_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_ca TEXT NOT NULL,
      token_name TEXT DEFAULT '',
      order_type TEXT NOT NULL,
      target_price REAL DEFAULT 0,
      target_mcap REAL DEFAULT 0,
      sol_amount REAL DEFAULT 0.1,
      sell_pct REAL DEFAULT 100,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS dca_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_ca TEXT NOT NULL,
      token_name TEXT DEFAULT '',
      sol_per_buy REAL DEFAULT 0.1,
      total_buys INTEGER DEFAULT 5,
      buys_done INTEGER DEFAULT 0,
      interval_sec INTEGER DEFAULT 3600,
      next_buy_at TEXT DEFAULT (datetime('now')),
      avg_price REAL DEFAULT 0,
      total_spent REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      paused INTEGER DEFAULT 0,
      wallet_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS auto_sell_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      rule_name TEXT DEFAULT 'My Rule',
      tp1_pct REAL DEFAULT 0,
      tp1_sell_pct REAL DEFAULT 0,
      tp2_pct REAL DEFAULT 0,
      tp2_sell_pct REAL DEFAULT 0,
      tp3_pct REAL DEFAULT 0,
      tp3_sell_pct REAL DEFAULT 0,
      sl_pct REAL DEFAULT 0,
      trailing_stop INTEGER DEFAULT 0,
      trail_pct REAL DEFAULT 0,
      time_exit_min INTEGER DEFAULT 0,
      liq_exit_pct REAL DEFAULT 0,
      sell_slippage REAL DEFAULT 15,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS channel_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      user_id INTEGER,
      ca TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      action_taken TEXT DEFAULT 'none',
      tx_hash TEXT DEFAULT '')`,
    `CREATE TABLE IF NOT EXISTS price_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_ca TEXT NOT NULL,
      token_name TEXT DEFAULT '',
      target_price REAL NOT NULL,
      direction TEXT DEFAULT 'above',
      fired INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS wallet_trackers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      wallet_address TEXT NOT NULL,
      label TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')))`,
  ];
  for (const sql of migrations) {
    try { d.exec(sql); } catch {}
  }
}

// ── USERS ─────────────────────────────────────────────────────
function getUser(userId) {
  return getDb().prepare("SELECT * FROM users WHERE user_id = ?").get(userId);
}

function createUser(data) {
  const userId     = typeof data === "object" ? data.userId     : data;
  const username   = typeof data === "object" ? data.username   : (arguments[1] || "");
  const language   = typeof data === "object" ? data.language   : (arguments[2] || "en");
  const referrerId = typeof data === "object" ? data.referrerId : (arguments[3] || null);
  const joinerDisc = typeof data === "object" ? data.joinerDiscount : (arguments[4] ? 1 : 0);

  getDb().prepare(
    `INSERT OR IGNORE INTO users
     (user_id, username, language, rank, cumulative_volume_sol,
      trial_active, referrer_id, joiner_discount, mode)
     VALUES (?, ?, ?, 1, 0, 0, ?, ?, 'beginner')`
  ).run(userId, username, language, referrerId || null, joinerDisc ? 1 : 0);

  getDb().prepare("INSERT OR IGNORE INTO settings (user_id) VALUES (?)").run(userId);
  return getUser(userId);
}

function updateUser(userId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  getDb().prepare(`UPDATE users SET ${set} WHERE user_id = ?`)
    .run(...keys.map((k) => fields[k]), userId);
}

function getAllUsers() {
  return getDb().prepare("SELECT * FROM users").all();
}

function setUserMode(userId, mode) {
  getDb().prepare("UPDATE users SET mode = ? WHERE user_id = ?").run(mode, userId);
}

function setSapHash(userId, hash) {
  getDb().prepare("UPDATE users SET sap_hash = ?, sap_enabled = 1 WHERE user_id = ?").run(hash, userId);
}

function clearSap(userId) {
  getDb().prepare("UPDATE users SET sap_hash = NULL, sap_enabled = 0 WHERE user_id = ?").run(userId);
}

function touchLastActive(userId) {
  getDb().prepare("UPDATE users SET last_active_at = ? WHERE user_id = ?")
    .run(new Date().toISOString(), userId);
}

function isSessionExpired(user) {
  if (!user.session_timeout_sec || user.session_timeout_sec === 0) return false;
  const lastActive = new Date(user.last_active_at || Date.now()).getTime();
  return (Date.now() - lastActive) / 1000 > user.session_timeout_sec;
}

function resetTradeRateLimit(userId, windowStart) {
  getDb().prepare("UPDATE users SET trade_count_minute = 1, trade_window_start = ? WHERE user_id = ?")
    .run(windowStart, userId);
}

function incrementTradeRateLimit(userId) {
  getDb().prepare("UPDATE users SET trade_count_minute = trade_count_minute + 1 WHERE user_id = ?")
    .run(userId);
}

// ── SETTINGS ──────────────────────────────────────────────────
function getSettings(userId) {
  return getDb().prepare("SELECT * FROM settings WHERE user_id = ?").get(userId);
}

function updateSettings(userId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  getDb().prepare(`UPDATE settings SET ${set} WHERE user_id = ?`)
    .run(...keys.map((k) => fields[k]), userId);
}

// ── WALLETS ───────────────────────────────────────────────────
function addWallet(userId, publicKey, encKey, salt, iv, tag, label) {
  const result = getDb().prepare(
    `INSERT INTO wallets
     (user_id, public_key, encrypted_private_key, encryption_salt,
      encryption_iv, encryption_tag, label)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, publicKey, encKey, salt, iv, tag, label || "Wallet");
  return result.lastInsertRowid;
}

function getWallets(userId) {
  return getDb().prepare("SELECT * FROM wallets WHERE user_id = ?").all(userId) || [];
}

function getWallet(walletId) {
  return getDb().prepare("SELECT * FROM wallets WHERE wallet_id = ?").get(walletId);
}

function getWalletById(walletId) {
  return getDb().prepare("SELECT * FROM wallets WHERE wallet_id = ?").get(walletId);
}

function countWallets(userId) {
  return getDb().prepare("SELECT COUNT(*) as cnt FROM wallets WHERE user_id = ?").get(userId).cnt;
}

async function getWalletBalance(address) {
  if (!address) return 0;
  if (config.DEVNET_MODE || config.MOCK_TRADES) {
    const saved = getSysConfig(`mock_balance_${address}`);
    return saved ? parseFloat(saved) : 0;
  }
  // MAINNET: fetch real on-chain balance
  try {
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
    const conn = new Connection(process.env.HELIUS_RPC_URL || process.env.BACKUP_RPC_URL, "confirmed");
    const lamports = await conn.getBalance(new PublicKey(address));
    return lamports / LAMPORTS_PER_SOL;
  } catch { return 0; }
}

function getWithdrawalWhitelist(userId) {
  return getDb().prepare("SELECT * FROM withdrawal_whitelist WHERE user_id = ?").all(userId);
}

function addWithdrawalWhitelist(userId, address, label) {
  getDb().prepare("INSERT INTO withdrawal_whitelist (user_id, address, label) VALUES (?, ?, ?)")
    .run(userId, address, label || "");
}

function removeWithdrawalWhitelist(userId, id) {
  getDb().prepare("DELETE FROM withdrawal_whitelist WHERE id = ? AND user_id = ?").run(id, userId);
}

// ── TRADES ────────────────────────────────────────────────────
function recordTrade(data) {
  const result = getDb().prepare(
    `INSERT INTO trades
     (user_id, wallet_id, token_ca, token_name, platform, action,
      sol_amount, token_amount, price_sol, fee_sol, fee_rate, tx_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.userId, data.walletId, data.tokenCa,
    data.tokenName || "Unknown", data.platform || "devnet_mock",
    data.action, data.solAmount, data.tokenAmount || 0,
    data.priceSol || 0, data.feeSol || 0, data.feeRate || 0,
    data.txHash || "DEVNET_MOCK_TX", data.status || "confirmed"
  );
  return result.lastInsertRowid;
}

function getTradeHistory(userId, limit = 20) {
  return getDb().prepare("SELECT * FROM trades WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?")
    .all(userId, limit);
}



// ── LAUNCHES ──────────────────────────────────────────────────
function getLaunches(userId) {
  return getDb().prepare("SELECT * FROM launches WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function getLaunch(userId, id) {
  return getDb().prepare("SELECT * FROM launches WHERE id = ? AND user_id = ?").get(id, userId);
}

function createLaunch(userId, data) {
  const r = getDb().prepare(`INSERT INTO launches (user_id, token_ca, name, symbol, description, image_url, launchpad, supply, curve_type, graduation_sol, vesting, x_url, telegram_url, website_url, dev_buy_sol, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, data.tokenCa||'', data.name||'', data.symbol||'', data.description||'', data.imageUrl||'', data.launchpad||'pump', data.supply||'1000000000', data.curveType||'justsendit', data.graduationSol||85, data.vesting?1:0, data.xUrl||'', data.telegramUrl||'', data.websiteUrl||'', data.devBuySol||0, data.status||'pending');
  return r.lastInsertRowid;
}

function updateLaunch(userId, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map(k => k + ' = ?').join(', ');
  getDb().prepare(`UPDATE launches SET ${set} WHERE id = ? AND user_id = ?`).run(...keys.map(k => fields[k]), id, userId);
}

function deleteLaunch(userId, id) {
  getDb().prepare("DELETE FROM launches WHERE id = ? AND user_id = ?").run(id, userId);
}

// ── COPY SELL PRESETS ─────────────────────────────────────────
function getCopySellPresets(userId) {
  return getDb().prepare("SELECT * FROM copy_sell_presets WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function getCopySellPreset(userId, id) {
  return getDb().prepare("SELECT * FROM copy_sell_presets WHERE id = ? AND user_id = ?").get(id, userId);
}

function saveCopySellPreset(userId, name, data) {
  const r = getDb().prepare("INSERT INTO copy_sell_presets (user_id, name, min_profit, stop_loss, ignore_dust, sell_delay) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, name, data.minProfit||0, data.stopLoss||0, data.ignoreDust||0, data.sellDelay||0);
  return r.lastInsertRowid;
}

function deleteCopySellPreset(userId, id) {
  getDb().prepare("DELETE FROM copy_sell_presets WHERE id = ? AND user_id = ?").run(id, userId);
}

function getCopyWalletTrades(userId, walletAddress, limit = 15) {
  // Note: trades table has no source column yet. At mainnet, copy trades will be tagged.
  // For now, return trades on the wallet_id linked to this copy wallet's target.
  return getDb().prepare("SELECT * FROM trades WHERE user_id = ? AND platform LIKE '%copy%' ORDER BY timestamp DESC LIMIT ?").all(userId, limit);
}

function getTradeHistoryFiltered(userId, days = 1) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return getDb().prepare("SELECT * FROM trades WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp DESC")
    .all(userId, since);
}

// Compute realized win/loss by matching sells to buys per token
function computeWinLoss(trades) {
  const byToken = {};
  trades.forEach(t => {
    if (!byToken[t.token_ca]) byToken[t.token_ca] = { bought: 0, sold: 0, hasSell: false };
    const net = (t.sol_amount || 0) - (t.fee_sol || 0);
    if (t.action === "buy")  byToken[t.token_ca].bought += (t.sol_amount || 0) + (t.fee_sol || 0);
    if (t.action === "sell") { byToken[t.token_ca].sold += net; byToken[t.token_ca].hasSell = true; }
  });
  let wins = 0, losses = 0, realizedPnl = 0;
  Object.values(byToken).forEach(tk => {
    if (!tk.hasSell) return; // only count tokens that have been sold (realized)
    const tokenPnl = tk.sold - tk.bought;
    realizedPnl += tokenPnl;
    if (tokenPnl >= 0) wins++; else losses++;
  });
  const closed = wins + losses;
  return {
    wins, losses, closed, realizedPnl,
    winRate:  closed > 0 ? Math.round((wins / closed) * 100) : 0,
    lossRate: closed > 0 ? Math.round((losses / closed) * 100) : 0,
  };
}

function getTodayStats(userId, walletId) {
  const today  = new Date().toISOString().slice(0, 10);
  let query = "SELECT * FROM trades WHERE user_id = ? AND timestamp >= ? AND status = 'confirmed'";
  const params = [userId, today + "T00:00:00.000Z"];
  if (walletId) { query += " AND wallet_id = ?"; params.push(walletId); }
  const trades = getDb().prepare(query).all(...params);

  const wl = computeWinLoss(trades);
  return {
    pnl: wl.realizedPnl,
    trades: trades.length,
    winRate: wl.winRate,
    lossRate: wl.lossRate,
    wins: wl.wins,
    losses: wl.losses,
  };
}

function getUserStats(userId) {
  const trades      = getDb().prepare("SELECT * FROM trades WHERE user_id = ? AND status = 'confirmed'").all(userId);
  const wl = computeWinLoss(trades);
  // best/worst per-token realized PnL
  const byToken = {};
  trades.forEach(t => {
    if (!byToken[t.token_ca]) byToken[t.token_ca] = { bought: 0, sold: 0, hasSell: false };
    if (t.action === "buy")  byToken[t.token_ca].bought += (t.sol_amount||0) + (t.fee_sol||0);
    if (t.action === "sell") { byToken[t.token_ca].sold += (t.sol_amount||0) - (t.fee_sol||0); byToken[t.token_ca].hasSell = true; }
  });
  let bestPnl = 0, worstPnl = 0;
  Object.values(byToken).forEach(tk => {
    if (!tk.hasSell) return;
    const p = tk.sold - tk.bought;
    if (p > bestPnl)  bestPnl  = p;
    if (p < worstPnl) worstPnl = p;
  });
  return { totalTrades: trades.length, totalPnl: wl.realizedPnl, winRate: wl.winRate, lossRate: wl.lossRate, bestPnl, worstPnl };
}

function getWeeklyPnl(userId) {
  const trades = getTradeHistoryFiltered(userId, 7);
  let pnl = 0;
  trades.forEach((t) => {
    if (t.action === "sell") pnl += t.sol_amount - t.fee_sol;
    else if (t.action === "buy") pnl -= t.sol_amount;
  });
  return pnl;
}

function getMonthlyPnl(userId) {
  const trades = getTradeHistoryFiltered(userId, 30);
  let pnl = 0;
  trades.forEach((t) => {
    if (t.action === "sell") pnl += t.sol_amount - t.fee_sol;
    else if (t.action === "buy") pnl -= t.sol_amount;
  });
  return pnl;
}

// ── POSITIONS ─────────────────────────────────────────────────
function openPosition(data) {
  const s = getSettings(data.userId);
  return getDb().prepare(
    `INSERT INTO positions
     (user_id, wallet_id, token_ca, token_name, buy_price,
      sol_invested, token_amount, platform, stop_loss_pct, take_profit_pct,
      source, source_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.userId, data.walletId, data.tokenCa,
    data.tokenName || "Unknown", data.buyPrice || 0,
    data.solInvested, data.tokenAmount || 1000000,
    data.platform || "devnet_mock",
    0,
    0,
    data.source    || "manual",
    data.sourceRef || "",
  );
}

function getOpenPositions(userId) {
  return getDb().prepare("SELECT * FROM positions WHERE user_id = ? AND status = 'open' ORDER BY opened_at DESC")
    .all(userId);
}

function getPositionsBySource(userId, source) {
  if (!source || source === "all") return getOpenPositions(userId);
  if (source === "manual") {
    return getDb().prepare(
      "SELECT * FROM positions WHERE user_id = ? AND status = 'open' AND source IN ('manual','sniper','auto_buy') ORDER BY opened_at DESC"
    ).all(userId);
  }
  if (source === "channel") {
    return getDb().prepare(
      "SELECT * FROM positions WHERE user_id = ? AND status = 'open' AND source = 'copy_channel' ORDER BY opened_at DESC"
    ).all(userId);
  }
  if (source === "copy_wallet") {
    return getDb().prepare(
      "SELECT * FROM positions WHERE user_id = ? AND status = 'open' AND source = 'copy_wallet' ORDER BY opened_at DESC"
    ).all(userId);
  }
  return getOpenPositions(userId);
}

function closePosition(positionId) {
  getDb().prepare("UPDATE positions SET status = 'closed' WHERE position_id = ?").run(positionId);
}

function getAllOpenPositions() {
  return getDb().prepare("SELECT * FROM positions WHERE status = 'open'").all();
}

function setPositionNote(positionId, userId, note) {
  getDb().prepare("UPDATE positions SET note = ? WHERE position_id = ? AND user_id = ?")
    .run(note.slice(0, 200), positionId, userId);
}

function getPosition(positionId, userId) {
  return getDb().prepare("SELECT * FROM positions WHERE position_id = ? AND user_id = ? AND status = 'open'")
  .get(positionId, userId);
}

// ── REFERRALS ─────────────────────────────────────────────────
function buildReferralChain(userId, referrerId) {
  if (!referrerId) return;
  const insert = getDb().prepare("INSERT OR IGNORE INTO referral_chain (user_id, level, referral_user_id) VALUES (?, ?, ?)");
  let currentId = referrerId;
  for (let level = 1; level <= 6; level++) {
    if (!currentId) break;
    insert.run(userId, level, currentId);
    const parent = getUser(currentId);
    currentId = parent ? parent.referrer_id : null;
  }
}

function getReferralChain(userId) {
  return getDb().prepare("SELECT * FROM referral_chain WHERE user_id = ?").all(userId);
}

function addReferralEarning(data) {
  getDb().prepare(
    "INSERT INTO referral_earnings (user_id, from_user_id, level, fee_sol, earned_sol, trade_id, paid) VALUES (?, ?, ?, ?, ?, ?, 0)"
  ).run(data.userId, data.fromUserId, data.level, data.feeSol, data.earnedSol, data.tradeId);
}

function getPendingEarnings(userId) {
  return getDb().prepare("SELECT SUM(earned_sol) as total FROM referral_earnings WHERE user_id = ? AND paid = 0").get(userId);
}

function getTotalEarnings(userId) {
  return getDb().prepare("SELECT SUM(earned_sol) as total FROM referral_earnings WHERE user_id = ?").get(userId);
}

function getPaidEarnings(userId) {
  return getDb().prepare("SELECT SUM(earned_sol) as total FROM referral_earnings WHERE user_id = ? AND paid = 1").get(userId);
}

// Get user by ANY referral code (auto referral_code OR custom_code), case-insensitive
function getUserByReferralCode(code) {
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) return null;
  return getDb().prepare("SELECT * FROM users WHERE UPPER(referral_code) = ? OR UPPER(custom_code) = ? LIMIT 1").get(clean, clean);
}

// Ensure a user has an auto referral_code (generate if missing)
// Built from username when possible (e.g. HAWKFAZLE139), falls back to random.
function ensureReferralCode(userId) {
  const u = getDb().prepare("SELECT referral_code, username FROM users WHERE user_id = ?").get(userId);
  if (u && u.referral_code) return u.referral_code;
  const crypto = require("crypto");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  // 1. Try a username-based code first: HAWK + cleaned username (letters/numbers only, max 11 chars)
  if (u && u.username) {
    const cleaned = u.username.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 11);
    if (cleaned.length >= 2) {
      const candidate = "HAWK" + cleaned;
      const taken = getDb().prepare("SELECT 1 FROM users WHERE UPPER(referral_code) = ? OR UPPER(custom_code) = ?").get(candidate, candidate);
      if (!taken) {
        getDb().prepare("UPDATE users SET referral_code = ? WHERE user_id = ?").run(candidate, userId);
        return candidate;
      }
      // Username taken → try appending a couple random chars
      for (let t = 0; t < 10; t++) {
        let c2 = candidate.slice(0, 11);
        for (let i = 0; i < 3; i++) c2 += chars[crypto.randomInt(chars.length)];
        if (!getDb().prepare("SELECT 1 FROM users WHERE UPPER(referral_code) = ? OR UPPER(custom_code) = ?").get(c2, c2)) {
          getDb().prepare("UPDATE users SET referral_code = ? WHERE user_id = ?").run(c2, userId);
          return c2;
        }
      }
    }
  }

  // 2. Fallback: fully random (no username, or all username variants taken)
  for (let t = 0; t < 20; t++) {
    let c = "HAWK";
    for (let i = 0; i < 5; i++) c += chars[crypto.randomInt(chars.length)];
    if (!getDb().prepare("SELECT 1 FROM users WHERE referral_code = ?").get(c)) {
      getDb().prepare("UPDATE users SET referral_code = ? WHERE user_id = ?").run(c, userId);
      return c;
    }
  }
  return null;
}

// Set a custom code (returns {ok, reason}). Validates length, charset, uniqueness, reserved words.
function setCustomCode(userId, rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  if (code.length < 3 || code.length > 15) return { ok: false, reason: "Code must be 3-15 characters." };
  if (!/^[A-Z0-9]+$/.test(code)) return { ok: false, reason: "Only letters and numbers allowed (no spaces or symbols)." };
  const reserved = ["HAWKX","ADMIN","OFFICIAL","SUPPORT","HAWK","MOD","TEAM","BOT"];
  if (reserved.includes(code)) return { ok: false, reason: "That code is reserved. Pick another." };
  // Uniqueness — not used by anyone else (auto or custom)
  const taken = getDb().prepare("SELECT user_id FROM users WHERE (UPPER(referral_code) = ? OR UPPER(custom_code) = ?) AND user_id != ?").get(code, code, userId);
  if (taken) return { ok: false, reason: "That code is already taken. Try another." };
  getDb().prepare("UPDATE users SET custom_code = ? WHERE user_id = ?").run(code, userId);
  return { ok: true, code };
}

function getUserByUsername(username) {
  const clean = String(username || "").replace(/^@/, "").trim();
  if (!clean) return null;
  return getDb().prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1").get(clean);
}

function getDirectReferralCount(userId) {
  return getDb().prepare("SELECT COUNT(*) as cnt FROM users WHERE referrer_id = ?").get(userId)?.cnt || 0;
}

function markEarningsPaid(userId) {
  getDb().prepare("UPDATE referral_earnings SET paid = 1 WHERE user_id = ? AND paid = 0").run(userId);
}

// Manual claim: check minimum, mark paid, return result
function claimEarnings(userId, minClaim = 0.01) {
  const row = getDb().prepare("SELECT SUM(earned_sol) as total FROM referral_earnings WHERE user_id = ? AND paid = 0").get(userId);
  const pending = row?.total || 0;
  if (pending < minClaim) {
    return { ok: false, pending, min: minClaim };
  }
  getDb().prepare("UPDATE referral_earnings SET paid = 1 WHERE user_id = ? AND paid = 0").run(userId);
  return { ok: true, claimed: pending };
}

function getAllPendingPayouts() {
  return getDb().prepare("SELECT user_id, SUM(earned_sol) as total FROM referral_earnings WHERE paid = 0 GROUP BY user_id").all();
}

function checkReferralMilestone(userId) {
  const count = getDb().prepare(
    "SELECT COUNT(DISTINCT referral_user_id) as cnt FROM referral_chain WHERE user_id = ? AND level = 1"
  ).get(userId).cnt;
  const milestones = [{ count: 5, reward: 0.1 }, { count: 25, reward: 0.5 }, { count: 100, reward: 2.0 }];
  for (const m of milestones) {
    if (count >= m.count) {
      const exists = getDb().prepare("SELECT id FROM referral_milestones WHERE user_id = ? AND milestone = ?").get(userId, m.count);
      if (!exists) {
        getDb().prepare("INSERT INTO referral_milestones (user_id, milestone, reward_sol) VALUES (?, ?, ?)").run(userId, m.count, m.reward);
        return { milestone: m.count, reward: m.reward };
      }
    }
  }
  return null;
}

// ── WATCHLIST ─────────────────────────────────────────────────
function getWatchlist(userId) {
  return getDb().prepare("SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at DESC").all(userId);
}

function addToWatchlist(userId, tokenCa, tokenName, addedPrice) {
  const count = getDb().prepare("SELECT COUNT(*) as cnt FROM watchlist WHERE user_id = ?").get(userId).cnt;
  if (count >= 20) return { error: "max" };
  getDb().prepare("INSERT OR IGNORE INTO watchlist (user_id, token_ca, token_name, added_price) VALUES (?, ?, ?, ?)")
    .run(userId, tokenCa, tokenName || "Unknown", addedPrice || 0);
  return { ok: true };
}

function removeFromWatchlist(userId, id) {
  getDb().prepare("DELETE FROM watchlist WHERE id = ? AND user_id = ?").run(id, userId);
}

// ── COPY WALLETS ──────────────────────────────────────────────
function getCopyWallets(userId) {
  return getDb().prepare(
    "SELECT cw.*, w.label as wallet_label FROM copy_wallets cw LEFT JOIN wallets w ON cw.wallet_id = w.wallet_id WHERE cw.user_id = ? ORDER BY cw.id DESC"
  ).all(userId);
}

function addCopyWallet(userId, address, label, solAmount, mirrorSells, maxSol, walletId = null, slippage = 50, gasFee = 0.005, copySell = 1, minSol = 0, copyPct = 100, delaySec = 0) {
  const count = getCopyWallets(userId).length;
  if (count >= 5) return { error: "Max 5 copy wallets reached." };
  try {
    const existing = getDb().prepare("SELECT id FROM copy_wallets WHERE user_id = ? AND wallet_address = ?").get(userId, address);
    if (existing) return { error: "Wallet already added." };
    getDb().prepare(
      `INSERT INTO copy_wallets (user_id, wallet_address, label, sol_amount, mirror_sells, max_sol, active, wallet_id, slippage, gas_fee, copy_sell, min_sol, copy_pct, delay_seconds)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, address, label || address.slice(0,8)+"...", solAmount || 0.1, mirrorSells ? 1 : 0, maxSol || 1, walletId, slippage, gasFee, copySell, minSol, copyPct, delaySec);
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

function deleteCopyWallet(userId, id) {
  getDb().prepare("DELETE FROM copy_wallets WHERE id = ? AND user_id = ?").run(id, userId);
}

function toggleCopyWallet(userId, id) {
  const row = getDb().prepare("SELECT active FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) return;
  getDb().prepare("UPDATE copy_wallets SET active = ? WHERE id = ? AND user_id = ?").run(row.active ? 0 : 1, id, userId);
}

function updateCopyWallet(userId, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  getDb().prepare(`UPDATE copy_wallets SET ${set} WHERE id = ? AND user_id = ?`)
    .run(...keys.map((k) => fields[k]), id, userId);
}

// ── COPY CHANNELS ─────────────────────────────────────────────
function getCopyChannels(userId) {
  return getDb().prepare("SELECT * FROM copy_channels WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function addCopyChannel(userId, channelId, channelName, settings) {
  const s = settings || {};
  getDb().prepare(
    `INSERT INTO copy_channels
     (user_id, channel_id, channel_name, buy_amount, slippage, tip,
      mev_protection, auto_sell_enabled, stop_loss_pct, take_profit_pct, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
  ).run(userId, channelId, channelName || channelId,
    s.buyAmount || 0.1, s.slippage || 50, s.tip || 0.001,
    1, s.autoSell ? 1 : 0, s.stopLoss || 0, s.takeProfit || 0);
  return { success: true };
}

function deleteCopyChannel(userId, id) {
  getDb().prepare("DELETE FROM copy_channels WHERE id = ? AND user_id = ?").run(id, userId);
}

function updateCopyChannel(userId, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  getDb().prepare(`UPDATE copy_channels SET ${set} WHERE id = ? AND user_id = ?`)
    .run(...keys.map((k) => fields[k]), id, userId);
}

function toggleCopyChannel(userId, id) {
  const row = getDb().prepare("SELECT status FROM copy_channels WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) return;
  const newStatus = row.status === "active" ? "paused" : "active";
  getDb().prepare("UPDATE copy_channels SET status = ? WHERE id = ? AND user_id = ?").run(newStatus, id, userId);
}

function getCopyChannel(id, userId) {
  return getDb().prepare("SELECT * FROM copy_channels WHERE id = ? AND user_id = ?").get(id, userId);
}

// ── SNIPER CONFIGS ────────────────────────────────────────────
function getSniperConfigs(userId) {
  return getDb().prepare("SELECT * FROM sniper_configs WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function createSniperConfig(userId, label, type) {
  const result = getDb().prepare("INSERT INTO sniper_configs (user_id, label, snipe_type) VALUES (?, ?, ?)")
    .run(userId, label || "Setup 1", type || "auto");
  return result.lastInsertRowid;
}

function updateSniperConfig(userId, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  getDb().prepare(`UPDATE sniper_configs SET ${set} WHERE id = ? AND user_id = ?`)
    .run(...keys.map((k) => fields[k]), id, userId);
}

function deleteSniperConfig(userId, id) {
  getDb().prepare("DELETE FROM sniper_configs WHERE id = ? AND user_id = ?").run(id, userId);
}

function getSniperConfig(id, userId) {
  return getDb().prepare("SELECT * FROM sniper_configs WHERE id = ? AND user_id = ?").get(id, userId);
}

function pauseAllSnipes(userId) {
  getDb().prepare("UPDATE sniper_configs SET active = 0 WHERE user_id = ?").run(userId);
  getDb().prepare("UPDATE snipes SET active = 0 WHERE user_id = ?").run(userId);
}

function getActiveSnipes(userId) {
  return getDb().prepare("SELECT * FROM snipes WHERE user_id = ?").all(userId);
}

function addSnipe(userId, tokenCa, solAmount, slippage, configId, opts) {
  const o = opts || {};
  getDb().prepare("INSERT INTO snipes (user_id, token_ca, sol_amount, slippage, config_id, gas, mev, auto_sell_template_id, label, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)")
    .run(userId, tokenCa, solAmount || 0.1, slippage || 50, configId || null, o.gas || 0.005, o.mev ? 1 : 0, o.auto_sell_template_id || null, o.label || null);
}

function getRealtimeSniperConfig(userId) {
  const s = getSettings(userId) || {};
  return {
    enabled: !!(s.sniper_rt_enabled ?? 0),
    amount: Number(s.sniper_rt_amount ?? 0.1),
    slippage: Number(s.sniper_rt_slippage ?? 50),
    fee: Number(s.sniper_rt_fee ?? 0.003),
    mev: !!(s.sniper_rt_mev ?? 1),
    raydium: !!(s.sniper_rt_raydium ?? 1),
    migrating: !!(s.sniper_rt_migrating ?? 1),
    auto_sell_enabled: s.sniper_rt_auto_sell_enabled || 0,
    auto_sell_template_id: s.sniper_rt_auto_sell_template_id || 0,
    platform_launchlab: !!(s.sniper_rt_launchlab ?? 0),
    jito_tip: Number(s.sniper_rt_jito ?? 0.005),
  };
}

function updateRealtimeSniperConfig(userId, fields) {
  updateSettings(userId, fields);
}

function cancelSnipe(userId, id) {
  getDb().prepare("DELETE FROM snipes WHERE id = ? AND user_id = ?").run(id, userId);
}

// ── LIMIT ORDERS ──────────────────────────────────────────────
function getLimitOrders(userId, tokenCa) {
  if (tokenCa) return getDb().prepare("SELECT * FROM limit_orders WHERE user_id = ? AND token_ca = ? AND active = 1 ORDER BY created_at DESC").all(userId, tokenCa);
  return getDb().prepare("SELECT * FROM limit_orders WHERE user_id = ? AND active = 1 ORDER BY created_at DESC").all(userId);
}

function pauseLimitOrder(userId, id) {
  const o = getDb().prepare("SELECT paused FROM limit_orders WHERE id = ? AND user_id = ?").get(id, userId);
  if (!o) return;
  getDb().prepare("UPDATE limit_orders SET paused = ? WHERE id = ? AND user_id = ?").run(o.paused ? 0 : 1, id, userId);
}

function addLimitOrder(userId, data) {
  // Default expiry: 48 hours from now (unless specified)
  let expiresAt = data.expiresAt;
  if (expiresAt === undefined) {
    expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  }
  const result = getDb().prepare(
    "INSERT INTO limit_orders (user_id, token_ca, token_name, order_type, target_price, target_mcap, sol_amount, sell_pct, active, paused, wallet_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)"
  ).run(userId, data.tokenCa, data.tokenName || "", data.orderType, data.targetPrice || 0, data.targetMcap || 0, data.solAmount || 0.1, data.sellPct || 100, data.walletId || null, expiresAt);
  return result.lastInsertRowid;
}

function setLimitOrderExpiry(userId, id, expiresAt) {
  getDb().prepare("UPDATE limit_orders SET expires_at = ? WHERE id = ? AND user_id = ?").run(expiresAt, id, userId);
}

function cancelLimitOrder(userId, id) {
  getDb().prepare("UPDATE limit_orders SET active = -1 WHERE id = ? AND user_id = ?").run(id, userId);
}
// ── DCA ORDERS ───────────────────────────────────────
function getDcaOrders(userId, tokenCa) {
  if (tokenCa) return getDb().prepare("SELECT * FROM dca_orders WHERE user_id = ? AND token_ca = ? AND active = 1 ORDER BY created_at DESC").all(userId, tokenCa);
  return getDb().prepare("SELECT * FROM dca_orders WHERE user_id = ? AND active = 1 ORDER BY created_at DESC").all(userId);
}
function addDcaOrder(userId, data) {
  const nextBuy = new Date(Date.now() + (data.intervalSec || 3600) * 1000).toISOString(); // first buy after first interval
  const result = getDb().prepare(
    "INSERT INTO dca_orders (user_id, token_ca, token_name, sol_per_buy, total_buys, buys_done, interval_sec, next_buy_at, active, paused, wallet_id) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1, 0, ?)"
  ).run(userId, data.tokenCa, data.tokenName || "", data.solPerBuy || 0.1, data.totalBuys || 5, data.intervalSec || 3600, nextBuy, data.walletId || null);
  return result.lastInsertRowid;
}
function pauseDcaOrder(userId, id) {
  const o = getDb().prepare("SELECT paused FROM dca_orders WHERE id = ? AND user_id = ?").get(id, userId);
  if (!o) return;
  getDb().prepare("UPDATE dca_orders SET paused = ? WHERE id = ? AND user_id = ?").run(o.paused ? 0 : 1, id, userId);
}
function cancelDcaOrder(userId, id) {
  getDb().prepare("UPDATE dca_orders SET active = -1 WHERE id = ? AND user_id = ?").run(id, userId);
}
function getAllActiveDca() {
  return getDb().prepare("SELECT * FROM dca_orders WHERE active = 1 AND paused = 0 AND buys_done < total_buys").all();
}
function recordDcaBuy(id, price, spent) {
  const o = getDb().prepare("SELECT * FROM dca_orders WHERE id = ?").get(id);
  if (!o) return;
  const newDone = o.buys_done + 1;
  const newSpent = o.total_spent + spent;
  const newAvg = o.avg_price > 0 ? ((o.avg_price * o.buys_done) + price) / newDone : price;
  const nextAt = new Date(Date.now() + o.interval_sec * 1000).toISOString();
  const stillActive = newDone < o.total_buys ? 1 : 0;
  getDb().prepare("UPDATE dca_orders SET buys_done = ?, total_spent = ?, avg_price = ?, next_buy_at = ?, active = ? WHERE id = ?")
    .run(newDone, newSpent, newAvg, nextAt, stillActive, id);
}
// ── AUTO SELL TEMPLATES ───────────────────────────────────────
function getAutoSellTemplates(userId) {
  return getDb().prepare("SELECT * FROM auto_sell_templates WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

function getAutoSellTemplate(userId, id) {
  return getDb().prepare("SELECT * FROM auto_sell_templates WHERE id = ? AND user_id = ?").get(id, userId);
}

function createAutoSellTemplate(userId, name) {
  const result = getDb().prepare("INSERT INTO auto_sell_templates (user_id, name) VALUES (?, ?)").run(userId, name || "My Template");
  return result.lastInsertRowid;
}

function updateAutoSellTemplate(userId, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  getDb().prepare(`UPDATE auto_sell_templates SET ${set} WHERE id = ? AND user_id = ?`)
    .run(...keys.map((k) => fields[k]), id, userId);
}

function deleteAutoSellTemplate(userId, id) {
  getDb().prepare("DELETE FROM auto_sell_templates WHERE id = ? AND user_id = ?").run(id, userId);
}
// ── AUTO SELL RULES ───────────────────────────────────────────
function getAutoSellRules(userId) {
  return getDb().prepare("SELECT * FROM auto_sell_rules WHERE user_id = ? AND active = 1").all(userId);
}

function addAutoSellRule(userId, data) {
  const result = getDb().prepare(
    `INSERT INTO auto_sell_rules
     (user_id, rule_name, tp1_pct, tp1_sell_pct, tp2_pct, tp2_sell_pct,
      tp3_pct, tp3_sell_pct, sl_pct, trailing_stop, trail_pct,
      time_exit_min, liq_exit_pct, sell_slippage, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(userId, data.ruleName || "My Rule",
    data.tp1Pct || 0, data.tp1SellPct || 0,
    data.tp2Pct || 0, data.tp2SellPct || 0,
    data.tp3Pct || 0, data.tp3SellPct || 0,
    data.slPct || 0, data.trailingStop ? 1 : 0, data.trailPct || 0,
    data.timeExitMin || 0, data.liqExitPct || 0, data.sellSlippage || 15);
  return result.lastInsertRowid;
}

function deleteAutoSellRule(userId, id) {
  getDb().prepare("UPDATE auto_sell_rules SET active = 0 WHERE id = ? AND user_id = ?").run(id, userId);
}

// ── SYSTEM CONFIG ─────────────────────────────────────────────
function getSysConfig(key) {
  const row = getDb().prepare("SELECT value FROM system_config WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setSysConfig(key, value) {
  getDb().prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)").run(key, String(value));
}

function addVolume(userId, solAmount) {
  getDb().prepare("UPDATE users SET cumulative_volume_sol = cumulative_volume_sol + ? WHERE user_id = ?").run(solAmount, userId);
}

// ── BLACKLISTS ────────────────────────────────────────────────
function getGlobalBlacklist() {
  return getDb().prepare("SELECT deployer_address FROM global_blacklist").all().map((r) => r.deployer_address);
}

function addGlobalBlacklist(address, adminId, reason) {
  getDb().prepare("INSERT OR IGNORE INTO global_blacklist (deployer_address, added_by_admin, reason) VALUES (?, ?, ?)")
    .run(address, adminId, reason);
}

function getUserBlacklist(userId) {
  return getDb().prepare("SELECT * FROM user_blacklist WHERE user_id = ?").all(userId);
}

function getUserWhitelist(userId) {
  return getDb().prepare("SELECT * FROM user_whitelist WHERE user_id = ?").all(userId);
}

function flagSuspicious(userId, reason, detail) {
  getDb().prepare("INSERT INTO suspicious_activity (user_id, reason, detail) VALUES (?, ?, ?)").run(userId, reason, detail || "");
}

// ── ADMIN ─────────────────────────────────────────────────────
function getTotalUsers() {
  return getDb().prepare("SELECT COUNT(*) as cnt FROM users").get().cnt;
}

function getRankDistribution() {
  return getDb().prepare("SELECT rank, COUNT(*) as cnt FROM users GROUP BY rank").all();
}

function getRevenue(since) {
  return getDb().prepare("SELECT SUM(fee_sol) as total FROM trades WHERE timestamp >= ?").get(since);
}

// ── ALERTS ────────────────────────────────────────────────────
function getPriceAlerts(userId) {
  return getDb().prepare("SELECT * FROM price_alerts WHERE user_id = ? AND fired = 0").all(userId);
}

function addPriceAlert(userId, tokenCa, tokenName, targetPrice, direction) {
  getDb().prepare("INSERT INTO price_alerts (user_id, token_ca, token_name, target_price, direction) VALUES (?, ?, ?, ?, ?)")
    .run(userId, tokenCa, tokenName || "", targetPrice, direction || "above");
}

function getWalletTrackers(userId) {
  return getDb().prepare("SELECT * FROM wallet_trackers WHERE user_id = ? AND active = 1").all(userId);
}

function addWalletTracker(userId, address, label) {
  getDb().prepare("INSERT INTO wallet_trackers (user_id, wallet_address, label) VALUES (?, ?, ?)")
    .run(userId, address, label || address.slice(0,8)+"...");
}

function removeWalletTracker(userId, id) {
  getDb().prepare("UPDATE wallet_trackers SET active = 0 WHERE id = ? AND user_id = ?").run(id, userId);
}



function getWeeklyFeeSaved(userId) {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const since = d.toISOString();
  const trades = getDb().prepare("SELECT sol_amount, fee_sol FROM trades WHERE user_id = ? AND action = ? AND sol_amount < 1000 AND timestamp >= ?").all(userId, "sell", since);
  const raw = trades.reduce((acc, t) => acc + Math.max(0, (t.sol_amount * 0.01) - t.fee_sol), 0);
  return Math.max(0, Math.min(raw, 9999));
}

function getMonthlyFeeSaved(userId) {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const since = d.toISOString();
  const trades = getDb().prepare(
    'SELECT sol_amount, fee_sol FROM trades WHERE user_id = ? AND action = ? AND sol_amount < 1000 AND timestamp >= ?'
  ).all(userId, 'sell', since);
  const raw = trades.reduce((acc, t) => acc + Math.max(0, (t.sol_amount * 0.01) - t.fee_sol), 0);
  return Math.max(0, Math.min(raw, 9999));
}

function getPeriodStats(userId, days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const since = d.toISOString();
  const trades = getDb().prepare(
    "SELECT * FROM trades WHERE user_id = ? AND action = 'sell' AND sol_amount < 1000 AND timestamp >= ? AND status = 'confirmed'"
  ).all(userId, since);
  
  let pnl = 0, wins = 0, bestTrade = 0, worstTrade = 0, totalFees = 0, streak = 0, currentStreak = 0;
  let lastWin = null;
  
  trades.forEach(t => {
    const net = t.sol_amount - t.fee_sol;
    pnl += net;
    totalFees += t.fee_sol;
    if (net > bestTrade) bestTrade = net;
    if (net < worstTrade) worstTrade = net;
    if (net > 0) {
      wins++;
      if (lastWin === true) currentStreak++;
      else currentStreak = 1;
    } else {
      if (lastWin === false) currentStreak--;
      else currentStreak = -1;
    }
    lastWin = net > 0;
    if (Math.abs(currentStreak) > Math.abs(streak)) streak = currentStreak;
  });

  return {
    pnl,
    trades: trades.length,
    wins,
    winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
    bestTrade,
    worstTrade,
    totalFees,
    streak,
    avgTrade: trades.length > 0 ? pnl / trades.length : 0,
  };
}
function getDailyFeeSaved(userId) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const since = today.toISOString();
  const trades = getDb().prepare(
    'SELECT sol_amount, fee_sol FROM trades WHERE user_id = ? AND action = ? AND sol_amount < 1000 AND timestamp >= ?'
  ).all(userId, 'sell', since);
  const raw = trades.reduce((acc, t) => acc + Math.max(0, (t.sol_amount * 0.01) - t.fee_sol), 0);
  return Math.max(0, Math.min(raw, 9999));
}

// ── LEADERBOARD ──────────────────────────────────────────────
function _periodStart(period) {
  // Return "YYYY-MM-DD HH:MM:SS" to match SQLite timestamp format (not ISO with T/Z)
  const fmt = (dt) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`;
  };
  const now = new Date();
  if (period === "day") { now.setHours(0,0,0,0); return fmt(now); }
  if (period === "week") { const day = now.getDay(); const diff = now.getDate() - day + (day === 0 ? -6 : 1); const monday = new Date(now.setDate(diff)); monday.setHours(0,0,0,0); return fmt(monday); }
  if (period === "month") { return fmt(new Date(now.getFullYear(), now.getMonth(), 1)); }
  return "1970-01-01 00:00:00"; // all-time fallback
}

function _lbName(userId) {
  const s = getDb().prepare("SELECT lb_display_name, lb_anonymous FROM settings WHERE user_id = ?").get(userId);
  if (s && s.lb_anonymous) return "Anonymous";
  if (s && s.lb_display_name) return s.lb_display_name;
  const u = getUser(userId);
  return u && u.username ? "@" + u.username.replace(/^@/, "") : "Trader";
}

function getVolumeLeaderboard(period = "week", limit = 10) {
  const start = _periodStart(period);
  const rows = getDb().prepare(
    "SELECT user_id, COALESCE(SUM(sol_amount),0) vol, COUNT(*) trades FROM trades WHERE status='confirmed' AND timestamp >= ? GROUP BY user_id HAVING vol > 0 ORDER BY vol DESC LIMIT ?"
  ).all(start, limit);
  return rows.map((r, i) => {
    const u = getUser(r.user_id);
    return { position: i + 1, userId: r.user_id, name: _lbName(r.user_id), rank: u ? u.rank : 1, volume: r.vol, trades: r.trades, referrals: getReferralCount(r.user_id) };
  });
}

function getReferralLeaderboard(period = "week", limit = 10) {
  // Referral board is ALWAYS total count (period does not filter referrals).
  const rows = getDb().prepare(
    "SELECT referrer_id user_id, COUNT(*) refs FROM users WHERE referrer_id IS NOT NULL GROUP BY referrer_id ORDER BY refs DESC LIMIT ?"
  ).all(limit);
  return rows.map((r, i) => {
    const u = getUser(r.user_id);
    const vol = getDb().prepare("SELECT COALESCE(SUM(sol_amount),0) v FROM trades WHERE user_id=? AND status='confirmed'").get(r.user_id).v;
    return { position: i + 1, userId: r.user_id, name: _lbName(r.user_id), rank: u ? u.rank : 1, referrals: r.refs, volume: vol };
  });
}

function getReferralCount(userId) {
  const r = getDb().prepare("SELECT COUNT(*) c FROM users WHERE referrer_id = ?").get(userId);
  return r ? r.c : 0;
}

function getUserVolumeRank(userId, period = "week") {
  const start = _periodStart(period);
  const myVol = getDb().prepare("SELECT COALESCE(SUM(sol_amount),0) v FROM trades WHERE user_id=? AND status='confirmed' AND timestamp >= ?").get(userId, start).v;
  const ahead = getDb().prepare(
    "SELECT COUNT(*) c FROM (SELECT user_id, SUM(sol_amount) vol FROM trades WHERE status='confirmed' AND timestamp >= ? GROUP BY user_id HAVING vol > ?)"
  ).get(start, myVol).c;
  return { position: ahead + 1, volume: myVol, referrals: getReferralCount(userId) };
}

function setLbDisplayName(userId, name) {
  getDb().prepare("UPDATE settings SET lb_display_name = ?, lb_anonymous = 0 WHERE user_id = ?").run(name, userId);
}
function setLbAnonymous(userId, anon) {
  getDb().prepare("UPDATE settings SET lb_anonymous = ? WHERE user_id = ?").run(anon ? 1 : 0, userId);
}
function getLbSettings(userId) {
  return getDb().prepare("SELECT lb_display_name, lb_anonymous FROM settings WHERE user_id = ?").get(userId) || {};
}


// ── ADMIN: TRACKED TOKENS + REWARDS ──────────────────────────
function addTrackedToken(ca, label, adminId) {
  try {
    getDb().prepare("INSERT OR IGNORE INTO tracked_tokens (token_ca, label, added_by) VALUES (?, ?, ?)").run(ca, label || '', adminId);
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}
function getTrackedTokens() {
  return getDb().prepare("SELECT * FROM tracked_tokens WHERE active=1 ORDER BY created_at DESC").all();
}
function removeTrackedToken(id) {
  getDb().prepare("UPDATE tracked_tokens SET active=0 WHERE id=?").run(id);
}
function getTrackedTokenTraders(ca) {
  return getDb().prepare(
    "SELECT user_id, COALESCE(SUM(sol_amount),0) vol, COUNT(*) trades FROM trades WHERE token_ca=? AND status='confirmed' GROUP BY user_id ORDER BY vol DESC"
  ).all(ca).map(r => {
    const u = getUser(r.user_id);
    return { userId: r.user_id, name: u && u.username ? '@'+u.username : 'user'+r.user_id, rank: u?u.rank:1, volume: r.vol, trades: r.trades };
  });
}
function logReward(userId, tokenCa, type, amount, reason, adminId, txHash) {
  getDb().prepare("INSERT INTO reward_log (user_id, token_ca, reward_type, amount, reason, sent_by, tx_hash) VALUES (?,?,?,?,?,?,?)")
    .run(userId, tokenCa||'', type, amount, reason||'', adminId, txHash||'');
}
function getRewardHistory(limit=20) {
  return getDb().prepare("SELECT * FROM reward_log ORDER BY created_at DESC LIMIT ?").all(limit);
}
function alreadyRewarded(userId, reason) {
  const r = getDb().prepare("SELECT 1 FROM reward_log WHERE user_id=? AND reason=? LIMIT 1").get(userId, reason);
  return !!r;
}


// ── AIRDROP: RICH TRADER ANALYTICS ───────────────────────────
function getTokenTraderAnalytics(ca) {
  // Per-user stats for a token, derived from the trades table
  const rows = getDb().prepare(`
    SELECT user_id, wallet_id,
      COALESCE(SUM(sol_amount),0) volume,
      SUM(CASE WHEN action='buy' THEN 1 ELSE 0 END) buys,
      SUM(CASE WHEN action='sell' THEN 1 ELSE 0 END) sells,
      SUM(CASE WHEN action='buy' THEN token_amount ELSE 0 END) bought_tokens,
      SUM(CASE WHEN action='sell' THEN token_amount ELSE 0 END) sold_tokens,
      MIN(timestamp) first_trade,
      MAX(timestamp) last_trade,
      MIN(CASE WHEN action='buy' THEN timestamp END) first_buy,
      MAX(CASE WHEN action='sell' THEN timestamp END) last_sell
    FROM trades
    WHERE token_ca=? AND status='confirmed'
    GROUP BY user_id, wallet_id
    ORDER BY volume DESC
  `).all(ca);

  return rows.map(r => {
    const u = getUser(r.user_id);
    const w = getDb().prepare("SELECT public_key FROM wallets WHERE wallet_id=?").get(r.wallet_id);
    // Hold time: first buy -> last sell (or now if still holding)
    let holdDays = 0, stillHolding = false;
    if (r.first_buy) {
      const start = new Date(r.first_buy).getTime();
      const end = r.last_sell ? new Date(r.last_sell).getTime() : Date.now();
      holdDays = Math.max(0, (end - start) / 86400000);
      stillHolding = (r.bought_tokens - r.sold_tokens) > 0.000001;
    }
    return {
      userId: r.user_id,
      walletId: r.wallet_id,
      wallet: w ? w.public_key : '',
      name: u && u.username ? '@'+u.username : 'user'+r.user_id,
      rank: u ? u.rank : 1,
      volume: r.volume,
      buys: r.buys,
      sells: r.sells,
      netTokens: r.bought_tokens - r.sold_tokens,
      holdDays: Math.round(holdDays * 10) / 10,
      stillHolding,
      firstTrade: r.first_trade,
      lastTrade: r.last_trade,
    };
  });
}

// Apply criteria tiers to traders. criteria = [{field, op, value, amount}], mode = 'stack'|'highest'
function applyCriteria(traders, criteria, mode) {
  const results = [];
  for (const t of traders) {
    const matched = [];
    for (const c of criteria) {
      let val;
      if (c.field === 'volume') val = t.volume;
      else if (c.field === 'buys') val = t.buys;
      else if (c.field === 'sells') val = t.sells;
      else if (c.field === 'holdDays') val = t.holdDays;
      else if (c.field === 'any') { matched.push(c); continue; }
      else continue;
      let ok = false;
      if (c.op === '>=') ok = val >= c.value;
      else if (c.op === '>') ok = val > c.value;
      else if (c.op === '<=') ok = val <= c.value;
      else if (c.op === '<') ok = val < c.value;
      else if (c.op === '==') ok = val == c.value;
      if (ok) matched.push(c);
    }
    if (!matched.length) continue;
    let amount = 0, tierLabel = '';
    if (mode === 'highest') {
      const best = matched.reduce((a,b) => b.amount > a.amount ? b : a);
      amount = best.amount; tierLabel = best.label || (best.field+best.op+best.value);
    } else { // stack
      amount = matched.reduce((s,c) => s + c.amount, 0);
      tierLabel = matched.map(c => c.label || (c.field+c.op+c.value)).join('+');
    }
    results.push({ wallet: t.wallet, name: t.name, userId: t.userId, amount, tier: tierLabel, volume: t.volume, buys: t.buys, sells: t.sells, holdDays: t.holdDays });
  }
  return results;
}

function saveSnapshot(ca, label, criteria, rows, rewardType, adminId) {
  const total = rows.reduce((s,r) => s + r.amount, 0);
  const info = getDb().prepare("INSERT INTO airdrop_snapshots (token_ca, label, criteria_json, rows_json, total_amount, recipient_count, reward_type, created_by) VALUES (?,?,?,?,?,?,?,?)")
    .run(ca, label||'', JSON.stringify(criteria), JSON.stringify(rows), total, rows.length, rewardType, adminId);
  return info.lastInsertRowid;
}
function getSnapshot(id) {
  const s = getDb().prepare("SELECT * FROM airdrop_snapshots WHERE id=?").get(id);
  if (s) { s.criteria = JSON.parse(s.criteria_json||'[]'); s.rows = JSON.parse(s.rows_json||'[]'); }
  return s;
}
function getSnapshots(limit=20) {
  return getDb().prepare("SELECT id, token_ca, label, total_amount, recipient_count, reward_type, created_at FROM airdrop_snapshots ORDER BY created_at DESC LIMIT ?").all(limit);
}


function getTokenName(ca) {
  const r = getDb().prepare("SELECT token_name FROM trades WHERE token_ca=? AND token_name IS NOT NULL AND token_name != '' ORDER BY timestamp DESC LIMIT 1").get(ca);
  return r && r.token_name ? r.token_name : ca.slice(0,8);
}

// ── TRENDING TOKENS (admin) ──────────────────────────────────
function getTrendingTokens(hours = 24, limit = 10) {
  const since = new Date(Date.now() - hours*3600000).toISOString().replace('T',' ').slice(0,19);
  return getDb().prepare(`
    SELECT token_ca, token_name,
      COUNT(DISTINCT user_id) buyers,
      COUNT(*) trades,
      COALESCE(SUM(sol_amount),0) volume
    FROM trades
    WHERE action='buy' AND status='confirmed' AND timestamp >= ?
    GROUP BY token_ca
    ORDER BY buyers DESC, volume DESC
    LIMIT ?
  `).all(since, limit);
}

// ── PRICE-MOVEMENT NOTIFICATIONS ─────────────────────────────
// Each user's open positions with entry price, for the notifier to compare vs live price.
function getAllOpenPositionsForNotify() {
  return getDb().prepare(`
    SELECT position_id, user_id, token_ca, token_name, buy_price, wallet_id
    FROM positions
    WHERE token_amount > 0 AND buy_price > 0 AND status='open'
  `).all();
}

let _solPxC = { px: 0, t: 0 };
async function getSolPriceUsdShared() {
  if (Date.now() - _solPxC.t < 60000 && _solPxC.px > 0) return _solPxC.px;
  const axios = require("axios");
  try {
    const { data } = await axios.get("https://lite-api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112", { timeout: 5000 });
    const px = parseFloat(data?.data?.["So11111111111111111111111111111111111111112"]?.price || 0);
    if (px > 0) { _solPxC = { px, t: Date.now() }; return px; }
  } catch {}
  return _solPxC.px || 200;
}

module.exports = {
  getSolPriceUsdShared,
  getTrendingTokens, getAllOpenPositionsForNotify, getTokenName,
  getTokenTraderAnalytics, applyCriteria, saveSnapshot, getSnapshot, getSnapshots,
  addTrackedToken, getTrackedTokens, removeTrackedToken, getTrackedTokenTraders, logReward, getRewardHistory, alreadyRewarded,
  getVolumeLeaderboard, getReferralLeaderboard, getReferralCount, getUserVolumeRank, setLbDisplayName, setLbAnonymous, getLbSettings,
  getDb, getUser, createUser, updateUser, getAllUsers,
  setUserMode, setSapHash, clearSap,
  touchLastActive, isSessionExpired,
  resetTradeRateLimit, incrementTradeRateLimit,
  getSettings, updateSettings,
  addWallet, getWallets, getWallet, getWalletById, countWallets, getWalletBalance,
  getWithdrawalWhitelist, addWithdrawalWhitelist, removeWithdrawalWhitelist,
  recordTrade, getTradeHistory, getCopyWalletTrades, getCopySellPresets, getCopySellPreset, saveCopySellPreset, deleteCopySellPreset, getLaunches, getLaunch, createLaunch, updateLaunch, deleteLaunch, getTradeHistoryFiltered,
  getTodayStats, getUserStats, getWeeklyPnl, getMonthlyPnl,
  openPosition, getOpenPositions, getPositionsBySource,
  closePosition, getAllOpenPositions, setPositionNote, getPosition,
  buildReferralChain, getReferralChain, addReferralEarning,
  getPendingEarnings, getTotalEarnings, getPaidEarnings,
  getDirectReferralCount, getUserByUsername, getUserByReferralCode, ensureReferralCode, setCustomCode, markEarningsPaid, claimEarnings, getAllPendingPayouts, checkReferralMilestone,
  getWatchlist, addToWatchlist, removeFromWatchlist,
  getCopyWallets, addCopyWallet, deleteCopyWallet, toggleCopyWallet, updateCopyWallet,
  getCopyChannels, addCopyChannel, deleteCopyChannel, updateCopyChannel,
  toggleCopyChannel, getCopyChannel,
  getSniperConfigs, createSniperConfig, updateSniperConfig, deleteSniperConfig,
  getSniperConfig, pauseAllSnipes, getActiveSnipes, addSnipe, getRealtimeSniperConfig, updateRealtimeSniperConfig, cancelSnipe,
  getLimitOrders, addLimitOrder, setLimitOrderExpiry, cancelLimitOrder, pauseLimitOrder,
  getDcaOrders, addDcaOrder, pauseDcaOrder, cancelDcaOrder, getAllActiveDca, recordDcaBuy,
  getAutoSellTemplates, getAutoSellTemplate, createAutoSellTemplate,
    updateAutoSellTemplate, deleteAutoSellTemplate,
    getAutoSellRules, addAutoSellRule, deleteAutoSellRule,
  getSysConfig, setSysConfig, addVolume,
  getGlobalBlacklist, addGlobalBlacklist, getUserBlacklist, getUserWhitelist,
  flagSuspicious, getTotalUsers, getRankDistribution, getRevenue,
  getPriceAlerts, addPriceAlert, getDailyFeeSaved, getWeeklyFeeSaved, getMonthlyFeeSaved, getPeriodStats,
  getWalletTrackers, addWalletTracker, removeWalletTracker,
};
