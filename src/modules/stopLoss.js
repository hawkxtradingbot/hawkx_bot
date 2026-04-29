// M14 — Stop Loss & Take Profit V12
// Monitors ALL open positions every 30 seconds
// Sells any token regardless of buy source (manual/channel/copy wallet/auto)
// When auto sell is OFF on source: position is still monitored by main settings SL/TP
// Limit orders also checked here

const db  = require("../../database");
const { getMockPrice } = require("./executor");

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
  const user     = db.getUser(pos.user_id);
  if (!user) return;

  const settings = db.getSettings(pos.user_id) || {};
  const currentPrice = getMockPrice(pos.token_ca);
  if (!currentPrice || !pos.buy_price) return;

  const pnlPct = ((currentPrice - pos.buy_price) / pos.buy_price) * 100;

  // Determine SL/TP to use:
  // 1. If source is copy_channel — check if that channel has auto_sell ON
  // 2. If source is copy_wallet — check if that wallet has auto_sell ON
  // 3. Otherwise use main settings SL/TP
  // KEY RULE: if auto sell is OFF on source → fall back to main settings SL/TP
  // This means user can always sell via main settings regardless of source

  let sl = 0, tp = 0;

  if (pos.source === "copy_channel" && pos.source_ref) {
    const channel = db.getDb()
      .prepare("SELECT * FROM copy_channels WHERE channel_id = ? AND user_id = ?")
      .get(pos.source_ref, pos.user_id);
    if (channel && channel.auto_sell_enabled) {
  sl = channel.stop_loss_pct   || 0;
      tp = channel.take_profit_pct || 0;
    } else {
      // Auto sell OFF on channel — use main settings only if auto_sell ON
      if (!settings.auto_sell) return;
      sl = settings.stop_loss_pct   || 0;
      tp = settings.take_profit_pct || 0;
    }
  } else if (pos.source === "copy_wallet") {
    const cw = db.getDb()
      .prepare("SELECT * FROM copy_wallets WHERE user_id = ? AND label = ?")
      .get(pos.user_id, pos.source_ref || "");
    if (cw && cw.auto_sell_enabled) {
      sl = settings.stop_loss_pct   || 0;
      tp = settings.take_profit_pct || 0;
    } else {
      // Auto sell OFF on copy wallet — use main settings only if auto_sell ON
      if (!settings.auto_sell) return;
      sl = settings.stop_loss_pct   || 0;
      tp = settings.take_profit_pct || 0;
    }
  } else {
    // Manual / auto_buy / sniper — only if auto_sell ON
    if (!settings.auto_sell) return;
    sl = settings.stop_loss_pct   || 0;
    tp = settings.take_profit_pct || 0;
  }

  // No rules set — skip
  if (sl === 0 && tp === 0) return;

  let triggered = null;

  // Stop Loss check
  if (sl !== 0 && pnlPct <= sl) {
    triggered = { type: "Stop Loss", pnlPct, sl, tp };
  }

  // Take Profit check
  if (tp !== 0 && pnlPct >= tp) {
    triggered = { type: "Take Profit", pnlPct, sl, tp };
  }

  if (!triggered) return;

  // Execute auto sell
  const solReceived  = pos.sol_invested * (1 + pnlPct / 100);
  const { getEffectiveFeeRate } = require("./executor");
  const feeRate      = getEffectiveFeeRate(user);
  const feeSol       = solReceived * feeRate;
  const txHash       = `DEVNET_AUTO_SELL_${Date.now()}`;

  db.recordTrade({
    userId:      pos.user_id,
    walletId:    pos.wallet_id,
    tokenCa:     pos.token_ca,
    tokenName:   pos.token_name || "Unknown",
    platform:    "devnet_mock",
    action:      "sell",
    solAmount:   solReceived,
    tokenAmount: pos.token_amount,
    priceSol:    currentPrice,
    feeSol,
    feeRate,
    txHash,
    status:      "confirmed",
  });

  db.closePosition(pos.position_id);
  db.addVolume(pos.user_id, solReceived);

  const { creditReferralEarnings } = require("./referrals");
  creditReferralEarnings(pos.user_id, null, feeSol);

  const sign = pnlPct >= 0 ? "+" : "";

  if (notifyFn) {
    notifyFn(pos.user_id, "auto_sell", {
      message:
        `🤖 *${triggered.type} Triggered*\n\n` +
        `Token: *${pos.token_name || pos.token_ca.slice(0,8)}*\n` +
        `P&L: *${sign}${pnlPct.toFixed(1)}%*\n` +
        `Received: *${solReceived.toFixed(4)} SOL*\n` +
        `Fee: *${feeSol.toFixed(6)} SOL*\n\n` +
        `_Position closed automatically._`,
    });
  }

  console.log(`[StopLoss] Auto sell: ${pos.token_name} P&L ${sign}${pnlPct.toFixed(1)}% — ${triggered.type}`);
}

// Check limit orders
async function checkLimitOrders(notifyFn) {
  const orders = db.getDb()
    .prepare("SELECT * FROM limit_orders WHERE active = 1")
    .all();

  for (const order of orders) {
    try {
      const currentPrice = getMockPrice(order.token_ca);
      if (!currentPrice) continue;

      let triggered = false;
      if (order.order_type === "buy"  && currentPrice <= order.target_price) triggered = true;
      if (order.order_type === "sell" && currentPrice >= order.target_price) triggered = true;

      if (!triggered) continue;

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
