// M14 — Stop Loss & Take Profit V12
// Monitors ALL open positions every 30 seconds
// Sells any token regardless of buy source (manual/channel/copy wallet/auto)
// When auto sell is OFF on source: position is still monitored by main settings SL/TP
// Limit orders also checked here

const db  = require("../../database");
const { getMockPrice, simulatePriceMovement } = require("./executor");

async function monitorPositions(notifyFn) {
  const positions = db.getAllOpenPositions();
  if (!positions.length) return;

  for (const pos of positions) {
    try {
      await checkPosition(pos, notifyFn);
    } catch (e) {
      console.error("[StopLoss] Error checking position:", e.message);
    }
  }

  // Also check limit orders
  await checkLimitOrders(notifyFn);
}

async function checkPosition(pos, notifyFn) {
  const user = db.getUser(pos.user_id);
  if (!user) return;

  const settings     = db.getSettings(pos.user_id) || {};
  const currentPrice = simulatePriceMovement(pos.token_ca);
  if (!currentPrice || !pos.buy_price) return;

  const pnlPct = ((currentPrice - pos.buy_price) / pos.buy_price) * 100;

  // ── Get template for this position ──────────────────────────
  let templateId = pos.auto_sell_template_id || 0;

  // If no template on position — check source
  if (!templateId) {
    if (pos.source === "copy_channel" && pos.source_ref) {
      const ch = db.getDb().prepare("SELECT * FROM copy_channels WHERE channel_id = ? AND user_id = ?").get(pos.source_ref, pos.user_id);
      if (ch?.auto_sell_enabled) templateId = ch.auto_sell_template_id || 0;
    } else if (pos.source === "copy_wallet") {
      const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE user_id = ? AND label = ?").get(pos.user_id, pos.source_ref || "");
      if (cw?.auto_sell_enabled) templateId = cw.auto_sell_template_id || 0;
    } else {
      // Manual/sniper/auto_buy — use settings template
      if (settings.auto_sell_enabled) templateId = settings.auto_sell_template_id || 0;
    }
  }

  // ── Template-based auto sell ─────────────────────────────────
  if (templateId) {
    const t = db.getAutoSellTemplate(pos.user_id, templateId);
    if (t) {
      await checkTemplatePosition(pos, user, t, currentPrice, pnlPct, notifyFn);
      return;
    }
  }

  // ── Legacy SL/TP fallback ────────────────────────────────────
  let sl = 0, tp = 0;
  if (pos.source === "copy_channel" && pos.source_ref) {
    const ch = db.getDb().prepare("SELECT * FROM copy_channels WHERE channel_id = ? AND user_id = ?").get(pos.source_ref, pos.user_id);
    if (ch?.auto_sell_enabled) { sl = ch.stop_loss_pct || 0; tp = ch.take_profit_pct || 0; }
    else { if (!settings.auto_sell) return; sl = settings.stop_loss_pct || 0; tp = settings.take_profit_pct || 0; }
  } else if (pos.source === "copy_wallet") {
    if (!settings.auto_sell) return;
    sl = settings.stop_loss_pct || 0; tp = settings.take_profit_pct || 0;
  } else {
    if (!settings.auto_sell) return;
    sl = settings.stop_loss_pct || 0; tp = settings.take_profit_pct || 0;
  }

  if (sl === 0 && tp === 0) return;

  let triggered = null;
  if (sl !== 0 && pnlPct <= sl) triggered = { type: "Stop Loss", pnlPct };
  if (tp !== 0 && pnlPct >= tp) triggered = { type: "Take Profit", pnlPct };
  if (!triggered) return;

  await executeSell(pos, user, 100, currentPrice, pnlPct, triggered.type, notifyFn);
}

  async function checkTemplatePosition(pos, user, t, currentPrice, pnlPct, notifyFn) {
    const state = JSON.parse(db.getSysConfig(`ast_state_${pos.position_id}`) || "{}");
    const tpHit = state.tp_hit || 0;

    // Cooldown — don't trigger same SL level twice
    const slLevel = tpHit >= 2 ? 3 : tpHit >= 1 ? 2 : 1;
    // Only skip if SL already done AND no more TPs to check
    const nextTpCheck = tpHit + 1;
    const nextTpVal = t[`tp_${nextTpCheck}`] || 0;
    if (state[`sl${slLevel}_done`] || state[`sl1_done`]) return; 
  // How many TPs have been hit

  // ── Check active SL ──────────────────────────────────────────
  // SL1 always active, SL2 after TP1, SL3 after TP2
  let activeSl = 0, activeSlPct = 100;
  if (tpHit >= 2 && t.sl_3 !== 0) { activeSl = t.sl_3; activeSlPct = t.sl_3_sell_pct || 100; }
  else if (tpHit >= 1 && t.sl_2 !== 0) { activeSl = t.sl_2; activeSlPct = t.sl_2_sell_pct || 100; }
  else if (t.sl_1 !== 0) { activeSl = t.sl_1; activeSlPct = t.sl_1_sell_pct || 100; }

  // Trail SL — use peak price
  let slCheckPct = pnlPct;
  if (activeSl !== 0) {
    const trail = tpHit >= 2 ? t.sl_3_trail : tpHit >= 1 ? t.sl_2_trail : t.sl_1_trail;
    if (trail) {
      const peak = state.peak_pnl || pnlPct;
      const newPeak = Math.max(peak, pnlPct);
      if (newPeak !== peak) {
        state.peak_pnl = newPeak;
        db.setSysConfig(`ast_state_${pos.position_id}`, JSON.stringify(state));
      }
      slCheckPct = pnlPct - newPeak; // Drop from peak
    }
      if (slCheckPct <= activeSl) {
        state[`sl1_done`] = 1;
        state[`sl2_done`] = 1;
        state[`sl3_done`] = 1;
        state[`sl${slLevel}_done`] = 1;
      state.sl_triggered = (state.sl_triggered || 0) + 1;
      db.setSysConfig(`ast_state_${pos.position_id}`, JSON.stringify(state));
      await executeSell(pos, user, activeSlPct, currentPrice, pnlPct, "🛑 Stop Loss", notifyFn);
      if (activeSlPct >= 100) db.setSysConfig(`ast_state_${pos.position_id}`, "{}");
      return;
    }
  }

  // ── Check next TP ────────────────────────────────────────────
  const nextTp = tpHit + 1;
  if (nextTp > 5) return; // All TPs hit

  const tpVal  = t[`tp_${nextTp}`] || 0;
  const tpPct  = t[`tp_${nextTp}_pct`] || 100;
  const tpTrail = t[`tp_${nextTp}_trail`] || 0;

  if (tpVal === 0) return; // TP not set

  let tpCheckPct = pnlPct;
  if (tpTrail) {
    const peak = state.peak_pnl || pnlPct;
    const newPeak = Math.max(peak, pnlPct);
    state.peak_pnl = newPeak;
    // Trail TP — sell when drops X% from peak after reaching TP
    if (newPeak >= tpVal && pnlPct <= newPeak - (tpVal * 0.1)) {
      tpCheckPct = tpVal + 1; // Force trigger
    } else {
      tpCheckPct = pnlPct;
    }
    db.setSysConfig(`ast_state_${pos.position_id}`, JSON.stringify(state));
  }

  if (tpCheckPct >= tpVal) {
    // TP hit!
    state.tp_hit = nextTp;
    state.peak_pnl = pnlPct;
    db.setSysConfig(`ast_state_${pos.position_id}`, JSON.stringify(state));
    await executeSell(pos, user, tpPct, currentPrice, pnlPct, `🎯 TP${nextTp}`, notifyFn);
  }
}

async function executeSell(pos, user, sellPct, currentPrice, pnlPct, reason, notifyFn) {
  const solReceived  = pos.sol_invested * (1 + pnlPct / 100) * (sellPct / 100);
  const { getEffectiveFeeRate } = require("./executor");
  const feeRate      = getEffectiveFeeRate(user);
  const feeSol       = solReceived * feeRate;
  const txHash       = `DEVNET_AUTO_${Date.now()}`;
  const sign         = pnlPct >= 0 ? "+" : "";

  db.recordTrade({
    userId: pos.user_id, walletId: pos.wallet_id,
    tokenCa: pos.token_ca, tokenName: pos.token_name || "Unknown",
    platform: "devnet_mock", action: "sell",
    solAmount: solReceived, tokenAmount: pos.token_amount * (sellPct / 100),
    priceSol: currentPrice, feeSol, feeRate, txHash, status: "confirmed",
  });

  if (sellPct >= 100) {
    db.closePosition(pos.position_id);
    db.setSysConfig(`ast_state_${pos.position_id}`, "{}");
  } else {
    // Partial sell — update position
    db.getDb().prepare("UPDATE positions SET sol_invested = sol_invested * ?, token_amount = token_amount * ? WHERE position_id = ?")
      .run(1 - sellPct/100, 1 - sellPct/100, pos.position_id);
  }

  db.addVolume(pos.user_id, solReceived);
  const { creditReferralEarnings } = require("./referrals");
  creditReferralEarnings(pos.user_id, null, feeSol);

  if (notifyFn) {
    notifyFn(pos.user_id, "auto_sell", {
      message:
        `🤖 *${reason} Triggered*\n\n` +
        `Token: *${pos.token_name || pos.token_ca.slice(0,8)}*\n` +
        `Sold: *${sellPct}%*\n` +
        `P&L: *${sign}${pnlPct.toFixed(1)}%*\n` +
        `Received: *${solReceived.toFixed(4)} SOL*\n` +
        `Fee: *${feeSol.toFixed(6)} SOL*\n\n` +
        `_${sellPct >= 100 ? "Position closed." : "Partial sell executed."}_`,
    });
  }

  // Generate PnL card for auto sells
  try {
    const { generateTradeCard } = require("./statsCard");
    const { RANKS } = require("./keyboards");
    const rank = RANKS[user.rank] || RANKS[1];
    const soldInvested = pos.sol_invested * (sellPct / 100);
    const pnlSolVal = solReceived - soldInvested;
    const hideAmounts = db.getSysConfig(`pnlcard_hide_${pos.user_id}`) === "1";
    const feeSaved = Math.max(0, (solReceived * 0.01) - feeSol);
    const cardResult = await generateTradeCard({
      username: user.username || "Trader",
      rankName: rank.name,
      rankNum: user.rank || 1,
      tokenName: pos.token_name || pos.token_ca.slice(0,8),
      pnlSol: hideAmounts ? 0 : pnlSolVal,
      pnlPct,
      pnlUsd: hideAmounts ? 0 : Math.abs(pnlSolVal * 150),
      entryMcap: pos.entry_mcap || 0,
      exitMcap: 0,
      invested: hideAmounts ? 0 : soldInvested,
      returned: hideAmounts ? 0 : solReceived,
      feeSaved: hideAmounts ? 0 : feeSaved,
      feeRate: rank.fee,
      sellPct,
      dailyFeeSaved: hideAmounts ? 0 : db.getDailyFeeSaved(pos.user_id),
      weeklyFeeSaved: hideAmounts ? 0 : db.getWeeklyFeeSaved(pos.user_id),
      hideAmounts,
    });
    if (cardResult && cardResult.type === "photo") {
      const { InputFile } = require("grammy");
      const pnlKb = { inline_keyboard: [[
        { text: hideAmounts ? "Show Amounts" : "Hide Amounts", callback_data: `pnlcard_toggle_hide_${pos.user_id}` }
      ]]};
      db.setSysConfig(`last_card_data_${pos.user_id}`, JSON.stringify({
        username: user.username || "Trader",
        rankName: rank.name, rankNum: user.rank || 1,
        tokenName: pos.token_name || pos.token_ca.slice(0,8),
        pnlPct, sellPct, entryMcap: pos.entry_mcap || 0, exitMcap: 0,
        feeRate: rank.fee,
        _pnlSol: pnlSolVal, _pnlUsd: Math.abs(pnlSolVal * 150),
        _invested: soldInvested, _returned: solReceived,
        _feeSaved: feeSaved,
        _dailyFeeSaved: db.getDailyFeeSaved(pos.user_id),
        _weeklyFeeSaved: db.getWeeklyFeeSaved(pos.user_id),
      }));
      notifyFn(pos.user_id, "pnl_card", { buffer: cardResult.buffer, kb: pnlKb });
    }
  } catch(e) {
    console.error('[AutoSell Card]', e.message);
  }

  console.log(`[StopLoss] ${reason}: ${pos.token_name} P&L ${sign}${pnlPct.toFixed(1)}% sold ${sellPct}%`);
}

// Check limit orders
async function checkLimitOrders(notifyFn) {
  const orders = db.getDb()
    .prepare("SELECT * FROM limit_orders WHERE active = 1")
    .all();

  for (const order of orders) {
    try {
      if (order.paused) continue;
      // Check expiry — auto-cancel expired orders
      if (order.expires_at) {
        const expMs = new Date(order.expires_at).getTime();
        if (Date.now() >= expMs) {
          db.cancelLimitOrder(order.user_id, order.id);
          if (notifyFn) {
            notifyFn(order.user_id, "limit_order", {
              message:
                `⏰ *Order Expired*\n\n` +
                `${order.order_type === "buy" ? "🟢 Buy" : "🔴 Sell"} *${order.token_name || order.token_ca.slice(0,8)}*\n` +
                `This order expired and was cancelled.\n\nSet a new one anytime.`,
            });
          }
          continue;
        }
      }
      // Don't trigger orders created less than 5 seconds ago
      const createdAt = new Date(order.created_at).getTime();
      if (Date.now() - createdAt < 5000) continue;
      const currentPrice = getMockPrice(order.token_ca);
      if (!currentPrice) continue;

      // Get current MCap (devnet: mock, mainnet: DexScreener)
      let currentMcap = 0;
      try {
        // On mainnet: fetch from DexScreener
        // const res = await require('axios').get('https://api.dexscreener.com/latest/dex/tokens/'+order.token_ca, { timeout: 3000 });
        // currentMcap = res.data?.pairs?.[0]?.fdv || 0;
        currentMcap = currentPrice * 1000000000; // devnet mock mcap
      } catch {}

      let triggered = false;

      // Price-based trigger
      if (order.target_price && order.target_price > 0) {
        if (order.order_type === "buy"  && currentPrice <= order.target_price) triggered = true;
        if (order.order_type === "sell" && currentPrice >= order.target_price) triggered = true;
      }

      // MCap-based trigger
      if (order.target_mcap && order.target_mcap > 0 && currentMcap > 0) {
        if (order.order_type === "buy"  && currentMcap <= order.target_mcap) triggered = true;
        if (order.order_type === "sell" && currentMcap >= order.target_mcap) triggered = true;
      }

      if (!triggered) continue;


      // Execute BUY limit order (no ctx — replicate core buy logic)
      if (order.order_type === 'buy') {
        const user = db.getUser(order.user_id);
        if (user) {
          const walletId = order.wallet_id || user.active_wallet_id;
          const wallet = db.getDb().prepare("SELECT * FROM wallets WHERE wallet_id = ?").get(walletId);
          if (wallet) {
            const bal = parseFloat(db.getSysConfig("mock_balance_" + wallet.public_key) || "0");
            if (bal >= order.sol_amount) {
              // Deduct balance
              db.setSysConfig("mock_balance_" + wallet.public_key, String(bal - order.sol_amount));
              const { getEffectiveFeeRate } = require("./executor");
              const feeRate = getEffectiveFeeRate(user);
              const feeSol = order.sol_amount * feeRate;
              const tokenAmount = (order.sol_amount * (1 - feeRate)) / currentPrice;
              // Check existing position
              const existing = db.getDb().prepare("SELECT * FROM positions WHERE token_ca = ? AND user_id = ? AND wallet_id = ? AND status = 'open'").get(order.token_ca, order.user_id, walletId);
              if (existing) {
                const newTokens = existing.token_amount + tokenAmount;
                const newInvested = existing.sol_invested + order.sol_amount;
                db.getDb().prepare("UPDATE positions SET sol_invested = ?, token_amount = ?, buy_price = ? WHERE position_id = ?").run(newInvested, newTokens, currentPrice, existing.position_id);
              } else {
                db.getDb().prepare("INSERT INTO positions (user_id, wallet_id, token_ca, token_name, sol_invested, token_amount, buy_price, entry_mcap, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')").run(order.user_id, walletId, order.token_ca, order.token_name || "", order.sol_amount, tokenAmount, currentPrice, currentMcap);
              }
              db.recordTrade({
                userId: order.user_id, walletId, tokenCa: order.token_ca, tokenName: order.token_name || "",
                platform: "devnet_mock", action: "buy", solAmount: order.sol_amount, tokenAmount,
                priceSol: currentPrice, feeSol, feeRate, txHash: "DEVNET_LIMIT_BUY_" + Date.now(), status: "confirmed",
              });
              db.addVolume(order.user_id, order.sol_amount);
              if (notifyFn) {
                notifyFn(order.user_id, 'limit_order', {
                  message:
                    `📌 *Limit Buy Executed*\n\n` +
                    `Token: *${order.token_name || order.token_ca.slice(0,8)}*\n` +
                    `Spent: *${order.sol_amount} SOL*\n` +
                    `Got: *${tokenAmount.toFixed(2)} tokens*\n` +
                    `Price: *${currentPrice.toFixed(8)}*`,
                });
              }
            } else {
              if (notifyFn) {
                notifyFn(order.user_id, 'limit_order', {
                  message: `⚠️ *Limit Buy Failed*\n\nToken: *${order.token_name || order.token_ca.slice(0,8)}*\nNeeded: *${order.sol_amount} SOL* but wallet balance too low.`,
                });
              }
            }
          }
        }
      }
      // Cancel the limit order
      db.cancelLimitOrder(order.user_id, order.id);

      // Execute
      if (order.order_type === "sell") {
        const pos = db.getDb()
          .prepare("SELECT * FROM positions WHERE token_ca = ? AND user_id = ? AND status = 'open'")
          .get(order.token_ca, order.user_id);
        if (pos) {
          const user = db.getUser(order.user_id);
          if (user) {
            const { mockSell } = require("./executor");
            // Can't use ctx here — use notify instead
            const sellPct   = order.sell_pct || 100;
            const pnlPct    = ((currentPrice - pos.buy_price) / pos.buy_price) * 100;
            const solRec    = pos.sol_invested * (1 + pnlPct / 100) * (sellPct / 100);
            const { getEffectiveFeeRate } = require("./executor");
            const feeRate   = getEffectiveFeeRate(user);
            const feeSol    = solRec * feeRate;

            db.recordTrade({
              userId: pos.user_id, walletId: pos.wallet_id,
              tokenCa: pos.token_ca, tokenName: pos.token_name || "",
              platform: "devnet_mock", action: "sell",
              solAmount: solRec, tokenAmount: pos.token_amount * (sellPct/100),
              priceSol: currentPrice, feeSol, feeRate,
              txHash: `DEVNET_LIMIT_${Date.now()}`, status: "confirmed",
            });

            if (sellPct >= 100) db.closePosition(pos.position_id);
            db.addVolume(pos.user_id, solRec);

            const sign = pnlPct >= 0 ? "+" : "";
            if (notifyFn) {
              notifyFn(order.user_id, "limit_order", {
                message:
                  `📌 *Limit Order Executed*\n\n` +
                  `Token: *${pos.token_name || pos.token_ca.slice(0,8)}*\n` +
                  `Sold: *${sellPct}%* at target price\n` +
                  `P&L: *${sign}${pnlPct.toFixed(1)}%*\n` +
                  `Received: *${solRec.toFixed(4)} SOL*`,
              });
              // Generate PnL card
              try {
                const { generateTradeCard } = require("./statsCard");
                const { RANKS } = require("./keyboards");
                const rank = RANKS[user.rank] || RANKS[1];
                const soldInvested = pos.sol_invested * (sellPct / 100);
                const pnlSolVal = solRec - soldInvested;
                const hideAmounts = db.getSysConfig(`pnlcard_hide_${user.user_id}`) === "1";
                const feeSaved = Math.max(0, (solRec * 0.01) - feeSol);
                const cardResult = await generateTradeCard({
                  username: user.username || "Trader",
                  rankName: rank.name, rankNum: user.rank || 1,
                  tokenName: pos.token_name || pos.token_ca.slice(0,8),
                  pnlSol: hideAmounts ? 0 : pnlSolVal,
                  pnlPct, sellPct,
                  pnlUsd: hideAmounts ? 0 : Math.abs(pnlSolVal * 150),
                  entryMcap: pos.entry_mcap || 0, exitMcap: currentMcap,
                  invested: hideAmounts ? 0 : soldInvested,
                  returned: hideAmounts ? 0 : solRec,
                  feeSaved: hideAmounts ? 0 : feeSaved,
                  feeRate: rank.fee,
                  dailyFeeSaved: hideAmounts ? 0 : db.getDailyFeeSaved(user.user_id),
                  weeklyFeeSaved: hideAmounts ? 0 : db.getWeeklyFeeSaved(user.user_id),
                  hideAmounts,
                });
                if (cardResult?.type === "photo") {
                  const pnlKb = { inline_keyboard: [[
                    { text: hideAmounts ? "Show Amounts" : "Hide Amounts", callback_data: `pnlcard_toggle_hide_${user.user_id}` }
                  ]]};
                  notifyFn(order.user_id, "pnl_card", { buffer: cardResult.buffer, kb: pnlKb });
                }
              } catch(e) { console.error('[LimitCard]', e.message); }
            }
          }
        }
      }
    } catch (e) {
      console.error("[StopLoss] Limit order error:", e.message);
    }
  }
}

module.exports = { monitorPositions };
