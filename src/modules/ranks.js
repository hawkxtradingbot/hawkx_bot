const cron   = require("node-cron");
const db     = require("../../database");
const config = require("../../config");

// ── Fee rate by rank only — no trial ────────────────────────
function getFeeRate(user) {
  if (!user) return config.FEE_RATES.rank1;
  const rankKey = config.RANK_FEE_KEYS[user.rank] || "rank1";
  return config.FEE_RATES[rankKey];
}

// ── Get rank name from config ────────────────────────────────
function getRankName(rankNum) {
  return config.RANK_NAMES[rankNum] || config.RANK_NAMES[1];
}

// ── Check volume and promote user ───────────────────────────
function checkAndPromote(userId, notifyCallback) {
  const user = db.getUser(userId);
  if (!user) return false;

  const vol = Math.max(0, user.cumulative_volume_sol || 0);
  let newRank = 1;

  for (let r = 7; r >= 1; r--) {
    if (vol >= config.RANK_THRESHOLDS[r]) {
      newRank = r;
      break;
    }
  }

  if (newRank > user.rank) {
    db.updateUser(userId, { rank: newRank });

    if (notifyCallback) {
      const rankKey  = config.RANK_FEE_KEYS[newRank];
      const fee      = (config.FEE_RATES[rankKey] * 100).toFixed(2);
      const rankName = config.RANK_NAMES[newRank];
      notifyCallback(userId, "RANK_UP", {
        rankName,
        newRank,
        oldRank: user.rank,
        fee,
        username: user.username || "Trader",
      });
    }
    return true;
  }
  return false;
}

// ── Rank cron ────────────────────────────────────────────────
function startRankCron(notifyCallback) {
  cron.schedule(config.RANK_CHECK_CRON, () => {
    const users = db.getAllUsers();
    for (const user of users) {
      checkAndPromote(user.user_id, notifyCallback);
    }
  });
  console.log("[Ranks] ✅ Rank cron started — checking every 2 min");
}

// startTrialCron REMOVED — #01

module.exports = {
  getFeeRate,
  getRankName,
  checkAndPromote,
  startRankCron,
};
