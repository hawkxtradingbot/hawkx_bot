// M26 — Portfolio V12 Final
// Dropdown filter buttons — tap All to expand/collapse
// Token name buttons stay on same screen — show selected icon
// Buy/Sell applies to selected token only
// Live token data from DexScreener

const db  = require("../../database");
const { simulatePriceMovement } = require("./executor");
const { getTokenInfo, formatNum, formatPrice } = require("./tokenInfo");
const { InlineKeyboard } = require("grammy");

const SOURCE_LABELS = {
  manual:       "🏷 Manual",
  sniper:       "🎯 Sniper",
  auto_buy:     "🤖 Auto",
  copy_channel: "📡 Channel",
  copy_wallet:  "👛 Copy",
};

const FILTER_LABELS = {
  all:         "📂 All",
  manual:      "🏷 Manual",
  channel:     "📡 Channel",
  copy_wallet: "👛 Copy Wallet",
};
const FILTERS = ["all", "manual", "channel", "copy_wallet"];

function getSourceLabel(pos) {
  if (pos.source === "copy_channel" && pos.source_ref) return `📡 ${pos.source_ref.slice(0,10)}`;
  if (pos.source === "copy_wallet"  && pos.source_ref) return `👛 ${pos.source_ref.slice(0,10)}`;
  return SOURCE_LABELS[pos.source] || "🏷 Manual";
}

// ── Main portfolio screen ─────────────────────────────────────
async function getPortfolio(ctx, user, filter = "all", page = 0, expanded = false, selectedPosId = null) {
  const allPositions = db.getPositionsBySource(user.user_id, filter);
  const positions    = allPositions.filter((p) => p.wallet_id === user.active_wallet_id);
  const isProMode    = user.mode === "pro";
  const settings     = db.getSettings(user.user_id) || {};
  const activeWallet = db.getWallet(user.active_wallet_id);
  const walletBal    = activeWallet ? await db.getWalletBalance(activeWallet.public_key) : 0;
  const wallets2     = db.getWallets(user.user_id) || [];
  const walletIdx    = wallets2.findIndex((w) => w.wallet_id === user.active_wallet_id) + 1;
  const walletLabel  = walletIdx > 0 ? `W${walletIdx}` : "W1";

  const kb = new InlineKeyboard();

  // ── Filter button row ────────────────────────────────────────
  if (expanded) {
    // Show all filter options
    FILTERS.forEach((f) => {
      kb.text(filter === f ? `${FILTER_LABELS[f]} ✅` : FILTER_LABELS[f], `pos_filter_${f}_0_0`);
    });
    kb.row();
  } else {
    // Show only selected filter with dropdown arrow
    kb.text(`${FILTER_LABELS[filter] || FILTER_LABELS.all} ▼`, `pos_expand_${filter}_${page}`).row();
  }

  if (!positions.length) {
    kb.text("🧪 Mock Buy",  "devnet_mock_buy")
      .text("🔄 Refresh",  `pos_filter_${filter}_0_0`)
      .row();
    kb.text("← Back", "menu_main").row();

    const msg = `📂 <b>Positions</b> — ${FILTER_LABELS[filter] || "All"}\n\n<i>This wallet has no open positions.</i>\n\n💼 ${walletLabel}: <b>${walletBal.toFixed(4)} SOL</b>`;
    try { await ctx.editMessageText(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
    catch { await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
    return;
  }

  // Pagination
  const perPage    = 3;
  const totalPages = Math.ceil(positions.length / perPage);
  const paginated  = positions.slice(page * perPage, (page + 1) * perPage);

  // Determine selected position
  let selPos = null;
  if (selectedPosId) {
    selPos = paginated.find((p) => p.position_id === selectedPosId) || paginated[0];
  } else {
    selPos = paginated[0];
  }

  // Build message
  let msg = `📂 <b>Positions</b> — ${FILTER_LABELS[filter] || "All"}\n`;
  msg += `${page * perPage + 1}–${Math.min((page+1)*perPage, positions.length)} of ${positions.length}\n\n`;

  let totalInvested = 0, totalCurrent = 0;

  for (const pos of paginated) {
    const currentPrice = simulatePriceMovement(pos.token_ca);
    const pnlPct       = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
    const currentValue = pos.sol_invested * (1 + pnlPct / 100);
    totalInvested += pos.sol_invested;
    totalCurrent  += currentValue;
    const icon   = pnlPct >= 0 ? "🟢" : "🔴";
    const sign   = pnlPct >= 0 ? "+" : "";
    const name   = (pos.token_name || pos.token_ca.slice(0, 8)).slice(0, 10);
    const srcTag = getSourceLabel(pos);
    const pnlSol = currentValue - pos.sol_invested;
    const isSel  = selPos && pos.position_id === selPos.position_id;
    msg += `${isSel ? "▶ " : ""}${icon} <b>${name}</b> ${srcTag}\n`;
    const pnlUsd2 = (Math.abs(pnlSol) * 150).toFixed(2);
    msg += `  P&L: <b>${sign}${pnlPct.toFixed(1)}%</b> (${sign}${pnlSol.toFixed(4)} SOL)($${pnlUsd2}) <a href="https://t.me/hawkx_devnet_fazle_bot?start=pnlcard_${pos.position_id}">📊</a>\n\n`;
  }

  const totalPnl  = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested * 100) : 0;
  const totalSign = totalPnl >= 0 ? "+" : "";
  msg += `━━━━━━━━━━\n`;
  msg += `💼 <b>${walletLabel}</b>: ${walletBal.toFixed(4)} SOL\n`;
  msg += `📊 Total P&L: <b>${totalSign}${totalPnl.toFixed(2)}%</b>`;

  // Selected token detail
  if (selPos) {
    const cp      = simulatePriceMovement(selPos.token_ca);
    const pnlPct  = selPos.buy_price > 0 ? ((cp - selPos.buy_price) / selPos.buy_price * 100) : 0;
    const pnlSol  = selPos.sol_invested * (pnlPct / 100);
    const sign    = pnlPct >= 0 ? "+" : "";
    const dexUrl  = `https://dexscreener.com/solana/${selPos.token_ca}`;
    const tName   = selPos.token_name || selPos.token_ca.slice(0,8);
    msg += `\n\n━━━━━━━━━━\n`;
    msg += `Selected: <a href="${dexUrl}"><b>${tName}</b></a>\n`;
    msg += `P&L: <b>${sign}${pnlPct.toFixed(1)}%</b> (${sign}${pnlSol.toFixed(4)} SOL)\n`;
    msg += `Invested: <b>${selPos.sol_invested.toFixed(4)} SOL</b>`;
  }

  // Token name buttons — side by side, ✅ on selected
  paginated.forEach((pos) => {
    const name  = (pos.token_name || pos.token_ca.slice(0,6)).slice(0,6);
    const isSel = selPos && pos.position_id === selPos.position_id;
    kb.text(isSel ? `${name} ✅` : name, `pos_select_${pos.position_id}_${filter}_${page}`);
  });
  kb.row();

  // Prev/Next
  if (totalPages > 1) {
    if (page > 0) kb.text("◀", `pos_filter_${filter}_${page-1}_0`);
    kb.text(`${page+1}/${totalPages}`, "noop");
    if (page < totalPages - 1) kb.text("▶", `pos_filter_${filter}_${page+1}_0`);
    kb.row();
  }

  // Buy buttons — 2 presets + custom
  if (selPos) {
    // Set CA for buy buttons
    db.setSysConfig(`pending_ca_${user.user_id}`, selPos.token_ca);
    db.setSysConfig(`pending_ca_time_${user.user_id}`, String(Date.now()));

    const b1 = settings.buy_amt_1 || 0.1;
    const b2 = settings.buy_amt_2 || 0.5;
    kb.text(`🟢 ${b1} SOL`, `buy_ca_amt_${b1}`)
      .text(`🟢 ${b2} SOL`, `buy_ca_amt_${b2}`)
      .text("✏️ Custom",    "buy_ca_custom")
      .row();

    // Sell buttons
    if (isProMode) {
      kb.text("🔴 25%",  `sell_pct_25_${selPos.position_id}`)
        .text("🔴 50%",  `sell_pct_50_${selPos.position_id}`)
        .text("🔴 100%", `sell_pct_100_${selPos.position_id}`)
        .row();
    } else {
      const s1 = settings.sell_pct_1 || 25;
      const s2 = settings.sell_pct_2 || 50;
      kb.text(`🔴 ${s1}%`,  `sell_pct_${s1}_${selPos.position_id}`)
        .text(`🔴 ${s2}%`,  `sell_pct_${s2}_${selPos.position_id}`)
        .text("🔴 Initial", `sell_initial_${selPos.position_id}`)
        .row();
    }
  }
  if (selPos && isProMode) {
    kb.text("📋 Limit Order", `limit_token_${selPos.position_id}`)
      .text("📌 Limit Sell",  `sell_limit_${selPos.position_id}`)
      .row();
  }
  kb.text("← Back",    "menu_main")
    .text("🔄 Refresh", `pos_filter_${filter}_${page}_${selPos?.position_id||0}`)
    .row();

  try { await ctx.editMessageText(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
  catch { await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
}

// ── Single token position view (from direct tap) ──────────────
async function getTokenPosition(ctx, user, positionId) {
  const pos       = db.getPosition(positionId, user.user_id);
  const isProMode = user.mode === "pro";
  const settings  = db.getSettings(user.user_id) || {};
  const activeWallet = db.getWallet(user.active_wallet_id) || null;
  const walletBal    = activeWallet ? (await db.getWalletBalance(activeWallet.public_key)) || 0 : 0;

  if (!pos) {
    try { await ctx.answerCallbackQuery("Position not found."); } catch {}
    return;
  }

  // Save CA for buy buttons
  db.setSysConfig(`last_position_${user.user_id}`, String(positionId));
  db.setSysConfig(`pending_ca_${user.user_id}`, pos.token_ca);
  db.setSysConfig(`pending_ca_time_${user.user_id}`, String(Date.now()));

  const currentPrice = simulatePriceMovement(pos.token_ca);
  const pnlPct       = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
  const currentValue = pos.sol_invested * (1 + pnlPct / 100);
  const pnlSol       = currentValue - pos.sol_invested;
  const pnlUsd       = pnlSol * 150;
  const icon         = pnlPct >= 0 ? "🟢" : "🔴";
  const sign         = pnlPct >= 0 ? "+" : "";

  // Fetch live token data
  const tokenData = await getTokenInfo(pos.token_ca);
  const dexUrl    = `https://dexscreener.com/solana/${pos.token_ca}`;
  const tokenName = tokenData.name || pos.token_name || pos.token_ca.slice(0,8);

  // Market info — side by side
  let marketLine = "";
  const parts = [];
  if (tokenData.mcap)      parts.push(`📊 ${formatNum(tokenData.mcap)}`);
  if (tokenData.liquidity) parts.push(`💧 ${formatNum(tokenData.liquidity)}`);
  if (tokenData.price)     parts.push(`💲 ${formatPrice(tokenData.price)}`);
  if (parts.length > 0)    marketLine = parts.join(" | ") + "\n";

  // Auto sell template status
  let autoSellLine = "";
  if (pos.auto_sell_template_id) {
    const t = db.getAutoSellTemplate(pos.user_id, pos.auto_sell_template_id);
    if (t) {
      const state = JSON.parse(db.getSysConfig(`ast_state_${pos.position_id}`) || "{}");
      const tpHit = state.tp_hit || 0;
      const slHit = state.sl_triggered || 0;
      autoSellLine = `\n🤖 Auto Sell: <b>${t.name}</b>\n`;
      // Show active SL
      for (let i = 1; i <= 3; i++) {
        const sl = t[`sl_${i}`] || 0;
        if (sl !== 0) {
          const hit = i === 1 ? slHit > 0 : i === 2 ? tpHit >= 1 : tpHit >= 2;
          autoSellLine += `🛑 SL${i}: ${sl}% ${hit ? "✅ Active" : "⏳ Waiting"}\n`;
        }
      }
      // Show TPs
      for (let i = 1; i <= 5; i++) {
        const tp = t[`tp_${i}`] || 0;
        if (tp !== 0) {
          const hit = tpHit >= i;
          autoSellLine += `🎯 TP${i}: +${tp}% ${hit ? "✅ Hit" : "⏳ Waiting"}\n`;
        }
      }
    }
  }

  const msg =
    `${icon} <a href="${dexUrl}"><b>${tokenName}</b></a>\n` +
    `${getSourceLabel(pos)}\n\n` +
    `📋 CA:\n<code>${pos.token_ca}</code>\n\n` +
    `💰 Invested: <b>${pos.sol_invested.toFixed(4)} SOL</b>\n` +
    `📈 P&L: <b>${sign}${pnlPct.toFixed(1)}%</b> (${sign}${pnlSol.toFixed(4)} SOL / $${pnlUsd.toFixed(2)})\n` +
    `🏦 Balance: <b>${(pos.token_amount||0).toLocaleString()}</b> tokens\n` +
    (marketLine ? `\n${marketLine}` : "") +
    (autoSellLine ? `\n${autoSellLine}` : "") +
    `💼 ${activeWallet?.label || "Wallet"}: <b>${walletBal.toFixed(4)} SOL</b>\n`;

  const b1 = settings.buy_amt_1 || 0.1;
  const b2 = settings.buy_amt_2 || 0.5;

  const kb = new InlineKeyboard();

  // Buy buttons
  kb.text(`🟢 ${b1} SOL`, `buy_ca_amt_${b1}`)
    .text(`🟢 ${b2} SOL`, `buy_ca_amt_${b2}`)
    .text("✏️ Custom",    "buy_ca_custom")
    .row();

  // Sell buttons
  if (isProMode) {
    kb.text("🔴 25%",  `sell_pct_25_${positionId}`)
      .text("🔴 50%",  `sell_pct_50_${positionId}`)
      .text("🔴 75%",  `sell_pct_75_${positionId}`)
      .text("🔴 100%", `sell_pct_100_${positionId}`)
      .row();
    kb.text("📌 Limit Sell",   `sell_limit_${positionId}`)
      .text("📋 Limit Orders", `limit_token_${positionId}`)
      .row();
  } else {
    const s1 = settings.sell_pct_1 || 25;
    const s2 = settings.sell_pct_2 || 50;
    kb.text(`🔴 ${s1}%`,  `sell_pct_${s1}_${positionId}`)
      .text(`🔴 ${s2}%`,  `sell_pct_${s2}_${positionId}`)
      .text("🔴 Initial", `sell_initial_${positionId}`)
      .row();
  }

  kb.text("← Positions", "menu_portfolio")
    .text("🔄 Refresh",  `pos_token_${positionId}`)
    .row();

  try { await ctx.editMessageText(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
  catch { await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
}

module.exports = { getPortfolio, getTokenPosition, getSourceLabel };
