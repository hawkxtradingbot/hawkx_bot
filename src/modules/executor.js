// M11 — Trade Executor (DEVNET MOCK — simulates all trades)
const db = require('../../database');
const killSwitch = require('./killSwitch');
const { t } = require('./i18n');
const { checkSafety } = require('./safetyChecker');
const { checkHoneypot } = require('./honeypot');
const config = require('../../config');

// Mock price store for devnet positions
const mockPrices = new Map();

function getMockPrice(ca) {
  if (!mockPrices.has(ca)) {
    mockPrices.set(ca, Math.random() * 0.001 + 0.0001); // random starting price
  }
  return mockPrices.get(ca);
}

function simulatePriceMovement(ca) {
  const current = getMockPrice(ca);
  const change = (Math.random() - 0.45) * 0.3; // slight upward bias
  const newPrice = Math.max(current * (1 + change), 0.000001);
  mockPrices.set(ca, newPrice);
  return newPrice;
}

async function mockBuy(ctx, user, ca, solAmount) {
  if (killSwitch.isActive()) {
    await ctx.reply(t('killswitch.active', user.language));
    return null;
  }

  if (!user.active_wallet_id) {
    await ctx.reply('❌ No active wallet. Use /wallets to add one first.');
    return null;
  }

  await ctx.reply(`🔄 Processing devnet buy...\n\nCA: \`${ca.slice(0, 12)}...\``, { parse_mode: 'Markdown' });

  // Run safety checks
  const [honeypot, safety] = await Promise.all([checkHoneypot(ca), checkSafety(ca)]);

  if (honeypot.blocked) {
    await ctx.reply(`🚫 ${t('honeypot.detected', user.language)}`);
    return null;
  }

  if (safety.status === 'BLOCK') {
    await ctx.reply(`🚫 ${t('trade.blocked.safety', user.language, { reason: safety.reason })}`);
    return null;
  }

  const price = getMockPrice(ca);
  const tokenAmount = (solAmount / price) * (0.9 + Math.random() * 0.1); // simulate slippage
  const txHash = `DEVNET_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Fee calculation
  const { getFeeRate } = require('./ranks');
  const feeRate = getFeeRate(user);
  const feeSol = solAmount * feeRate;

  // Record trade
  const tradeId = db.recordTrade({
    userId: user.user_id,
    walletId: user.active_wallet_id,
    tokenCa: ca,
    tokenName: ca.startsWith('DEVNET_') ? 'DevTest Token' : ca.slice(0, 8),
    platform: 'devnet_mock',
    action: 'buy',
    solAmount,
    tokenAmount,
    priceSol: price,
    feeSol,
    feeRate,
    txHash,
    status: 'confirmed',
  });

  // Open position
  db.openPosition({
    userId: user.user_id,
    walletId: user.active_wallet_id,
    tokenCa: ca,
    tokenName: ca.startsWith('DEVNET_') ? 'DevTest' : ca.slice(0, 8),
    buyPrice: price,
    solInvested: solAmount,
    tokenAmount,
    platform: 'devnet_mock',
  });

  // Add volume + rank check
  db.addVolume(user.user_id, solAmount);
  const { checkAndPromote } = require('./ranks');
  checkAndPromote(user.user_id, require('./notifications').notify);

  // Credit referral
  const { creditReferralEarnings } = require('./referrals');
  creditReferralEarnings(user.user_id, tradeId, feeSol);

  await ctx.reply(
    t('trade.buy.success', user.language, {
      token: ca.startsWith('DEVNET_') ? 'DevTest Token' : ca.slice(0, 12),
      sol: solAmount.toFixed(4),
      fee: feeSol.toFixed(6),
      tx: txHash,
    }),
    { parse_mode: 'Markdown' }
  );

  if (safety.status === 'WARNING') {
    await ctx.reply(`⚠️ Safety Warning: ${safety.reason}`);
  }

  return { tradeId, txHash, feeSol };
}

async function mockSell(ctx, user, position) {
  if (killSwitch.isActive()) {
    await ctx.reply(t('killswitch.active', user.language));
    return null;
  }

  const currentPrice = simulatePriceMovement(position.token_ca);
  const pnlPct = position.buy_price > 0
    ? ((currentPrice - position.buy_price) / position.buy_price * 100)
    : 0;
  const solReceived = position.sol_invested * (1 + pnlPct / 100);
  const { getFeeRate } = require('./ranks');
  const feeRate = getFeeRate(user);
  const feeSol = solReceived * feeRate;
  const txHash = `DEVNET_SELL_${Date.now()}`;

  const tradeId = db.recordTrade({
    userId: user.user_id,
    walletId: user.active_wallet_id || position.wallet_id,
    tokenCa: position.token_ca,
    tokenName: position.token_name || 'Unknown',
    platform: 'devnet_mock',
    action: 'sell',
    solAmount: solReceived,
    tokenAmount: position.token_amount,
    priceSol: currentPrice,
    feeSol, feeRate, txHash,
    status: 'confirmed',
  });

  db.closePosition(position.position_id);
  db.addVolume(user.user_id, solReceived);

  const { creditReferralEarnings } = require('./referrals');
  creditReferralEarnings(user.user_id, tradeId, feeSol);

  const { checkAndPromote } = require('./ranks');
  checkAndPromote(user.user_id, require('./notifications').notify);

  await ctx.reply(
    t('trade.sell.success', user.language, {
      token: position.token_name || position.token_ca.slice(0, 8),
      sol: solReceived.toFixed(4),
      pnl: pnlPct.toFixed(1),
      fee: feeSol.toFixed(6),
    }),
    { parse_mode: 'Markdown' }
  );

  return { tradeId, txHash, pnlPct };
}

module.exports = { mockBuy, mockSell, getMockPrice, simulatePriceMovement };