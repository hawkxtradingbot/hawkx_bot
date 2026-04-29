// M09 — Referrals V12
// Standard L1=30%, Promoter L1=35%
// Rank 1 joiner discount = 10% fee reduction
// 12hr payout cron

const cron   = require("node-cron");
const db     = require("../../database");
const config = require("../../config");

const STANDARD_RATES  = [0.30, 0.04, 0.03, 0.02, 0.015, 0.01];
const PROMOTER_L1_RATE = 0.35;

function getReferralRate(referrerId, level) {
  const referrer = db.getUser(referrerId);
  if (!referrer) return STANDARD_RATES[level] || 0;
  if (level === 0 && referrer.promoter_status === 1) return PROMOTER_L1_RATE;
  return STANDARD_RATES[level] || 0;
}

function creditReferralEarnings(userId, tradeId, feeSol) {
  if (!feeSol || feeSol <= 0) return;
  let currentId = userId;
  for (let level = 0; level < 6; level++) {
    const user = db.getUser(currentId);
    if (!user || !user.referrer_id) break;
    const referrerId = user.referrer_id;
    const rate       = getReferralRate(referrerId, level);
    const earning    = feeSol * rate;
    if (earning > 0) {
      db.addReferralEarning({
        userId:     referrerId,
        fromUserId: userId,
        level:      level + 1,
        feeSol,
        earnedSol:  earning,
        tradeId,
      });
    }
    currentId = referrerId;
  }
}

// 10% discount for rank 1 joiners via referral
function applyJoinerDiscount(userId) {
  const user = db.getUser(userId);
  if (!user || user.rank !== 1 || !user.referrer_id) return;
  if (user.joiner_discount) return;
  db.updateUser(userId, { joiner_discount: 1 });
}

function addPromoter(userId) {
  const count = db.getDb()
    .prepare("SELECT COUNT(*) as cnt FROM users WHERE promoter_status = 1")
    .get()?.cnt || 0;
  if (count >= 100) return { error: "Max 100 promoter slots." };
  db.updateUser(userId, { promoter_status: 1 });
  return { success: true };
}

function removePromoter(userId) {
  db.updateUser(userId, { promoter_status: 0 });
  return { success: true };
}

function startPayoutCron(bot) {
  cron.schedule("0 */12 * * *", async () => {
    console.log("[Referrals] Starting 12hr payout cron...");
    const payouts = db.getAllPendingPayouts();
    let count     = 0;

    for (const payout of payouts) {
      if ((payout.total || 0) < (config.MIN_PAYOUT_SOL || 0.001)) continue;
      db.markEarningsPaid(payout.user_id);
      count++;
      try {
        await bot.api.sendMessage(
          payout.user_id,
          `💰 *Referral Payout!*\n\n` +
          `You received *${payout.total.toFixed(6)} SOL* in referral earnings.\n\n` +
          `_[DEVNET — simulated payout]_`,
          { parse_mode: "Markdown" }
        );
      } catch {}
    }
    console.log(`[Referrals] Payout cron done. Paid ${count} users.`);
  });
  console.log("[Referrals] ✅ 12hr payout cron started");
}

module.exports = {
  creditReferralEarnings,
  applyJoinerDiscount,
  addPromoter,
  removePromoter,
  getReferralRate,
  startPayoutCron,
};
