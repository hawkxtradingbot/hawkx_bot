// M09 — Referral System
const cron = require("node-cron");
const db = require("../../database");
const config = require("../../config");

function creditReferralEarnings(userId, tradeId, feeSol) {
  const chain = db.getReferralChain(userId);
  chain.forEach((entry) => {
    const rate = config.REFERRAL_RATES[entry.level - 1];
    if (!rate) return;
    db.addReferralEarning({
      userId: entry.referral_user_id,
      fromUserId: userId,
      level: entry.level,
      feeSol,
      earnedSol: feeSol * rate,
      tradeId,
    });
  });
}

async function runDailyPayout(notifyCallback) {
  console.log("[Payout] Running devnet referral payouts...");
  const payouts = db.getAllPendingPayouts();
  for (const payout of payouts) {
    if (payout.total < config.MIN_PAYOUT_SOL) continue;
    db.markEarningsPaid(payout.user_id);
    console.log(
      `[Payout] DEVNET: User ${payout.user_id} → ${payout.total.toFixed(6)} SOL (simulated)`,
    );
    if (notifyCallback) {
      notifyCallback(payout.user_id, "DAILY_PAYOUT", {
        sol: payout.total.toFixed(4),
      });
    }
  }
}

function startDailyPayoutCron(notifyCallback) {
  cron.schedule(config.DAILY_PAYOUT_CRON, () => runDailyPayout(notifyCallback));
}

function getReferralStats(userId) {
  const chain = db.getReferralChain(userId);
  const pending = db.getPendingEarnings(userId);
  const allTime = db
    .getDb()
    .prepare(
      "SELECT SUM(earned_sol) as total FROM referral_earnings WHERE user_id = ?",
    )
    .get(userId);
  return {
    chain,
    pending: pending?.total || 0,
    allTime: allTime?.total || 0,
    referralLink: `https://t.me/YourBot?start=REF_${userId}`,
  };
}

module.exports = {
  creditReferralEarnings,
  runDailyPayout,
  startDailyPayoutCron,
  getReferralStats,
};
