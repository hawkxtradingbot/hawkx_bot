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
  if (!mockPrices.has(ca)) {
    // Stable price based on CA hash — same price every restart
    let hash = 0;
    for (let i = 0; i < ca.length; i++) hash = ((hash << 5) - hash) + ca.charCodeAt(i);
    const stable = Math.abs(hash % 10000) / 10000000 + 0.000001;
    mockPrices.set(ca, stable);
  }
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
  // Reuse the proven real-buy path (mockBuy -> realBuy) instead of simulating - this was
  // previously 100% fake even on mainnet (fake tx hash "DEVNET_RT_...", no real swap ever executed).
  const result = await mockBuy(ctx, user, tokenCa, solAmount, "realtime_sniper", meta.sourceRef || "", {
    silent: true, skipSafety: true, tokenName: meta.tokenName,
  });
  if (!result) return null;

  try {
    const { notify } = require("./notifications");
    notify(user.user_id, "TRADE_CONFIRMED", {
      action: "buy",
      token: meta.tokenName || tokenCa.slice(0, 8),
      sol: solAmount.toFixed(4),
      txHash: result.txHash,
    });
  } catch {}

  return result;
}

function simulatePriceMovement(ca) {
  // Read-only: just returns the current tracked price.
  // Real-listed tokens are kept fresh by refreshTrackedPrices() on a
  // background timer (anchored to real DexScreener price). Pure
  // mock/Launch tokens (no real listing) get a small bounded nudge
  // on that same timer instead of drifting every time someone views them.
  return getMockPrice(ca);
}

async function refreshTrackedPrices() {
  const axios = require("axios");
  const cas = Array.from(mockPrices.keys());
  for (const ca of cas) {
    if (ca.startsWith("DEVNET_") || ca.startsWith("MOCK_")) continue; // pure mock, no real CA to check
    try {
      const res = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { timeout: 5000 });
      const pair = res.data?.pairs?.[0];
      const realPrice = pair ? parseFloat(pair.priceUsd || 0) : 0;
      if (realPrice > 0) {
        mockPrices.set(ca, realPrice); // anchor to real price
      } else {
        // No real listing found (e.g. Launch-created token) — small neutral nudge, once per cycle
        const current = mockPrices.get(ca);
        const change = (Math.random() - 0.5) * 0.05; // ±2.5%, no bias
        mockPrices.set(ca, Math.max(current * (1 + change), 0.000001));
      }
    } catch {
      // network hiccup — leave price as-is this cycle, try again next time
    }
  }
}
setInterval(refreshTrackedPrices, 30000);

function getEffectiveFeeRate(user) {
  const { getFeeRate } = require("./ranks");
  const base = getFeeRate(user);
  if (user.rank === 1 && user.joiner_discount) return +(base * 0.9).toFixed(4);
  return base;
}

function isAutoBuyEnabled(userId) {
  const s = db.getSettings(userId);
  return (s?.auto_buy_enabled || s?.auto_buy || 0) === 1;
}

async function mockBuy(ctx, user, ca, solAmount, source, sourceRef, opts = {}) {
  if (killSwitch.isActive()) {
    await ctx.reply("🔴 *Trading Paused*\n\nAdmin has paused trading. Your positions are safe.", { parse_mode: "Markdown" });
    return null;
  }

  // ── EVM chain branch (Robinhood Chain etc) - completely separate path, Solana code below untouched ──
  const _activeChainForBuy = db.getActiveChain(user.user_id);
  if (_activeChainForBuy !== "SOL") {
    const { evmBuy } = require("./chains/evm/evmTrade");
    return evmBuy(ctx, user, ca, solAmount, source, sourceRef, opts, _activeChainForBuy);
  }

  // Always get fresh user for correct wallet
  user = db.getUser(user.user_id) || user;
  if (!user.active_wallet_id) {
    await ctx.reply("❌ No active wallet. Go to Wallets to add one first.");
    return null;
  }

  // Low-balance pre-check (real trades only) - avoid a confusing on-chain failure
  if (process.env.MOCK_TRADES === "false") {
    const buyWalletObj = db.getWallet(user.active_wallet_id);
    const curWalletBal = buyWalletObj ? (await db.getWalletBalance(buyWalletObj.public_key)) || 0 : 0;
    if (curWalletBal < solAmount + 0.002) {
      await ctx.reply(`⚠️ Balance too low: you have ${curWalletBal.toFixed(4)} SOL, need ~${(solAmount + 0.002).toFixed(4)} SOL (trade + fees).`);
      return null;
    }
  }

  // Safety check
  const safety = await checkSafety(ca, user.mode || "beginner");
  if (safety.status === "BLOCK" && !opts.skipSafety) {
    const cleanReason = String(safety.reason||"").replace(/[_*`[\]]/g,"");
    // Pro can override overridable blocks (freeze/mint/high-rug); honeypot/can't-sell never
    if (safety.canOverride && (user.mode || "beginner") === "pro") {
      await ctx.reply(
        `⚠️ *Risky Token — Safety Warning*\n\nToken: \`${ca.slice(0,12)}...\`\nReason: *${cleanReason}*\n\n_This token is risky. As a Pro user, you can override and buy anyway — but you may lose funds._`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[
          { text: "⚠️ Override & Buy Anyway", callback_data: `buy_override_${ca}_${solAmount}` },
          { text: "❌ Cancel", callback_data: "noop" },
        ]]}}
      );
      return null;
    }
    await ctx.reply(
      `🚫 *Trade Blocked — Safety Check*\n\nToken: \`${ca.slice(0,12)}...\`\nReason: *${cleanReason}*\n\n_Blocked to protect you.${safety.canOverride ? " Switch to Pro Mode to override." : ""}_`,
      { parse_mode: "Markdown" }
    );
    return null;
  }

  // Show processing message (skip if silent)
  const processingMsg = opts.silent ? null : await ctx.reply(
    `🔄 *Processing buy...*\n\nToken: \`${ca.slice(0,12)}...\`\nAmount: *${solAmount} SOL*`,
    { parse_mode: "Markdown" }
  );

  const settings    = db.getSettings(user.user_id) || {};
  const slippage    = settings.slippage_pct || 10;

  // ── REAL EXECUTION (mainnet, MOCK_TRADES=false) ──────────────
  const REAL = process.env.MOCK_TRADES === "false";
  let realTxHash = null, realTokenAmount = null, realPrice = null, realFeeCollected = false;
  if (REAL) {
    try {
      const { realBuy } = require("./jupiterSwap");
      const { decryptWallet } = require("./walletVault");
      const keypair = decryptWallet(user.active_wallet_id);
      const solLamports = Math.floor(solAmount * 1e9);
      const slippageBps = Math.floor(slippage * 100); // 10% -> 1000 bps
      const speed = settings.speed_mode || "fast";
      // MEV protection: only route through Jito when mev_protect is ON; tip comes from jito_tip (SOL)
      const mevOn = (settings.mev_protect ?? 1) ? true : false;
      const jitoTipLamports = mevOn ? Math.floor((settings.jito_tip || 0) * 1e9) : 0;
      const preFeeRate = getEffectiveFeeRate(user);
      const preFeeLamports = Math.floor(solAmount * preFeeRate * 1e9);
      const r = await realBuy({ keypair, tokenMint: ca, solLamports, slippageBps, speed, jitoTipLamports, customFeeSol: settings.priority_fee_manual_sol, feeLamports: preFeeLamports });
      if (!r.ok) {
        const em = String(r.error||"swap failed").replace(/[_*`[\]]/g,"");
        if (processingMsg) { try { await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, "❌ Buy failed: " + em); } catch {} }
        else { await ctx.reply("❌ Buy failed: " + em); }
        return null;
      }
      realTxHash = r.signature;
      realFeeCollected = r.feeCollected === true;
      // outAmount is in token base units; convert using the token's REAL decimals
      const buyDecimals = (typeof r.decimals === "number") ? r.decimals : 9;
      realTokenAmount = Number(r.outAmount) / Math.pow(10, buyDecimals);
      realPrice = realTokenAmount > 0 ? solAmount / realTokenAmount : 0;
    } catch (err) {
      const em = String(err.message||"error").replace(/[_*`[\]]/g,"");
      if (processingMsg) { try { await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, "❌ Buy error: " + em); } catch {} }
      else { await ctx.reply("❌ Buy error: " + em); }
      return null;
    }
  }

  let realUsdPrice = 0; // set from DexScreener below if available
  const _priceSolPerToken = REAL ? (realPrice || getMockPrice(ca)) : getMockPrice(ca);
  const tokenAmount = REAL ? realTokenAmount : (solAmount / _priceSolPerToken) * (1 - slippage / 100) * (0.9 + Math.random() * 0.1);
  const txHash      = REAL ? realTxHash : `DEVNET_BUY_${Date.now()}_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  const feeRate     = getEffectiveFeeRate(user);
  // On real trades, feeSol reflects what we ACTUALLY collected (0 if the fee-transfer injection failed),
  // so referral crediting and revenue records never claim money that never landed in treasury.
  const feeSol      = REAL ? (realFeeCollected ? solAmount * feeRate : 0) : solAmount * feeRate;
  let tokenName = ca.startsWith("DEVNET_") ? "DevTest" : ca.slice(0,8);
  let entryMcap = 0;
  // If a custom token name was passed (e.g. from Launch), use it
  if (opts.tokenName) {
    tokenName = opts.tokenName;
  } else {
    try {
      // Birdeye primary (consistent with the token info screen), DexScreener as fallback
      const { getTokenOverview } = require("./birdeye");
      const ov = await getTokenOverview(ca).catch(() => null);
      if (ov && (ov.mcap || ov.price)) {
        entryMcap = Number(ov.mcap || 0);
        if (ov.symbol) tokenName = ov.symbol;
        if (REAL && ov.price > 0) realUsdPrice = ov.price;
        if (!entryMcap && ov.price > 0 && ov.totalSupply) entryMcap = ov.price * Number(ov.totalSupply);
      } else {
        const axiosMcap = require("axios");
        const dexRes = await axiosMcap.get(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { timeout: 1200 });
        const pairs  = dexRes.data?.pairs;
        if (pairs && pairs.length > 0) {
          const best = pairs.reduce((a, b) => ((b.liquidity?.usd || 0) > (a.liquidity?.usd || 0) ? b : a), pairs[0]);
          entryMcap = Number(best.marketCap || best.fdv || 0);
          const sym = best.baseToken?.symbol;
          if (sym) tokenName = sym;
          const pxUsd = parseFloat(best.priceUsd || 0);
          if (REAL && pxUsd > 0) realUsdPrice = pxUsd;
          if (!entryMcap && pxUsd > 0 && best.baseToken?.totalSupply) {
            entryMcap = pxUsd * Number(best.baseToken.totalSupply);
          }
        }
      }
    } catch {}
  }
  
  // Final stored price: USD-per-token on mainnet (matches P&L display), mock on devnet
  const price = REAL ? (realUsdPrice || _priceSolPerToken) : _priceSolPerToken;

  // Update mock wallet balance (devnet only) — deduct SOL spent
  if (!REAL) try {
    const buyWallet = db.getWallet(user.active_wallet_id);
    if (buyWallet) {
      const curBal = parseFloat(db.getSysConfig(`mock_balance_${buyWallet.public_key}`) || "0");
      db.setSysConfig(`mock_balance_${buyWallet.public_key}`, String(curBal - solAmount));
    }
  } catch {}

  const tradeId = db.recordTrade({
    userId: user.user_id, walletId: user.active_wallet_id,
    tokenCa: ca, tokenName, platform: (process.env.MOCK_TRADES === "false") ? "jupiter" : "devnet_mock",
    action: "buy", solAmount, tokenAmount,
    priceSol: price, feeSol, feeRate, txHash, status: "confirmed",
  });

  // Check if position exists — update or create (must match wallet too, not just user+token,
  // otherwise buying the same token from a different wallet wrongly merges into the wrong wallet's position)
  const existingPos = db.getDb()
    .prepare("SELECT * FROM positions WHERE user_id = ? AND token_ca = ? AND wallet_id = ? AND status = 'open' LIMIT 1")
    .get(user.user_id, ca, user.active_wallet_id);

  let positionId;
  if (existingPos) {
    const newSolInvested = existingPos.sol_invested + solAmount;
    const newTokenAmount = existingPos.token_amount + tokenAmount;
    // Weighted-average USD entry price (price is USD-per-token on mainnet). Weight by SOL invested.
    const thisPxUsd = price; // 'price' is USD-per-token on mainnet, mock on devnet
    const avgBuyPrice = (((existingPos.buy_price || 0) * existingPos.sol_invested) + (thisPxUsd * solAmount)) / newSolInvested;
    // Weighted-average entry MC too (was only ever set on the first buy)
    const newEntryMcap = entryMcap > 0
      ? (((existingPos.entry_mcap || 0) * existingPos.sol_invested) + (entryMcap * solAmount)) / newSolInvested
      : (existingPos.entry_mcap || 0);
    // Self-heal token name: if we got a real symbol this time and the stored name still looks like
    // a CA-prefix placeholder (from a past failed lookup), fix it now.
    const looksLikePlaceholder = existingPos.token_name === ca.slice(0, 8);
    const newTokenName = (tokenName && !tokenName.startsWith(ca.slice(0,4)) && looksLikePlaceholder) ? tokenName : existingPos.token_name;
    db.getDb()
      .prepare("UPDATE positions SET sol_invested = ?, token_amount = ?, buy_price = ?, entry_mcap = ?, token_name = ? WHERE position_id = ?")
      .run(newSolInvested, newTokenAmount, avgBuyPrice, newEntryMcap, newTokenName, existingPos.position_id);
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
      .prepare("SELECT position_id FROM positions WHERE user_id = ? AND token_ca = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1")
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

  // (skip the "Confirmed" edit — we delete this msg and open the position screen immediately)
  if (safety.status === "WARNING") {
    await ctx.reply(`⚠️ *Safety Warning:* ${String(safety.reason||"").replace(/[_*`[\]]/g,"")}`, { parse_mode: "Markdown" });
  }

  // Wait 100ms then delete confirmed message and open position screen
  try { if (processingMsg) await ctx.api.deleteMessage(ctx.chat.id, processingMsg.message_id); } catch {}

  // Open position screen (unless caller wants to handle the UI itself, e.g. refreshing a list)
  if (positionId && !opts.skipPositionScreen) {
    try {
      const { getTokenPosition } = require("./portfolio");
      const freshUser = db.getUser(user.user_id);
      await getTokenPosition(ctx, freshUser, positionId);
    } catch (posErr) {
      console.log("[Buy] position screen failed to open:", posErr.message);
      try { await ctx.reply("✅ Buy complete! Open Positions to view it."); } catch {}
    }
  }

  return { tradeId, txHash, feeSol };
}
// (buy end)
async function mockSell(ctx, user, position, pctToSell = 100, opts = {}) {
  if (killSwitch.isActive()) {
    await ctx.reply("🔴 *Trading Paused*", { parse_mode: "Markdown" });
    return null;
  }

  // ── EVM chain branch - this position belongs to an EVM chain, not Solana ──
  if (position.chain && position.chain !== "SOL") {
    const { evmSell } = require("./chains/evm/evmTrade");
    return evmSell(ctx, user, position, pctToSell, opts);
  }

  const sellFraction  = pctToSell / 100;
  const REAL_S = process.env.MOCK_TRADES === "false";

  // Immediate feedback so the sell doesn't feel frozen during on-chain confirmation
  const sellProcMsg = opts.silent ? null : await ctx.reply(
    "🔄 *Processing sell...*\n\n" + (pctToSell < 100 ? "Selling *" + pctToSell + "%*" : "Selling *all*") + " · confirming on-chain…",
    { parse_mode: "Markdown" }
  ).catch(() => null);

  let currentPrice, pnlPct, solReceived, txHash, realSellDone = false, realFeeCollected = false, sellFeeLamports = 0;

  if (REAL_S) {
    try {
      const { realSell } = require("./jupiterSwap");
      const { decryptWallet } = require("./walletVault");
      const settingsS = db.getSettings(user.user_id) || {};
      const sellWalletId = position.wallet_id || user.active_wallet_id;
      const keypair = decryptWallet(sellWalletId);
      // Tokens to sell = position token_amount * fraction, in base units (default 9 decimals)
      const { getTokenDecimals } = require("./jupiterSwap");
      const sellDecimals = await getTokenDecimals(position.token_ca);
      const tokensToSell = (position.token_amount || 0) * sellFraction;
      const tokenAmountRaw = Math.floor(tokensToSell * Math.pow(10, sellDecimals));
      if (tokenAmountRaw <= 0) { await ctx.reply("❌ Nothing to sell."); return null; }
      const slippageBpsS = Math.floor(((db.getSettings(user.user_id)||{}).slippage_pct || 10) * 100);
      const speedS = settingsS.speed_mode || "fast";
      const mevOnS = (settingsS.mev_protect ?? 1) ? true : false;
      const jitoTipS = mevOnS ? Math.floor((settingsS.jito_tip || 0) * 1e9) : 0;
      const preSellFeeRate = getEffectiveFeeRate(user);
      const rs = await realSell({ keypair, tokenMint: position.token_ca, tokenAmountRaw, slippageBps: slippageBpsS, speed: speedS, jitoTipLamports: jitoTipS, customFeeSol: settingsS.priority_fee_manual_sol, feeRate: preSellFeeRate });
      if (!rs.ok) {
        const em = String(rs.error||"sell failed").replace(/[_*`[\]]/g,"");
        const emLower = em.toLowerCase();
        const isFeeIssue = emLower.includes("insufficient") || emLower.includes("rent");
        const simpleMsg = isFeeIssue
          ? "❌ Sell failed — not enough SOL to cover fees. Try again with more SOL."
          : "❌ Sell failed. Please try again.";
        await ctx.reply(simpleMsg, { parse_mode: "Markdown" });
        return null;
      }
      realFeeCollected = rs.feeCollected === true;
      sellFeeLamports = rs.feeLamports || 0;
      solReceived = (Number(rs.outAmount) - (realFeeCollected ? sellFeeLamports : 0)) / 1e9;
      // P&L in USD terms to match buy_price (which is stored as USD-per-token).
      // Fetch live USD price of the token; fall back to SOL-rate conversion if unavailable.
      let curUsdPrice = 0;
      try {
        const axSell = require("axios");
        const drS = await axSell.get("https://api.dexscreener.com/latest/dex/tokens/" + position.token_ca, { timeout: 5000 });
        const prS = drS.data && drS.data.pairs && drS.data.pairs[0];
        if (prS && prS.priceUsd) curUsdPrice = parseFloat(prS.priceUsd);
      } catch {}
      currentPrice = curUsdPrice > 0 ? curUsdPrice : position.buy_price;
      pnlPct = position.buy_price > 0 ? ((currentPrice - position.buy_price) / position.buy_price * 100) : 0;
      txHash = rs.signature;
      realSellDone = true;
    } catch (err) {
      const em = String(err.message||"error").replace(/[_*`[\]]/g,"");
      await ctx.reply("❌ Sell error: " + em);
      return null;
    }
  } else {
    currentPrice  = simulatePriceMovement(position.token_ca);
    pnlPct        = position.buy_price > 0 ? ((currentPrice - position.buy_price) / position.buy_price * 100) : 0;
    solReceived   = position.sol_invested * (1 + pnlPct / 100) * sellFraction;
    txHash        = `DEVNET_SELL_${Date.now()}`;
  }

  const feeRate       = getEffectiveFeeRate(user);
  // On real trades, feeSol reflects what was ACTUALLY collected (sellFeeLamports/1e9 if the
  // fee-transfer succeeded, 0 if it failed) - never claim a fee we didn't really receive.
  const feeSol        = REAL_S ? (realFeeCollected ? sellFeeLamports / 1e9 : 0) : solReceived * feeRate;

  // Update mock wallet balance (devnet only) — credit proceeds minus fee
  if (!REAL_S) try {
    const sellWalletId = user.active_wallet_id || position.wallet_id;
    const sellWallet = db.getWallet(sellWalletId);
    if (sellWallet) {
      const curBal = parseFloat(db.getSysConfig(`mock_balance_${sellWallet.public_key}`) || "0");
      db.setSysConfig(`mock_balance_${sellWallet.public_key}`, String(curBal + (solReceived - feeSol)));
    }
  } catch {}

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

  // Remove the "Processing sell..." message now that we have a result
  try { if (sellProcMsg) await ctx.api.deleteMessage(ctx.chat.id, sellProcMsg.message_id); } catch {}

  const sign = pnlPct >= 0 ? "+" : "";
  const solscanLink = (REAL_S && txHash && !String(txHash).startsWith("DEVNET")) ? ` · [Solscan](https://solscan.io/tx/${txHash})` : "";
  if (!opts.silent) await ctx.reply(
    `✅ Sold ${pctToSell}% ${position.token_name || position.token_ca.slice(0,8)} — ${solReceived.toFixed(4)} SOL (${sign}${pnlPct.toFixed(1)}%)` + solscanLink,
    { parse_mode: "Markdown", disable_web_page_preview: true }
  );
  // Tell the deposit monitor this balance change was expected (not an external deposit)
  if (REAL_S) {
    try {
      const { syncKnownBalance } = require("./depositMonitor");
      const sellWalletForSync = db.getWallet(user.active_wallet_id || position.wallet_id);
      if (sellWalletForSync) await syncKnownBalance(sellWalletForSync.public_key);
    } catch {}
  }
  // Auto PnL card on every sell
  let exitMcap = 0;
  try {
    const { getTokenOverview } = require("./birdeye");
    const ov2 = await getTokenOverview(position.token_ca).catch(() => null);
    if (ov2 && ov2.mcap) exitMcap = ov2.mcap;
    else {
      const axiosMcap2 = require("axios");
      const dexRes2 = await axiosMcap2.get("https://api.dexscreener.com/latest/dex/tokens/"+position.token_ca, { timeout: 5000 });
      const pairs2 = dexRes2.data?.pairs;
      if (pairs2 && pairs2.length > 0) exitMcap = pairs2[0].fdv || pairs2[0].marketCap || 0;
    }
  } catch {}
  try {
    console.log("[PnL Card] Generating for user:", user.user_id);
    const hideAmounts = db.getSysConfig(`pnlcard_hide_${user.user_id}`) === "1";
    const hideInvested = db.getSysConfig(`pnlcard_hide_invested_${user.user_id}`) === "1";
    const hideSolAmount = db.getSysConfig(`pnlcard_hide_sol_${user.user_id}`) === "1";
    const hideHoldTime = db.getSysConfig(`pnlcard_hide_hold_${user.user_id}`) === "1";
    const { generateTradeCard } = require("./statsCard");
    const { RANKS } = require("./keyboards");
    const rank = RANKS[user.rank] || RANKS[1];
    // pnlSolVal = profit/loss on the portion sold
    const soldInvested = position.sol_invested * (pctToSell / 100);
    const pnlSolVal = solReceived - soldInvested;
    // Fee saved vs 1% base rate
    const feeSaved = parseFloat(((1.00 - rank.fee) * solReceived).toFixed(4));
    const _cardSolPxE = await db.getSolPriceUsdShared().catch(() => 150);
    // Hold time: from position open to now
    let holdTimeStr = null;
    try {
      const openedMs = new Date((position.opened_at || position.created_at || "").replace(" ", "T") + "Z").getTime();
      if (openedMs) {
        const diffMs = Date.now() - openedMs;
        const mins = Math.floor(diffMs / 60000), hrs = Math.floor(mins/60), days = Math.floor(hrs/24);
        holdTimeStr = days >= 1 ? `${days}d ${hrs%24}h` : hrs >= 1 ? `${hrs}h ${mins%60}m` : `${mins}m`;
      }
    } catch {}
    const freshRefUser = db.getUser(user.user_id);
    const result = await generateTradeCard({
      username: user.username || "Trader",
      referralCode: freshRefUser?.custom_code || freshRefUser?.referral_code || null,
      holdTime: holdTimeStr,
      rankName: rank.name,
      rankNum: user.rank || 1,
      tokenName: position.token_name || position.token_ca.slice(0,8),
      pnlSol: hideAmounts ? 0 : pnlSolVal,
      pnlPct,
      pnlUsd: hideAmounts ? 0 : Math.abs(pnlSolVal * _cardSolPxE),
      entryMcap: position.entry_mcap || 0,
      exitMcap,
      invested: hideAmounts ? 0 : soldInvested,
      returned: hideAmounts ? 0 : solReceived,
      feeSaved: hideAmounts ? 0 : feeSaved,
      dailyFeeSaved: hideAmounts ? 0 : db.getDailyFeeSaved(user.user_id),
      weeklyFeeSaved: hideAmounts ? 0 : db.getWeeklyFeeSaved(user.user_id),
      monthlyFeeSaved: hideAmounts ? 0 : db.getMonthlyFeeSaved(user.user_id),
      feeRate: rank.fee,
      sellPct: pctToSell,
      hideAmounts,
      hideInvested,
      hideSolAmount,
      hideHoldTime,
    });
    // Save card data for hide/show toggle
    db.setSysConfig(`last_card_data_${user.user_id}`, JSON.stringify({
      username: user.username || "Trader",
      rankName: rank.name, rankNum: user.rank || 1,
      tokenName: position.token_name || position.token_ca.slice(0,8),
      pnlPct, sellPct: pctToSell,
      entryMcap: position.entry_mcap || 0, exitMcap,
      feeRate: rank.fee,
      _pnlSol: pnlSolVal, _pnlUsd: Math.abs(pnlSolVal * _cardSolPxE),
      _invested: soldInvested, _returned: solReceived,
      _feeSaved: feeSaved,
      _dailyFeeSaved: db.getDailyFeeSaved(user.user_id),
      _weeklyFeeSaved: db.getWeeklyFeeSaved(user.user_id),
    }));
    const pnlKb = { inline_keyboard: [[
      { text: hideAmounts ? "Show Amounts" : "Hide Amounts", callback_data: `pnlcard_toggle_hide_${user.user_id}` },
    ]]};
    if (result && result.type === "photo") {
      await ctx.replyWithPhoto(new InputFile(result.buffer, "pnl_card.png"), { reply_markup: pnlKb });
    } else if (result && result.type === "text") {
      await ctx.reply(result.text, { parse_mode: "Markdown", reply_markup: pnlKb });
    }
  } catch (cardErr) { console.error("[PnL Card] Error:", cardErr.message); }
  return { tradeId, txHash, pnlPct, solReceived };
}

// Only fires when user explicitly has auto_buy ON
async function handleAutoBuy(ctx, user, ca) {
  // Get fresh user to ensure correct active wallet + mode
  user = db.getUser(user.user_id) || user;
  // Auto Buy is a PRO-only feature
  if ((user.mode || "beginner") !== "pro") return false;
  if (!isAutoBuyEnabled(user.user_id)) return false;
  const settings  = db.getSettings(user.user_id) || {};
  const solAmount = settings.auto_buy_sol || settings.max_buy_sol || 0.1;
  const maxBuys   = settings.auto_buy_max || 1;

  // Enforce max buys per token (count existing auto_buy trades for this token on the active wallet)
  const alreadyBought = db.getDb().prepare(
    "SELECT COUNT(*) c FROM trades WHERE user_id=? AND token_ca=? AND wallet_id=? AND action='buy' AND platform LIKE '%mock%' AND status='confirmed'"
  ).get(user.user_id, ca, user.active_wallet_id).c;

  if (alreadyBought >= maxBuys) {
    await ctx.reply(
      `🤖 *Auto Buy skipped*\n\nCA: \`${ca.slice(0,12)}...\`\nAlready bought *${alreadyBought}/${maxBuys}* times (max reached).\n\n_Increase Max Buys/Token in Auto Buy settings to buy more._`,
      { parse_mode: "Markdown" }
    );
    return true; // handled (don't fall through to normal scanner)
  }

  await ctx.reply(
    `🤖 *Auto Buy triggered*\n\nCA: \`${ca.slice(0,12)}...\`\nAmount: *${solAmount} SOL*\nBuy ${alreadyBought + 1}/${maxBuys}`,
    { parse_mode: "Markdown" }
  );
  await mockBuy(ctx, user, ca, solAmount, "auto_buy", "");
  return true;
}

module.exports = { mockBuy, mockSell, getMockPrice, simulatePriceMovement, getEffectiveFeeRate, isAutoBuyEnabled, handleAutoBuy, executeRealtimeSnipe, isRealtimeSniperEnabled };
