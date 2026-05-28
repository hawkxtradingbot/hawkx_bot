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
    "ALTER TABLE positions ADD COLUMN source TEXT DEFAULT 'manual'",
    "ALTER TABLE positions ADD COLUMN source_ref TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN promoter_status INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN auto_sell INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN mev_protect INTEGER DEFAULT 1",
    "ALTER TABLE settings ADD COLUMN speed_mode TEXT DEFAULT 'standard'",
    "ALTER TABLE settings ADD COLUMN sell_slippage_pct REAL DEFAULT 10",
    "ALTER TABLE settings ADD COLUMN confirm_trades INTEGER DEFAULT 0",
    "ALTER TABLE settings ADD COLUMN weekly_summary INTEGER DEFAULT 1",
    "ALTER TABLE settings ADD COLUMN jito_tip REAL DEFAULT 0.0075",
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
      "ALTER TABLE settings ADD COLUMN sniper_rt_jito REAL DEFAULT 0.0075",
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
      tip REAL DEFAULT 0.0075,
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
      snipe_tip REAL DEFAULT 0.0075,
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
  return 0;
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

function getTradeHistoryFiltered(userId, days = 1) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return getDb().prepare("SELECT * FROM trades WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp DESC")
    .all(userId, since);
}

function getTodayStats(userId, walletId) {
  const today  = new Date().toISOString().slice(0, 10);
  let query = "SELECT * FROM trades WHERE user_id = ? AND timestamp >= ? AND status = 'confirmed'";
  const params = [userId, today + "T00:00:00.000Z"];
  if (walletId) { query += " AND wallet_id = ?"; params.push(walletId); }
  const trades = getDb().prepare(query).all(...params);

  const sells = trades.filter((t) => t.action === "sell");
  const buys  = trades.filter((t) => t.action === "buy");
  let pnl = 0, wins = 0;
  sells.forEach((t) => {
    pnl += t.sol_amount - t.fee_sol;
    if ((t.sol_amount - t.fee_sol) > 0) wins++;
  });
  buys.forEach((t) => { pnl -= t.sol_amount; });

  return {
    pnl,
    trades: trades.length,
    winRate: sells.length > 0 ? Math.round((wins / sells.length) * 100) : 0,
  };
}

function getUserStats(userId) {
  const trades      = getDb().prepare("SELECT * FROM trades WHERE user_id = ? AND status = 'confirmed'").all(userId);
  const sellTrades  = trades.filter((t) => t.action === "sell");
  let totalPnl = 0, wins = 0, bestPnl = 0, worstPnl = 0;
  sellTrades.forEach((t) => {
    const net = t.sol_amount - t.fee_sol;
    totalPnl += net;
    if (net > 0) wins++;
    if (net > bestPnl)  bestPnl  = net;
    if (net < worstPnl) worstPnl = net;
  });
  const winRate  = sellTrades.length > 0 ? Math.round((wins / sellTrades.length) * 100) : 0;
  return { totalTrades: trades.length, totalPnl, winRate, lossRate: 100 - winRate, bestPnl, worstPnl };
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
  return getDb().prepare("SELECT * FROM positions WHERE user_id = ? AND status = 'open' ORDER BY created_at DESC")
    .all(userId);
}

function getPositionsBySource(userId, source) {
  if (!source || source === "all") return getOpenPositions(userId);
  if (source === "manual") {
    return getDb().prepare(
      "SELECT * FROM positions WHERE user_id = ? AND status = 'open' AND source IN ('manual','sniper','auto_buy') ORDER BY created_at DESC"
    ).all(userId);
  }
  if (source === "channel") {
    return getDb().prepare(
      "SELECT * FROM positions WHERE user_id = ? AND status = 'open' AND source = 'copy_channel' ORDER BY created_at DESC"
    ).all(userId);
  }
  if (source === "copy_wallet") {
    return getDb().prepare(
      "SELECT * FROM positions WHERE user_id = ? AND status = 'open' AND source = 'copy_wallet' ORDER BY created_at DESC"
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

function getDirectReferralCount(userId) {
  return getDb().prepare("SELECT COUNT(*) as cnt FROM users WHERE referrer_id = ?").get(userId)?.cnt || 0;
}

function markEarningsPaid(userId) {
  getDb().prepare("UPDATE referral_earnings SET paid = 1 WHERE user_id = ? AND paid = 0").run(userId);
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
    s.buyAmount || 0.1, s.slippage || 50, s.tip || 0.0075,
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
    jito_tip: Number(s.sniper_rt_jito ?? 0.0075),
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
  getDb().prepare(
    "INSERT INTO limit_orders (user_id, token_ca, token_name, order_type, target_price, target_mcap, sol_amount, sell_pct, active, paused, wallet_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)"
  ).run(userId, data.tokenCa, data.tokenName || "", data.orderType, data.targetPrice || 0, data.targetMcap || 0, data.solAmount || 0.1, data.sellPct || 100, data.walletId || null);
  // Ensure active=1 for all new orders
}

function cancelLimitOrder(userId, id) {
  getDb().prepare("UPDATE limit_orders SET active = -1 WHERE id = ? AND user_id = ?").run(id, userId);
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
module.exports = {
  getDb, getUser, createUser, updateUser, getAllUsers,
  setUserMode, setSapHash, clearSap,
  touchLastActive, isSessionExpired,
  resetTradeRateLimit, incrementTradeRateLimit,
  getSettings, updateSettings,
  addWallet, getWallets, getWallet, getWalletById, countWallets, getWalletBalance,
  getWithdrawalWhitelist, addWithdrawalWhitelist, removeWithdrawalWhitelist,
  recordTrade, getTradeHistory, getTradeHistoryFiltered,
  getTodayStats, getUserStats, getWeeklyPnl, getMonthlyPnl,
  openPosition, getOpenPositions, getPositionsBySource,
  closePosition, getAllOpenPositions, setPositionNote, getPosition,
  buildReferralChain, getReferralChain, addReferralEarning,
  getPendingEarnings, getTotalEarnings, getPaidEarnings,
  getDirectReferralCount, markEarningsPaid, getAllPendingPayouts, checkReferralMilestone,
  getWatchlist, addToWatchlist, removeFromWatchlist,
  getCopyWallets, addCopyWallet, deleteCopyWallet, toggleCopyWallet, updateCopyWallet,
  getCopyChannels, addCopyChannel, deleteCopyChannel, updateCopyChannel,
  toggleCopyChannel, getCopyChannel,
  getSniperConfigs, createSniperConfig, updateSniperConfig, deleteSniperConfig,
  getSniperConfig, pauseAllSnipes, getActiveSnipes, addSnipe, getRealtimeSniperConfig, updateRealtimeSniperConfig, cancelSnipe,
  getLimitOrders, addLimitOrder, cancelLimitOrder, pauseLimitOrder,
  getAutoSellTemplates, getAutoSellTemplate, createAutoSellTemplate,
    updateAutoSellTemplate, deleteAutoSellTemplate,
    getAutoSellRules, addAutoSellRule, deleteAutoSellRule,
  getSysConfig, setSysConfig, addVolume,
  getGlobalBlacklist, addGlobalBlacklist, getUserBlacklist, getUserWhitelist,
  flagSuspicious, getTotalUsers, getRankDistribution, getRevenue,
  getPriceAlerts, addPriceAlert, getDailyFeeSaved, getWeeklyFeeSaved, getMonthlyFeeSaved, getPeriodStats,
  getWalletTrackers, addWalletTracker, removeWalletTracker,
};
