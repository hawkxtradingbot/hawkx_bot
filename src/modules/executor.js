// M11 — Executor V12
// Auto buy OFF by default — only fires if user enabled it
// Rank 1 joiner discount applied to fee
// Source tracking on every position

const db         = require("../../database");
const { InputFile } = require("grammy");
const killSwitch = require("./killSwitch");
const { checkSafety } = require("./safetyChecker");
const config     = require("../../config");

const mockPrices = new Map();

function getMockPrice(ca) {
  if (!mockPrices.has(ca)) mockPrices.set(ca, Math.random() * 0.001 + 0.0001);
  return mockPrices.get(ca);
}

function isRealtimeSniperEnabled(userId) {
  const settings = db.getSettings(userId) || {};
  return (settings.sniper_rt_enabled || 0) === 1;
}

function getRealtimeSniperConfig(userId) {
  return db.getRealtimeSniperConfig(userId) || {};
}

async function executeRealtimeSnipe(ctx, user, tokenCa, meta = {}) {
  if (killSwitch.isActive()) return null;
  if (!user?.active_wallet_id) return null;
  if (!isRealtimeSniperEnabled(user.user_id)) return null;

  const rt = getRealtimeSniperConfig(user.user_id);
  const solAmount = rt.sniper_rt_amount || 0.1;
  const slippage = rt.sniper_rt_slippage || 50;
  const price = getMockPrice(tokenCa);
  const tokenAmount = (solAmount / price) * (1 - slippage / 100) * (0.9 + Math.random() * 0.1);
  const txHash = `DEVNET_RT_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const tokenName = meta.tokenName || tokenCa.slice(0, 8);
  const feeRate = typeof rt.sniper_rt_fee === "number" ? rt.sniper_rt_fee : 0.003;
  const feeSol = solAmount * feeRate;

  db.recordTrade({
    userId: user.user_id,
    walletId: user.active_wallet_id,
    tokenCa,
    tokenName,
    platform: "devnet_mock",
    action: "buy",
    solAmount,
    tokenAmount,
    priceSol: price,
    feeSol,
    feeRate,
    txHash,
    status: "confirmed",
  });

  db.openPosition({
    userId: user.user_id,
    walletId: user.active_wallet_id,
    tokenCa,
    tokenName,
    buyPrice: price,
    solInvested: solAmount,
    tokenAmount,
    platform: "devnet_mock",
    source: "realtime_sniper",
    sourceRef: meta.sourceRef || "",
    entryMcap: meta.entryMcap || 0,
  });

  db.addVolume(user.user_id, solAmount);

  try {
    const { notify } = require("./notifications");
    notify(user.user_id, "TRADE_CONFIRMED", {
      action: "buy",
      token: tokenName,
      sol: solAmount.toFixed(4),
      txHash,
    });
  } catch {}

  return { txHash, solAmount, tokenAmount };
}

function simulatePriceMovement(ca) {
  const current  = getMockPrice(ca);
  const change   = (Math.random() - 0.45) * 0.3;
  const newPrice = Math.max(current * (1 + change), 0.000001);
  mockPrices.set(ca, newPrice);
  return newPrice;
}

function getEffectiveFeeRate(user) {
  const { getFeeRate } = require("./ranks");
  const base = getFeeRate(user);
  if (user.rank === 1 && user.joiner_discount) return +(base * 0.9).toFixed(4);
  return base;
}

function isAutoBuyEnabled(userId) {
  const s = db.getSettings(userId);
  return (s?.auto_buy || 0) === 1;
}

async function mockBuy(ctx, user, ca, solAmount, source, sourceRef) {
  if (killSwitch.isActive()) {
    await ctx.reply("🔴 *Trading Paused*\n\nAdmin has paused trading. Your positions are safe.", { parse_mode: "Markdown" });
    return null;
  }

  if (!user.active_wallet_id) {
    await ctx.reply("❌ No active wallet. Go to Wallets to add one first.");
    return null;
  }

  // Safety check
  const safety = await checkSafety(ca, user.mode || "beginner");
  if (safety.status === "BLOCK") {
    await ctx.reply(
      `🚫 *Trade Blocked — Safety Check*\n\nToken: \`${ca.slice(0,12)}...\`\nReason: *${String(safety.reason||"").replace(/[_*`[\]]/g,"")}*\n\n_Blocked to protect you._`,
      { parse_mode: "Markdown" }
    );
    return null;
  }

  // Show processing message
  const processingMsg = await ctx.reply(
    `🔄 *Processing buy...*\n\nToken: \`${ca.slice(0,12)}...\`\nAmount: *${solAmount} SOL*`,
    { parse_mode: "Markdown" }
  );

  const settings    = db.getSettings(user.user_id) || {};
  const slippage    = settings.slippage_pct || 10;
  const price       = getMockPrice(ca);
  const tokenAmount = (solAmount / price) * (1 - slippage / 100) * (0.9 + Math.random() * 0.1);
  const txHash      = `DEVNET_BUY_${Date.now()}_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  const feeRate     = getEffectiveFeeRate(user);
  const feeSol      = solAmount * feeRate;
  const tokenName   = ca.startsWith("DEVNET_") ? "DevTest" : ca.slice(0,8);
  let entryMcap = 0;
  try {
    const axiosMcap = require("axios");
    const dexRes = await axiosMcap.get(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { timeout: 4000 });
    const pairs  = dexRes.data?.pairs;
    if (pairs && pairs.length > 0) entryMcap = pairs[0].fdv || pairs[0].marketCap || 0;
  } catch {}
  
  const tradeId = db.recordTrade({
    userId: user.user_id, walletId: user.active_wallet_id,
    tokenCa: ca, tokenName, platform: "devnet_mock",
    action: "buy", solAmount, tokenAmount,
    priceSol: price, feeSol, feeRate, txHash, status: "confirmed",
  });

  // Check if position exists — update or create
  const existingPos = db.getDb()
    .prepare("SELECT * FROM positions WHERE user_id = ? AND token_ca = ? AND status = 'open' LIMIT 1")
    .get(user.user_id, ca);

  let positionId;
  if (existingPos) {
    const newSolInvested = existingPos.sol_invested + solAmount;
    const newTokenAmount = existingPos.token_amount + tokenAmount;
    const avgBuyPrice    = newSolInvested / newTokenAmount;
    db.getDb()
      .prepare("UPDATE positions SET sol_invested = ?, token_amount = ?, buy_price = ? WHERE position_id = ?")
      .run(newSolInvested, newTokenAmount, avgBuyPrice, existingPos.position_id);
    positionId = existingPos.position_id;
  } else {
    // Get auto sell template for this position
    let autoSellTemplateId = null;
    const src = source || "manual";
    if (src === "manual" || src === "auto_buy") {
      const s = db.getSettings(user.user_id) || {};
      if (s.auto_sell_enabled) autoSellTemplateId = s.auto_sell_template_id || null;
    } else if (src === "copy_channel" && sourceRef) {
      const ch = db.getDb().prepare("SELECT * FROM copy_channels WHERE channel_id = ? AND user_id = ?").get(sourceRef, user.user_id);
      if (ch?.auto_sell_enabled) autoSellTemplateId = ch.auto_sell_template_id || null;
    } else if (src === "copy_wallet" && sourceRef) {
      const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE user_id = ? AND label = ?").get(user.user_id, sourceRef);
      if (cw?.auto_sell_enabled) autoSellTemplateId = cw.auto_sell_template_id || null;
    }

    const result = db.openPosition({
      userId: user.user_id, walletId: user.active_wallet_id,
      tokenCa: ca, tokenName, buyPrice: price,
      solInvested: solAmount, tokenAmount,
      platform: "devnet_mock",
      source: src,
      sourceRef: sourceRef || "",
      entryMcap,
    });

    positionId = result?.lastInsertRowid || db.getDb()
      .prepare("SELECT position_id FROM positions WHERE user_id = ? AND token_ca = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1")
      .get(user.user_id, ca)?.position_id;

    // Save template to position
    if (autoSellTemplateId && positionId) {
      db.getDb().prepare("UPDATE positions SET auto_sell_template_id = ? WHERE position_id = ?")
        .run(autoSellTemplateId, positionId);
    }
  }

  db.addVolume(user.user_id, solAmount);
  const { checkAndPromote } = require("./ranks");
  checkAndPromote(user.user_id, require("./notifications").notify);
  const { creditReferralEarnings } = require("./referrals");
  creditReferralEarnings(user.user_id, tradeId, feeSol);

  // Update processing → confirmed
  try {
    await ctx.api.editMessageText(
      ctx.chat.id,
      processingMsg.message_id,
      `✅ *Buy Confirmed!*\n\nToken: \`${ca.slice(0,12)}...\`\nAmount: *${solAmount} SOL*`,
      { parse_mode: "Markdown" }
    );
  } catch {}

  if (safety.status === "WARNING") {
    await ctx.reply(`⚠️ *Safety Warning:* ${String(safety.reason||"").replace(/[_*`[\]]/g,"")}`, { parse_mode: "Markdown" });
  }

  // Wait 100ms then delete confirmed message and open position screen
  await new Promise((r) => setTimeout(r, 100));
  try { await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id); } catch {}

  // Open position screen
  if (positionId) {
    const { getTokenPosition } = require("./portfolio");
    const freshUser = db.getUser(user.user_id);
    await getTokenPosition(ctx, freshUser, positionId);
  }

  return { tradeId, txHash, feeSol };
}

async function mockSell(ctx, user, position, pctToSell = 100) {
  if (killSwitch.isActive()) {
    await ctx.reply("🔴 *Trading Paused*", { parse_mode: "Markdown" });
    return null;
  }

  const currentPrice  = simulatePriceMovement(position.token_ca);
  const pnlPct        = position.buy_price > 0
    ? ((currentPrice - position.buy_price) / position.buy_price * 100)
    : 0;
  const sellFraction  = pctToSell / 100;
  const solReceived   = position.sol_invested * (1 + pnlPct / 100) * sellFraction;
  const feeRate       = getEffectiveFeeRate(user);
  const feeSol        = solReceived * feeRate;
  const txHash        = `DEVNET_SELL_${Date.now()}`;

  const tradeId = db.recordTrade({
    userId: user.user_id, walletId: user.active_wallet_id || position.wallet_id,
    tokenCa: position.token_ca, tokenName: position.token_name || "Unknown",
    platform: "devnet_mock", action: "sell",
    solAmount: solReceived, tokenAmount: (position.token_amount || 0) * sellFraction,
    priceSol: currentPrice, feeSol, feeRate, txHash, status: "confirmed",
  });

  if (pctToSell >= 100) {
    db.closePosition(position.position_id);
  } else {
    db.getDb()
      .prepare("UPDATE positions SET sol_invested = sol_invested * ?, token_amount = token_amount * ? WHERE position_id = ?")
      .run(1 - sellFraction, 1 - sellFraction, position.position_id);
  }

  db.addVolume(user.user_id, solReceived);
  const { creditReferralEarnings } = require("./referrals");
  creditReferralEarnings(user.user_id, tradeId, feeSol);
  const { checkAndPromote } = require("./ranks");
  checkAndPromote(user.user_id, require("./notifications").notify);

  const sign = pnlPct >= 0 ? "+" : "";
  await ctx.reply(
    `✅ *Sell Confirmed!* [DEVNET]\n\n` +
    `Token: *${position.token_name || position.token_ca.slice(0,8)}*\n` +
    `Sold: *${pctToSell}%*\n` +
    `Received: *${solReceived.toFixed(4)} SOL*\n` +
    `P&L: *${sign}${pnlPct.toFixed(1)}%*\n` +
    `Fee: *${feeSol.toFixed(6)} SOL*`,
    { parse_mode: "Markdown" }
  );
  // Auto PnL card on every sell
  try {
    const { generatePnlCard } = require("./cardGenerator");
    let exitMcap = 0;
    try {
      const axiosMcap = require("axios");
      const dexRes = await axiosMcap.get(
  `https://api.dexscreener.com/latest/dex/tokens/${position.token_ca}`,
        { timeout: 4000 }
      );
      const pairs = dexRes.data?.pairs;
      if (pairs && pairs.length > 0) exitMcap = pairs[0].fdv || pairs[0].marketCap || 0;
    } catch {}
      const result = await generatePnlCard({
      username:    user.username || "Trader",
      rankNum:     user.rank || 1,
      tokenName:   position.token_name || position.token_ca.slice(0,8),
      pnlPct,
        pnlSol: solReceived - position.sol_invested,
      entryMcap:   position.entry_mcap || 0,
      exitMcap,
      hideAmounts: false,
    });
    const pnlKb = { inline_keyboard: [[
      { text: "🙈 Hide Amounts", callback_data: `pnlcard_toggle_${position.position_id}_1` },
    ]]};
    if (result && result.type === "photo") {
      await ctx.replyWithPhoto(new InputFile(result.buffer, "pnl_card.png"), { reply_markup: pnlKb });
    } else if (result && result.type === "text") {
      await ctx.reply(result.text, { parse_mode: "Markdown", reply_markup: pnlKb });
    }
  } catch {}
  return { tradeId, txHash, pnlPct, solReceived };
}

// Only fires when user explicitly has auto_buy ON
async function handleAutoBuy(ctx, user, ca) {
  if (!isAutoBuyEnabled(user.user_id)) return false;
  const settings  = db.getSettings(user.user_id) || {};
  const solAmount = settings.max_buy_sol || 0.1;
  await ctx.reply(
    `🤖 *Auto Buy triggered*\n\nCA: \`${ca.slice(0,12)}...\`\nAmount: *${solAmount} SOL*`,
    { parse_mode: "Markdown" }
  );
  await mockBuy(ctx, user, ca, solAmount, "auto_buy", "");
  return true;
}

module.exports = { mockBuy, mockSell, getMockPrice, simulatePriceMovement, getEffectiveFeeRate, isAutoBuyEnabled, handleAutoBuy, executeRealtimeSnipe, isRealtimeSniperEnabled };
