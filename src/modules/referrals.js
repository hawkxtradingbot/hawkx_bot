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
  if (level === 0 && referrer.promoter_status === 1) {
    const custom = referrer.promoter_rate;
    if (custom && custom > 0) return custom;
    return PROMOTER_L1_RATE;
  }
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
  // Auto-payout cron DISABLED — users now claim earnings manually (#16).
  // Code kept for reference / possible future use.
  console.log("[Referrals] ℹ️ Auto-payout cron disabled — manual claim enabled");
}

module.exports = {
  creditReferralEarnings,
  applyJoinerDiscount,
  addPromoter,
  removePromoter,
  getReferralRate,
  startPayoutCron,
};
