// M33 — Fee Collection (Devnet — simulated, no real tx)
const db = require('../../database');
const { getFeeRate } = require('./ranks');
const { creditReferralEarnings } = require('./referrals');

async function collectFee(userId, tradeId, solAmount) {
  const user = db.getUser(userId);
  if (!user) return 0;
  const feeRate = getFeeRate(user);
  const feeSol = solAmount * feeRate;
  console.log(`[Fee DEVNET] User ${userId}: ${feeSol.toFixed(6)} SOL (${(feeRate*100).toFixed(2)}%) — simulated`);
  creditReferralEarnings(userId, tradeId, feeSol);
  return feeSol;
}

module.exports = { collectFee };