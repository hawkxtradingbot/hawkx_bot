// M08 — Rank System (Devnet: lowered thresholds for fast testing)
const cron = require("node-cron");
const db = require("../../database");
const config = require("../../config");
const { t } = require("./i18n");

function getFeeRate(user) {
  // Rule 2 — Trial first
  if (user.trial_active) return config.FEE_RATES.trial;
  if (user.rank === 1 && user.joiner_discount)
    return config.FEE_RATES.scoutReferral;
  const rankKey = config.RANK_FEE_KEYS[user.rank] || "scout";
  return config.FEE_RATES[rankKey];
}

function getRankName(rankNum, lang = "en") {
  const keys = {
    1: "rank.scout",
    2: "rank.tracker",
    3: "rank.hunter",
    4: "rank.predator",
    5: "rank.apex",
    6: "rank.hawk",
    7: "rank.hawkelite",
  };
  return t(keys[rankNum] || "rank.scout", lang);
}

function checkAndPromote(userId, notifyCallback) {
  const user = db.getUser(userId);
  if (!user) return false;

  let newRank = 1;
  for (let r = 7; r >= 1; r--) {
    if (user.cumulative_volume_sol >= config.RANK_THRESHOLDS[r]) {
      newRank = r;
      break;
    }
  }

  if (newRank > user.rank) {
    db.updateUser(userId, { rank: newRank });
    if (notifyCallback) {
      const rankKey = config.RANK_FEE_KEYS[newRank];
      const fee = (config.FEE_RATES[rankKey] * 100).toFixed(2);
      const rankName = config.RANK_NAMES[newRank];
      notifyCallback(userId, "RANK_UP", {
        rank: rankName,
        num: newRank,
        volume: user.cumulative_volume_sol.toFixed(2),
        fee,
        tagline: "",
        username: user.username || "Trader",
      });
    }
    return true;
  }
  return false;
}

function startTrialCron(bot) {
  // Runs every minute in devnet for fast testing
  cron.schedule("* * * * *", async () => {
    const users = db.getAllUsers();
    for (const user of users) {
      if (!user.trial_active) continue;
      const joinDate = new Date(user.join_date);
      const daysSince =
        (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= 7) {
        db.updateUser(user.user_id, { trial_active: 0 });
        try {
          await bot.api.sendMessage(
            user.user_id,
            t("trial.expired", user.language),
            { parse_mode: "Markdown" },
          );
        } catch {}
      }
    }
  });
}

function startRankCron(notifyCallback) {
  cron.schedule(config.RANK_CHECK_CRON, () => {
    const users = db.getAllUsers();
    for (const user of users) checkAndPromote(user.user_id, notifyCallback);
  });
}

module.exports = {
  getFeeRate,
  getRankName,
  checkAndPromote,
  startTrialCron,
  startRankCron,
};
