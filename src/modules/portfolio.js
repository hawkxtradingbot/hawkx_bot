// M26 — Portfolio V13
const db  = require("../../database");
const { simulatePriceMovement } = require("./executor");
const { getTokenInfo, formatNum, formatPrice } = require("./tokenInfo");
const { InlineKeyboard } = require("grammy");

const SOURCE_LABELS = {
  manual:       "🏷 Manual",
  sniper:       "🎯 Sniper",
  auto_buy:     "[AutoBuy]",
  copy_channel: "📡 Channel",
  copy_wallet:  "👛 Copy",
};

const FILTER_LABELS = {
  all:         "📂 All",
  manual:      "🏷 Manual",
  channel:     "📡 Channel",
  copy_wallet: "👛 Copy Wallet",
  launch:      "🚀 Launch",
};
const FILTERS = ["all", "manual", "channel", "copy_wallet", "launch"];

function getSourceLabel(pos) {
  if (pos.source === "copy_channel" && pos.source_ref) return `📡 ${pos.source_ref.slice(0,10)}`;
  if (pos.source === "copy_wallet"  && pos.source_ref) return `👛 ${pos.source_ref.slice(0,10)}`;
  return SOURCE_LABELS[pos.source] || "🏷 Manual";
}

function formatHoldTime(createdAt) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h/24)}d ${h%24}h`;
}

function formatPnl(pnlPct) {
  // Cap display at reasonable values
  if (Math.abs(pnlPct) > 99999) return pnlPct > 0 ? "+99999%" : "-99999%";
  return `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`;
}

function formatSol(val) {
  if (Math.abs(val) > 9999) return val > 0 ? "+9999 SOL" : "-9999 SOL";
  if (Math.abs(val) < 0.001) return `${val >= 0 ? "+" : ""}${val.toFixed(6)}`;
  return `${val >= 0 ? "+" : ""}${val.toFixed(4)}`;
}

// ── Main portfolio screen ─────────────────────────────────────
async function getPortfolio(ctx, user, filter = "all", page = 0, expanded = false, selectedPosId = null, walletExpanded = false) {
  const allPositions = db.getPositionsBySource(user.user_id, filter === "launch" ? "all" : filter);
  const positions = allPositions.filter((p) => {
    if (p.wallet_id !== user.active_wallet_id) return false;
    if (filter === "launch") return p.source === "launch";
    if (filter === "manual") return p.source === "manual";
    return true;
  });

  const isProMode    = user.mode === "pro";
  const settings     = db.getSettings(user.user_id) || {};
  const activeWallet = db.getWallet(user.active_wallet_id);
  const walletBal    = activeWallet ? await db.getWalletBalance(activeWallet.public_key) : 0;
  const wallets2     = db.getWallets(user.user_id) || [];
  const walletIdx    = wallets2.findIndex((w) => w.wallet_id === user.active_wallet_id) + 1;
  const walletLabel  = walletIdx > 0 ? `W${walletIdx}` : "W1";

  const kb = new InlineKeyboard();

  // ── Wallet + Filter dropdowns ────────────────────────────────
  if (walletExpanded) {
    const wallets4 = db.getWallets(user.user_id) || [];
    for (let i = 0; i < wallets2.length; i += 3) {
      wallets2.slice(i, i+3).forEach((w, idx) => {
        const num = i+idx+1;
        const isSel = w.wallet_id === user.active_wallet_id;
        const lbl = (w.label && !w.label.match(/^W\d+$/)) ? ` ${w.label}` : ""; kb.text(isSel ? `W${num}${lbl} ✅`.slice(0,20) : `W${num}${lbl}`.slice(0,20), `pos_setwallet_${w.wallet_id}`);
      });
      kb.row();
    }
    kb.text("▲ Close", `pos_filter_${filter}_${page}_0`).row();
  } else if (expanded) {
    FILTERS.forEach((f) => {
      kb.text(filter === f ? `${FILTER_LABELS[f]} ✅` : FILTER_LABELS[f], `pos_filter_${f}_0_0`);
    });
    kb.row();
  } else {
    kb.text(`💼 ${walletLabel} ▼`, `pos_wallet_expand`)
      .text(`${FILTER_LABELS[filter] || FILTER_LABELS.all} ▼`, `pos_expand_${filter}_${page}`)
      .row();
  }

  // ── Empty state ──────────────────────────────────────────────
  if (!positions.length) {
    kb.text("🟢 Buy a Token", "trade_quickbuy")
      .text("🔄 Refresh",  `pos_filter_${filter}_0_0`)
      .row();
    kb.text("← Back", "menu_main").row();
    const msg = `📂 <b>Positions</b> — ${FILTER_LABELS[filter] || "All"}\n\n<i>No open positions yet.</i>\n\n💡 Tap 🟢 Buy a Token to make your first trade — it shows here with live PnL.\n\n💼 ${walletLabel}: <b>${walletBal.toFixed(4)} SOL</b>`;
    try { await ctx.editMessageText(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
    catch { await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
    return;
  }

  // ── Pagination ───────────────────────────────────────────────
  const perPage    = 3;
  const totalPages = Math.ceil(positions.length / perPage);
  const paginated  = positions.slice(page * perPage, (page + 1) * perPage);

  // ── Selected position ────────────────────────────────────────
  let selPos = null;
  if (selectedPosId) {
    selPos = paginated.find((p) => p.position_id === selectedPosId) || paginated[0];
  } else {
    selPos = paginated[0];
  }

  // ── Build message ────────────────────────────────────────────
  let msg = `📂 <b>Positions</b> — ${FILTER_LABELS[filter] || "All"}\n`;
  msg += `💼 ${walletLabel}: <b>${walletBal.toFixed(4)} SOL</b>\n`;
  msg += `🤖 auto-sell · 📉 DCA · 📍 limit\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;

  let totalInvested = 0, totalCurrent = 0;

  for (const pos of paginated) {
    const currentPrice = simulatePriceMovement(pos.token_ca);
    const pnlPct       = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
    const currentValue = pos.sol_invested * (1 + pnlPct / 100);
    totalInvested += pos.sol_invested;
    totalCurrent  += currentValue;
    const pnlSol   = currentValue - pos.sol_invested;
    const icon     = pnlPct >= 0 ? "🟢" : "🔴";
    const name     = (pos.token_name || pos.token_ca.slice(0, 8)).slice(0, 12);
    const srcTag   = getSourceLabel(pos);
    const isSel    = selPos && pos.position_id === selPos.position_id;
    const holdTime = formatHoldTime(pos.created_at || Date.now());

    // Automation status icons (🤖 auto-sell · 📉 DCA · 📍 limit)
    let autoTag = "";
    if (pos.auto_sell_template_id) {
      const t = db.getAutoSellTemplate(pos.user_id, pos.auto_sell_template_id);
      if (t) autoTag = ` 🤖 ${t.name}`;
    }
    let autoIcons = "";
    try {
      const dcaActive = (db.getDcaOrders(pos.user_id, pos.token_ca) || []).some(o => !o.paused && o.buys_done < o.total_buys);
      const limitActive = (db.getLimitOrders(pos.user_id, pos.token_ca) || []).length > 0;
      if (dcaActive) autoIcons += " 📉";
      if (limitActive) autoIcons += " 📍";
    } catch {}

    msg += `${isSel ? "▶ " : ""}${icon} <b>${name}</b> ${srcTag}${autoTag}${autoIcons}\n`;
    msg += `${formatPnl(pnlPct)} | ${formatSol(pnlSol)} SOL\n`;
    msg += `Bought: ${pos.sol_invested.toFixed(4)} → Now: ${currentValue.toFixed(4)} SOL\n`;
    msg += `Holdings: ${(pos.token_amount||0).toLocaleString()} ${name} | Hold: ${holdTime}\n`;

    // MCap
    if (pos.entry_mcap && pos.entry_mcap > 0) {
      const entryMcap = pos.entry_mcap >= 1000000
        ? `$${(pos.entry_mcap/1000000).toFixed(1)}M`
        : `$${(pos.entry_mcap/1000).toFixed(0)}K`;
      msg += `Entry MCap: ${entryMcap}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━\n`;
  }

  // Portfolio summary
  const totalPnl  = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested * 100) : 0;
  const totalSign = totalPnl >= 0 ? "+" : "";
  const totalPnlSol = totalCurrent - totalInvested;
  msg += `Total P&L: <b>${totalSign}${totalPnl.toFixed(2)}%</b> | ${totalSign}${totalPnlSol.toFixed(4)} SOL\n`;

  // ── Token selector buttons ───────────────────────────────────
  paginated.forEach((pos) => {
    let name = (pos.token_name || pos.token_ca.slice(0,8)).trim();
    if (name.length > 10) name = name.slice(0, 10) + "…";
    const isSel = selPos && pos.position_id === selPos.position_id;
    const pnlPct = pos.buy_price > 0 ? ((simulatePriceMovement(pos.token_ca) - pos.buy_price) / pos.buy_price * 100) : 0;
    const icon  = pnlPct >= 0 ? "🟢" : "🔴";
    kb.text(isSel ? `${icon} ${name} ✅` : `${icon} ${name}`, `pos_select_${pos.position_id}_${filter}_${page}`);
  });
  kb.row();

  // ── Pagination (cleaner labeled arrows) ──────────────────────
  if (totalPages > 1) {
    if (page > 0) kb.text("◀ Prev", `pos_filter_${filter}_${page-1}_0`);
    kb.text(`Page ${page+1}/${totalPages}`, "noop");
    if (page < totalPages - 1) kb.text("Next ▶", `pos_filter_${filter}_${page+1}_0`);
    kb.row();
  }

  // ── Buy/Sell buttons for selected token ──────────────────────
  if (selPos) {
    db.setSysConfig(`pending_ca_${user.user_id}`, selPos.token_ca);
    db.setSysConfig(`pending_ca_time_${user.user_id}`, String(Date.now()));

    const b1 = settings.buy_amt_1 || 0.1;
    const b2 = settings.buy_amt_2 || 0.5;
    const b3 = settings.buy_amt_3 || 1.0;
    kb.text(`🟢 ${b1}`, `buy_ca_amt_${b1}`).text(`🟢 ${b2}`, `buy_ca_amt_${b2}`).text(`🟢 ${b3}`, `buy_ca_amt_${b3}`).text("✏️", "buy_ca_custom").row();

    if (isProMode) {
      kb.text("🔴 25%",  `sell_pct_25_${selPos.position_id}`)
        .text("🔴 50%",  `sell_pct_50_${selPos.position_id}`)
        .text("🔴 75%",  `sell_pct_75_${selPos.position_id}`)
        .text("🔴 100%", `sell_pct_100_${selPos.position_id}`)
        .row();
      kb.text("📍 Limit", `lo_token_${selPos.position_id}`)
        .text("📉 DCA", "scanner_dca")
        .text("📌 Auto Sell", `pos_autosell_${selPos.position_id}`)
        .row();
    } else {
      const s1 = settings.sell_pct_1 || 25;
      const s2 = settings.sell_pct_2 || 50;
      kb.text(`🔴 ${s1}%`,  `sell_pct_${s1}_${selPos.position_id}`)
        .text(`🔴 ${s2}%`,  `sell_pct_${s2}_${selPos.position_id}`)
        .text("🔴 Initial", `sell_initial_${selPos.position_id}`)
        .row();
      // Beginner: Limit + DCA (beginner-friendly), NO Auto Sell
      kb.text("📍 Limit", `lo_token_${selPos.position_id}`)
        .text("📉 DCA", "scanner_dca")
        .row();
    }
  }

  kb.text("← Back",    "menu_main")
    .text("🔄 Refresh", `pos_filter_${filter}_${page}_${selPos?.position_id||0}`)
    .row();

  try { await ctx.editMessageText(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
  catch { await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
}

// ── Single token position view (shown after buy) ──────────────
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

  db.setSysConfig(`last_position_${user.user_id}`, String(positionId));
  db.setSysConfig(`pending_ca_${user.user_id}`, pos.token_ca);
  db.setSysConfig(`pending_ca_time_${user.user_id}`, String(Date.now()));

  const currentPrice = simulatePriceMovement(pos.token_ca);
  const pnlPct       = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
  const currentValue = pos.sol_invested * (1 + pnlPct / 100);
  const pnlSol       = currentValue - pos.sol_invested;
  const pnlUsd       = Math.abs(pnlSol * 150);
  const icon         = pnlPct >= 0 ? "🟢" : "🔴";
  const sign         = pnlPct >= 0 ? "+" : "";
  const holdTime     = formatHoldTime(pos.created_at || Date.now());

  const tokenData = await getTokenInfo(pos.token_ca);
  const dexUrl    = `https://dexscreener.com/solana/${pos.token_ca}`;
  const tokenName = tokenData.name || pos.token_name || pos.token_ca.slice(0,8);

  let marketLine = "";
  const parts = [];
  if (tokenData.mcap)      parts.push(`📊 ${formatNum(tokenData.mcap)}`);
  if (tokenData.liquidity) parts.push(`💧 ${formatNum(tokenData.liquidity)}`);
  if (tokenData.price)     parts.push(`💲 ${formatPrice(tokenData.price)}`);
  if (parts.length > 0)    marketLine = parts.join(" | ") + "\n";
  // Condensed scanner: age + 1-line safety
  let scannerLine = "";
  try {
    const safety = await getTokenSafety(pos.token_ca);
    if (safety && tokenData.holders) safety.holders = tokenData.holders;
    const ageStr = formatAge(tokenData.pairCreatedAt);
    if (ageStr) scannerLine += `🕐 Age: ${ageStr}\n`;
    const mk = (v) => v === true ? "✅" : v === false ? "🔴" : null;
    const sb = [];
    if (mk(safety.mintRevoked)) sb.push(`${mk(safety.mintRevoked)} Mint`);
    if (mk(safety.freezeRevoked)) sb.push(`${mk(safety.freezeRevoked)} Freeze`);
    const config = require("../config"); const showTop = config.HELIUS_API_KEY && !config.MOCK_TRADES; if (showTop && safety.topHolderPct !== null && safety.topHolderPct !== undefined) {
      const tm = safety.topHolderPct < 20 ? "✅" : safety.topHolderPct < 35 ? "⚠️" : "🔴";
      sb.push(`${tm} Top ${safety.topHolderPct}%`);
    }
    if (sb.length) scannerLine += `🛡 ${sb.join("  ")}\n`;
  } catch {}
  // Automation summary line
  let autoSummary = "";
  try {
    const dcaOrders = db.getDcaOrders(pos.user_id, pos.token_ca) || [];
    const dcaActive = dcaOrders.find(o => !o.paused && o.buys_done < o.total_buys);
    const limitOrders = db.getLimitOrders(pos.user_id, pos.token_ca) || [];
    const parts = [];
    if (pos.auto_sell_template_id) parts.push("🤖 Auto-sell ON");
    if (dcaActive) parts.push(`📉 DCA ${dcaActive.buys_done}/${dcaActive.total_buys}`);
    if (limitOrders.length) parts.push(`📍 Limit ${limitOrders.length}`);
    if (parts.length) autoSummary = parts.join(" · ") + "\n";
  } catch {}

  let autoSellLine = "";
  if (pos.auto_sell_template_id) {
    const t = db.getAutoSellTemplate(pos.user_id, pos.auto_sell_template_id);
    if (t) {
      const state = JSON.parse(db.getSysConfig(`ast_state_${pos.position_id}`) || "{}");
      const tpHit = state.tp_hit || 0;
      const slHit = state.sl_triggered || 0;
      autoSellLine = `\n🤖 Auto Sell: <b>${t.name}</b>\n`;
      for (let i = 1; i <= 3; i++) {
        const sl = t[`sl_${i}`] || 0;
        if (sl !== 0) {
          const hit = i === 1 ? slHit > 0 : i === 2 ? tpHit >= 1 : tpHit >= 2;
          autoSellLine += `🛑 SL${i}: ${sl}% ${hit ? "✅ Active" : "⏳ Waiting"}\n`;
        }
      }
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
    `${icon} <a href="${dexUrl}"><b>${tokenName}</b></a> — ${getSourceLabel(pos)}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📋 <code>${pos.token_ca}</code>\n\n` +
    `🛒 Bought: <b>${pos.sol_invested.toFixed(4)} SOL</b>\n` +
    `💰 Holdings: <b>${(pos.token_amount||0).toLocaleString()}</b> ${tokenName}\n` +
    `📈 Current: <b>${currentValue.toFixed(4)} SOL</b>\n` +
    `P&L: <b>${sign}${formatPnl(pnlPct)}</b> | ${sign}${formatSol(pnlSol)} SOL | $${pnlUsd.toFixed(2)}\n` +
    `⏱ Hold: <b>${holdTime}</b>\n` +
    (marketLine ? `\n${marketLine}` : "") +
    (scannerLine ? scannerLine : "") +
    (autoSummary ? autoSummary : "") +
    (autoSellLine || "") +
    `\n💼 ${activeWallet?.label || "Wallet"}: <b>${walletBal.toFixed(4)} SOL</b>`;

  const b1 = settings.buy_amt_1 || 0.1;
  const b2 = settings.buy_amt_2 || 0.5;

  const kb = new InlineKeyboard();
  kb.text(`🟢 ${b1} SOL`, `buy_ca_amt_${b1}`)
    .text(`🟢 ${b2} SOL`, `buy_ca_amt_${b2}`)
    .text("✏️ Custom",    "buy_ca_custom")
    .row();

  if (isProMode) {
    kb.text("🔴 25%",  `sell_pct_25_${positionId}`)
      .text("🔴 50%",  `sell_pct_50_${positionId}`)
      .text("🔴 75%",  `sell_pct_75_${positionId}`)
      .text("🔴 100%", `sell_pct_100_${positionId}`)
      .row();
    kb.text("📍 Limit", `lo_token_${positionId}`).text("📉 DCA", "scanner_dca").text("🤖 Auto-Sell", `pos_autosell_${positionId}`).row();
  } else {
    const s1 = settings.sell_pct_1 || 25;
    const s2 = settings.sell_pct_2 || 50;
    kb.text(`🔴 ${s1}%`,  `sell_pct_${s1}_${positionId}`)
      .text(`🔴 ${s2}%`,  `sell_pct_${s2}_${positionId}`)
      .text("🔴 Initial", `sell_initial_${positionId}`)
      .row();
    // Beginner: Limit + DCA (no Auto Sell)
    kb.text("📍 Limit", `lo_token_${positionId}`).text("📉 DCA", "scanner_dca").row();
  }

  kb.text("← Positions", "menu_portfolio")
    .text("🔄 Refresh",  `pos_token_${positionId}`)
    .row();

  try { await ctx.editMessageText(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
  catch { await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
}

module.exports = { getPortfolio, getTokenPosition, getSourceLabel };
