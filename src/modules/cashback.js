// Cashback logic — pure functions, no UI, no fund movement here.
// Config stored in sysConfig (no schema change). Accrual reads existing trades.fee_sol.
const db = require("../../database");

// ── CONFIG (admin-set) ──
function getConfig() {
  return {
    enabled:    db.getSysConfig("cashback_enabled") === "1",
    pct:        parseFloat(db.getSysConfig("cashback_pct") || "0"),      // e.g. 20 = 20%
    mode:       db.getSysConfig("cashback_mode") || "SOL",              // "SOL" | "TOKEN" | "BOTH"
    tokenMint:  db.getSysConfig("cashback_token_mint") || "",           // any SPL mint
    tokenLabel: db.getSysConfig("cashback_token_label") || "TOKEN",
    days:       parseInt(db.getSysConfig("cashback_days") || "0"),      // window length
    startTs:    parseInt(db.getSysConfig("cashback_start_ts") || "0"),  // ms epoch
    minFeeSol:  parseFloat(db.getSysConfig("cashback_min_fee_sol") || "0"),
  };
}
function setConfig(patch) {
  const map = {
    enabled: "cashback_enabled", pct: "cashback_pct", mode: "cashback_mode",
    tokenMint: "cashback_token_mint", tokenLabel: "cashback_token_label",
    days: "cashback_days", startTs: "cashback_start_ts", minFeeSol: "cashback_min_fee_sol",
  };
  for (const k of Object.keys(patch)) {
    if (map[k]) db.setSysConfig(map[k], String(patch[k] === true ? "1" : patch[k] === false ? "0" : patch[k]));
  }
}

// ── WINDOW ──
// Returns {active, startTs, endTs, msLeft}. Offer is active only inside [start, start+days].
function windowInfo() {
  const c = getConfig();
  if (!c.enabled || !c.startTs || !c.days) return { active: false, startTs: 0, endTs: 0, msLeft: 0 };
  const endTs = c.startTs + c.days * 86400000;
  const now = Date.now();
  return { active: now >= c.startTs && now <= endTs, startTs: c.startTs, endTs, msLeft: Math.max(0, endTs - now) };
}

// ── ACCRUAL ── a user's fees paid inside the active window
function feesPaidInWindow(userId) {
  const w = windowInfo();
  if (!w.startTs) return 0;
  const sinceIso = new Date(w.startTs).toISOString().slice(0, 19).replace("T", " ");
  const untilIso = new Date(w.endTs).toISOString().slice(0, 19).replace("T", " ");
  const row = db.getDb().prepare(
    "SELECT SUM(fee_sol) AS total FROM trades WHERE user_id = ? AND status = 'confirmed' AND timestamp >= ? AND timestamp <= ?"
  ).get(userId, sinceIso, untilIso);
  return (row && row.total) ? row.total : 0;
}

// Cashback owed in SOL terms (pct of fees), before any prior claim in this window.
function cashbackOwedSol(userId) {
  const c = getConfig();
  const fees = feesPaidInWindow(userId);
  if (fees < c.minFeeSol) return 0;
  return fees * (c.pct / 100);
}

// Per-window claim key so a user can't double-claim the same window.
function claimKey(userId) {
  const w = windowInfo();
  return `cashback_claimed_${userId}_${w.startTs}`;
}
function alreadyClaimed(userId) {
  return db.getSysConfig(claimKey(userId)) === "1";
}
function markClaimed(userId, sig) {
  db.setSysConfig(claimKey(userId), "1");
  db.setSysConfig(`${claimKey(userId)}_sig`, sig || "");
}

module.exports = { getConfig, setConfig, windowInfo, feesPaidInWindow, cashbackOwedSol, claimKey, alreadyClaimed, markClaimed };
