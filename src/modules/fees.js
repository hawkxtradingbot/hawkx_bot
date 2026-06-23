const db     = require('../../database');
const config = require('../../config');
const { getFeeRate }           = require('./ranks');
const { creditReferralEarnings } = require('./referrals');

async function collectFee(userId, tradeId, solAmount) {
  const user = db.getUser(userId);
  if (!user) return 0;

  // Pure rank-based fee — no trial
  const feeRate  = getFeeRate(user);
  const feeSol   = solAmount * feeRate;
  const rankName = config.RANK_NAMES[user.rank] || "Scout";

  console.log(
    `[Fee] User ${userId} | ${rankName} | ` +
    `${(feeRate * 100).toFixed(2)}% | ` +
    `${feeSol.toFixed(6)} SOL — simulated`
  );

  creditReferralEarnings(userId, tradeId, feeSol);
  return feeSol;
}

module.exports = { collectFee };
