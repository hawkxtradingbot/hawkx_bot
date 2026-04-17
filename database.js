// database.js — HawkX V10 Devnet
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const config = require("./config");

let db;

function getDb() {
  if (!db) {
    db = new Database(config.DB_PATH);
    db.pragma("journal_mode = WAL");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    db.exec(schema);
    console.log("[DB] SQLite ready:", config.DB_PATH);
  }
  return db;
}

function getUser(userId) {
  return getDb().prepare("SELECT * FROM users WHERE user_id = ?").get(userId);
}

function createUser(userId, username, language, referrerId, joinerDiscount) {
  const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  getDb()
    .prepare(
      `
    INSERT OR IGNORE INTO users
    (user_id, username, language, rank, cumulative_volume_sol, trial_active, trial_end_date, referrer_id, joiner_discount)
    VALUES (?, ?, ?, 1, 0, 1, ?, ?, ?)
  `,
    )
    .run(
      userId,
      username || "",
      language || "en",
      trialEnd,
      referrerId || null,
      joinerDiscount ? 1 : 0,
    );

  getDb()
    .prepare("INSERT OR IGNORE INTO settings (user_id) VALUES (?)")
    .run(userId);
  return getUser(userId);
}

function updateUser(userId, fields) {
  const keys = Object.keys(fields);
  const set = keys.map((k) => `${k} = ?`).join(", ");
  getDb()
    .prepare(`UPDATE users SET ${set} WHERE user_id = ?`)
    .run(...keys.map((k) => fields[k]), userId);
}

function getAllUsers() {
  return getDb().prepare("SELECT * FROM users").all();
}

function getSettings(userId) {
  return getDb()
    .prepare("SELECT * FROM settings WHERE user_id = ?")
    .get(userId);
}

function updateSettings(userId, fields) {
  const keys = Object.keys(fields);
  const set = keys.map((k) => `${k} = ?`).join(", ");
  getDb()
    .prepare(`UPDATE settings SET ${set} WHERE user_id = ?`)
    .run(...keys.map((k) => fields[k]), userId);
}

function addWallet(userId, publicKey, encKey, salt, iv, tag, label) {
  const result = getDb()
    .prepare(
      `
    INSERT INTO wallets (user_id, public_key, encrypted_private_key, encryption_salt, encryption_iv, encryption_tag, label)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(userId, publicKey, encKey, salt, iv, tag, label || "Wallet");
  return result.lastInsertRowid;
}

function getWallets(userId) {
  return (
    getDb().prepare("SELECT * FROM wallets WHERE user_id = ?").all(userId) || []
  );
}

function getWallet(walletId) {
  return getDb()
    .prepare("SELECT * FROM wallets WHERE wallet_id = ?")
    .get(walletId);
}

function countWallets(userId) {
  return getDb()
    .prepare("SELECT COUNT(*) as cnt FROM wallets WHERE user_id = ?")
    .get(userId).cnt;
}

function recordTrade(data) {
  const result = getDb()
    .prepare(
      `
    INSERT INTO trades (user_id, wallet_id, token_ca, token_name, platform, action,
      sol_amount, token_amount, price_sol, fee_sol, fee_rate, tx_hash, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      data.userId,
      data.walletId,
      data.tokenCa,
      data.tokenName || "Unknown",
      data.platform || "devnet_mock",
      data.action,
      data.solAmount,
      data.tokenAmount || 0,
      data.priceSol || 0,
      data.feeSol || 0,
      data.feeRate || 0,
      data.txHash || "DEVNET_MOCK_TX",
      data.status || "confirmed",
    );
  return result.lastInsertRowid;
}

function getTradeHistory(userId, limit = 20) {
  return getDb()
    .prepare(
      "SELECT * FROM trades WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?",
    )
    .all(userId, limit);
}

function openPosition(data) {
  const s = getSettings(data.userId);
  return getDb()
    .prepare(
      `
    INSERT INTO positions (user_id, wallet_id, token_ca, token_name, buy_price,
      sol_invested, token_amount, platform, stop_loss_pct, take_profit_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      data.userId,
      data.walletId,
      data.tokenCa,
      data.tokenName || "Unknown",
      data.buyPrice || 0,
      data.solInvested,
      data.tokenAmount || 1000000,
      data.platform || "devnet_mock",
      s ? s.stop_loss_pct : -30,
      s ? s.take_profit_pct : 150,
    );
}

function getOpenPositions(userId) {
  return getDb()
    .prepare("SELECT * FROM positions WHERE user_id = ? AND status = 'open'")
    .all(userId);
}

function closePosition(positionId) {
  getDb()
    .prepare("UPDATE positions SET status = 'closed' WHERE position_id = ?")
    .run(positionId);
}

function getAllOpenPositions() {
  return getDb().prepare("SELECT * FROM positions WHERE status = 'open'").all();
}

function buildReferralChain(userId, referrerId) {
  if (!referrerId) return;
  const insert = getDb().prepare(
    "INSERT OR IGNORE INTO referral_chain (user_id, level, referral_user_id) VALUES (?, ?, ?)",
  );
  let currentId = referrerId;
  for (let level = 1; level <= 6; level++) {
    if (!currentId) break;
    insert.run(userId, level, currentId);
    const parent = getUser(currentId);
    currentId = parent ? parent.referrer_id : null;
  }
}

function getReferralChain(userId) {
  return getDb()
    .prepare("SELECT * FROM referral_chain WHERE user_id = ?")
    .all(userId);
}

function addReferralEarning(data) {
  getDb()
    .prepare(
      `
    INSERT INTO referral_earnings (user_id, from_user_id, level, fee_sol, earned_sol, trade_id, paid)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `,
    )
    .run(
      data.userId,
      data.fromUserId,
      data.level,
      data.feeSol,
      data.earnedSol,
      data.tradeId,
    );
}

function getPendingEarnings(userId) {
  return getDb()
    .prepare(
      "SELECT SUM(earned_sol) as total FROM referral_earnings WHERE user_id = ? AND paid = 0",
    )
    .get(userId);
}

function markEarningsPaid(userId) {
  getDb()
    .prepare(
      "UPDATE referral_earnings SET paid = 1 WHERE user_id = ? AND paid = 0",
    )
    .run(userId);
}

function getAllPendingPayouts() {
  return getDb()
    .prepare(
      "SELECT user_id, SUM(earned_sol) as total FROM referral_earnings WHERE paid = 0 GROUP BY user_id",
    )
    .all();
}

function getSysConfig(key) {
  const row = getDb()
    .prepare("SELECT value FROM system_config WHERE key = ?")
    .get(key);
  return row ? row.value : null;
}

function setSysConfig(key, value) {
  getDb()
    .prepare("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)")
    .run(key, String(value));
}

function addVolume(userId, solAmount) {
  getDb()
    .prepare(
      "UPDATE users SET cumulative_volume_sol = cumulative_volume_sol + ? WHERE user_id = ?",
    )
    .run(solAmount, userId);
}

function getGlobalBlacklist() {
  return getDb()
    .prepare("SELECT deployer_address FROM global_blacklist")
    .all()
    .map((r) => r.deployer_address);
}

function addGlobalBlacklist(address, adminId, reason) {
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO global_blacklist (deployer_address, added_by_admin, reason) VALUES (?, ?, ?)",
    )
    .run(address, adminId, reason);
}

function getUserBlacklist(userId) {
  return getDb()
    .prepare("SELECT * FROM user_blacklist WHERE user_id = ?")
    .all(userId);
}

function getUserWhitelist(userId) {
  return getDb()
    .prepare("SELECT * FROM user_whitelist WHERE user_id = ?")
    .all(userId);
}

function getTotalUsers() {
  return getDb().prepare("SELECT COUNT(*) as cnt FROM users").get().cnt;
}

function getRankDistribution() {
  return getDb()
    .prepare("SELECT rank, COUNT(*) as cnt FROM users GROUP BY rank")
    .all();
}

function getRevenue(since) {
  return getDb()
    .prepare("SELECT SUM(fee_sol) as total FROM trades WHERE timestamp >= ?")
    .get(since);
}

module.exports = {
  getDb,
  getUser,
  createUser,
  updateUser,
  getAllUsers,
  getSettings,
  updateSettings,
  addWallet,
  getWallets,
  getWallet,
  countWallets,
  recordTrade,
  getTradeHistory,
  openPosition,
  getOpenPositions,
  closePosition,
  getAllOpenPositions,
  buildReferralChain,
  getReferralChain,
  addReferralEarning,
  getPendingEarnings,
  markEarningsPaid,
  getAllPendingPayouts,
  getSysConfig,
  setSysConfig,
  addVolume,
  getGlobalBlacklist,
  addGlobalBlacklist,
  getUserBlacklist,
  getUserWhitelist,
  getTotalUsers,
  getRankDistribution,
  getRevenue,
};
