// M26 — Portfolio V13
const db  = require("../../database");
const { simulatePriceMovement } = require("./executor");
const { getTokenInfo, getTokenSafety, formatAge, formatNum, formatPrice } = require("./tokenInfo");
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

let _solPxCache = { px: 0, t: 0 };
async function getSolPriceUsd() {
  if (Date.now() - _solPxCache.t < 60000 && _solPxCache.px > 0) return _solPxCache.px;
  const axios = require("axios");
  // Primary: Jupiter price API (direct SOL/USD, reliable)
  try {
    const { data } = await axios.get("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112", { timeout: 5000 });
    const px = parseFloat(data?.["So11111111111111111111111111111111111111112"]?.usdPrice || 0);
    if (px > 0) { _solPxCache = { px, t: Date.now() }; return px; }
  } catch {}
  // Fallback: DexScreener, but pick the SOL/USDC or SOL/USDT pair (not random pairs[0])
  try {
    const { data } = await axios.get("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112", { timeout: 5000 });
    const pairs = (data && data.pairs) || [];
    const stable = pairs.find(pr => ["USDC","USDT"].includes(pr.quoteToken?.symbol) && pr.baseToken?.symbol === "SOL");
    const px = stable ? parseFloat(stable.priceUsd) : 0;
    if (px > 0) { _solPxCache = { px, t: Date.now() }; return px; }
  } catch {}
  return _solPxCache.px || 150;
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
  const _activeChainPf = db.getActiveChain(user.user_id);
  const _chainLabelPf = ({ SOL: "🟣 Solana", HOOD: "🪶 Robinhood" })[_activeChainPf] || _activeChainPf;
  const _awPf = db.getWallet(user.active_wallet_id);
  if (_awPf && (_awPf.chain || "SOL") !== _activeChainPf) {
    const _fix = db.getWalletForChain(user.user_id, _activeChainPf);
    if (_fix) { db.updateUser(user.user_id, { active_wallet_id: _fix.wallet_id }); user.active_wallet_id = _fix.wallet_id; }
  }
  const allPositions = db.getPositionsBySource(user.user_id, filter === "launch" ? "all" : filter);
  let positions = allPositions.filter((p) => {
    if ((p.chain || "SOL") !== _activeChainPf) return false;
    if (p.wallet_id !== user.active_wallet_id) return false;
    if (filter === "launch") return p.source === "launch";
    if (filter === "manual") return p.source === "manual";
    return true;
  });

  // Merge in REAL on-chain tokens not already tracked as a position - shown the same way as
  // HawkX-bought tokens, using current price as both entry and current (so PnL starts at 0%
  // until price moves, since we do not know the true historical cost for externally-acquired tokens).
  if (_activeChainPf === "SOL" && (filter === "all" || filter === "manual")) {
    try {
      const activeWalletPf = db.getWallet(user.active_wallet_id);
      if (activeWalletPf) {
        const { getWalletTokenBalances } = require("./walletScanner");
        const _timeoutMs = 5000;
        const onChainTokens = await Promise.race([
          getWalletTokenBalances(activeWalletPf.public_key),
          new Promise((_, reject) => setTimeout(() => reject(new Error("wallet scan timeout")), _timeoutMs)),
        ]);
        const trackedCasPf = new Set(positions.map(p => p.token_ca));
        const untrackedPf = onChainTokens.filter(t => !trackedCasPf.has(t.mint));
        if (untrackedPf.length) {
          const { getTokenInfo: _gti } = require("./tokenInfo");
          const untrackedPositions = await Promise.all(untrackedPf.map(async (t) => {
            const info = await _gti(t.mint).catch(() => null);
            const price = info?.price || 0;
            const rawName = info?.name || t.symbol || t.mint.slice(0,8);
            const safeName = String(rawName).replace(/[<>&"']/g, "").slice(0, 40); // strip HTML-breaking chars - token metadata is arbitrary on-chain data we do not control
            return {
              position_id: `unt${t.mint.slice(0,8)}`,
              user_id: user.user_id, wallet_id: user.active_wallet_id,
              token_ca: t.mint, token_name: safeName || t.mint.slice(0,8),
              buy_price: price, sol_invested: t.amount * price, token_amount: t.amount,
              status: "open", source: "external", source_ref: "", chain: "SOL",
              entry_mcap: info?.mcap || 0, _untracked: true,
            };
          }));
          positions = positions.concat(untrackedPositions);
        }
      }
    } catch (e) { console.error("[Portfolio] on-chain merge failed:", e.message); }
  }

  const isProMode    = user.mode === "pro";
  const settings     = db.getSettings(user.user_id) || {};
  const activeWallet = db.getWallet(user.active_wallet_id);
  const walletBal    = activeWallet ? await db.getWalletBalance(activeWallet.public_key) : 0;
  const wallets2     = (db.getWallets(user.user_id) || []).filter(w => (w.chain || "SOL") === _activeChainPf);
  const walletIdx    = wallets2.findIndex((w) => w.wallet_id === user.active_wallet_id) + 1;
  const walletLabel  = walletIdx > 0 ? `W${walletIdx}` : "W1";

  const kb = new InlineKeyboard();

  // ── Wallet + Filter dropdowns ────────────────────────────────
  if (walletExpanded) {
    const wallets4 = wallets2;
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
    const msg = `📂 <b>Portfolio</b> — ${FILTER_LABELS[filter] || "All"}\n<i>${_chainLabelPf}</i>\n\n<i>No open positions yet.</i>\n\n💡 Tap 🟢 Buy a Token to make your first trade — it shows here with live PnL.\n\n💼 ${walletLabel}: <b>${walletBal.toFixed(4)} SOL</b>`;
    try { await ctx.editMessageText(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); }
    catch (e) {
      if (!String(e.description || e.message || "").includes("not modified")) {
        try { await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); } catch {}
      }
    }
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
  let msg = `📂 <b>Portfolio</b> — ${FILTER_LABELS[filter] || "All"}\n<i>${_chainLabelPf}</i>\n`;
  msg += `🤖 auto-sell · 📉 DCA · 📍 limit\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;

  let totalInvested = 0, totalCurrent = 0;

  const REAL_PORT = process.env.MOCK_TRADES === "false";
  for (const pos of paginated) {
    let currentPrice;
    if (REAL_PORT) {
      currentPrice = null;
      try {
        const { getTokenOverview } = require("./birdeye");
        const ov = await getTokenOverview(pos.token_ca);
        if (ov && ov.price > 0) currentPrice = ov.price;
      } catch {}
      // Birdeye failed/rate-limited - try DexScreener before falling back to entry price
      if (!currentPrice) {
        try {
          const axios = require("axios");
          const dr = await axios.get("https://api.dexscreener.com/latest/dex/tokens/" + pos.token_ca, { timeout: 4000 });
          const pair = dr.data?.pairs?.[0];
          if (pair?.priceUsd) currentPrice = parseFloat(pair.priceUsd);
        } catch {}
      }
      if (!currentPrice) currentPrice = pos.buy_price || simulatePriceMovement(pos.token_ca);
    } else {
      currentPrice = simulatePriceMovement(pos.token_ca);
    }
    const pnlPct       = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
    const currentValue = pos.sol_invested * (1 + pnlPct / 100);
    totalInvested += pos.sol_invested;
    totalCurrent  += currentValue;
    const pnlSol   = currentValue - pos.sol_invested;
    const icon     = pnlPct >= 0 ? "🟢" : "🔴";
    const name     = (pos.token_name || pos.token_ca.slice(0, 8)).slice(0, 12);
    const srcTag   = getSourceLabel(pos);
    const isSel    = selPos && pos.position_id === selPos.position_id;
    const holdTime = formatHoldTime(pos.opened_at || pos.created_at || Date.now());

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

    // Count buys/sells + totals from trades
    let bCount = 0, bSol = 0, sCount = 0, sSol = 0;
    try {
      const bq = db.getDb().prepare("SELECT COUNT(*) c, COALESCE(SUM(sol_amount),0) s FROM trades WHERE user_id=? AND token_ca=? AND wallet_id=? AND action='buy' AND status='confirmed'").get(pos.user_id, pos.token_ca, pos.wallet_id);
      const sq = db.getDb().prepare("SELECT COUNT(*) c, COALESCE(SUM(sol_amount),0) s FROM trades WHERE user_id=? AND token_ca=? AND wallet_id=? AND action='sell' AND status='confirmed'").get(pos.user_id, pos.token_ca, pos.wallet_id);
      bCount = bq.c; bSol = bq.s; sCount = sq.c; sSol = sq.s;
    } catch {}
    // Prices
    const entryPrice = pos.buy_price || 0;
    const curPrice = entryPrice * (1 + pnlPct / 100);
    const fmtP = (v) => v < 0.0001 ? "$" + v.toFixed(8) : "$" + v.toFixed(6);
    // MCaps
    const eMc = pos.entry_mcap && pos.entry_mcap > 0 ? formatNum(pos.entry_mcap) : "—";
    const cMcVal = pos.entry_mcap > 0 ? pos.entry_mcap * (1 + pnlPct/100) : 0;
    const cMc = cMcVal > 0 ? formatNum(cMcVal) : "—";
    const usd = (sol) => "$" + (sol * (globalThis.__hawkxSolPx || 150)).toFixed(2);

    const mcE = eMc !== "—" ? ` · <b>MC</b> ${eMc}` : "";
    const mcN = cMc !== "—" ? ` · <b>MC</b> ${cMc}` : "";
    msg += `${isSel ? "▶ " : ""}${icon} <a href="https://dexscreener.com/solana/${pos.token_ca}"><b>${name}</b></a> ${srcTag}${autoTag}${autoIcons}\n`;
    msg += `📋 <code>${pos.token_ca}</code>\n`;
    msg += `📊 <b>Entry</b>${mcE} · <b>PR</b> ${fmtP(entryPrice)}\n`;
    msg += `💰 <b>Bought</b> ${bSol.toFixed(3)} SOL (${usd(bSol)}) · ${bCount} buys\n`;
    msg += `📈 <b>Now</b>${mcN} · <b>PR</b> ${fmtP(curPrice)}\n`;
    msg += `📤 <b>Sold</b> ${sSol.toFixed(3)} SOL (${usd(sSol)}) · ${sCount} sells\n`;
    msg += `💎 <b>Hold</b> ${(pos.token_amount||0).toLocaleString()} · <b>PnL</b> ${formatPnl(pnlPct)} ${formatSol(pnlSol)} SOL (${usd(pnlSol)})\n`;

    msg += `━━━━━━━━━━━━━━━━━━━\n`;
  }

  // Portfolio summary
  const totalPnl  = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested * 100) : 0;
  const totalSign = totalPnl >= 0 ? "+" : "";
  const totalPnlSol = totalCurrent - totalInvested;
  msg += `Total P&L: <b>${totalSign}${totalPnl.toFixed(2)}%</b> | ${totalSign}${totalPnlSol.toFixed(4)} SOL\n`;
  msg += `💼 ${activeWallet?.label || walletLabel}: <b>${walletBal.toFixed(4)} SOL</b>\n`;

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
    db.setSysConfig(`buy_ctx_${user.user_id}`, `positions_${filter}_${page}`);

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
  catch (e) {
    if (!String(e.description || e.message || "").includes("not modified")) {
      try { await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); } catch {}
    }
  }
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

  const REAL_PX = process.env.MOCK_TRADES === "false";
  // On mainnet use the live DexScreener USD price (matches stored buy_price which is USD); devnet uses mock
  const [_tokData, _solPx] = await Promise.all([
    getTokenInfo(pos.token_ca),
    REAL_PX ? getSolPriceUsd() : Promise.resolve(150),
  ]);
  const currentPrice = REAL_PX ? (_tokData.price || pos.buy_price) : simulatePriceMovement(pos.token_ca);
  const solPriceUsd  = _solPx;
  const pnlPct       = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
  const currentValue = pos.sol_invested * (1 + pnlPct / 100);
  const pnlSol       = currentValue - pos.sol_invested;
  const pnlUsd       = Math.abs(pnlSol * solPriceUsd);
  const icon         = pnlPct >= 0 ? "🟢" : "🔴";
  const sign         = pnlPct >= 0 ? "+" : "";
  const holdTime     = formatHoldTime(pos.opened_at || pos.created_at || Date.now());

  // Buy/sell counts + totals for this token
  let sbCount = 0, sbSol = 0, ssCount = 0, ssSol = 0;
  try {
    const bq = db.getDb().prepare("SELECT COUNT(*) c, COALESCE(SUM(sol_amount),0) s FROM trades WHERE user_id=? AND token_ca=? AND wallet_id=? AND action='buy' AND status='confirmed'").get(pos.user_id, pos.token_ca, pos.wallet_id);
    const sq = db.getDb().prepare("SELECT COUNT(*) c, COALESCE(SUM(sol_amount),0) s FROM trades WHERE user_id=? AND token_ca=? AND wallet_id=? AND action='sell' AND status='confirmed'").get(pos.user_id, pos.token_ca, pos.wallet_id);
    sbCount = bq.c; sbSol = bq.s; ssCount = sq.c; ssSol = sq.s;
  } catch {}
  const tokenData = _tokData;
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
    // age shown in main layout; scannerLine keeps safety only
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

  // ── Redesigned position card (Option 3: entry vs current + % change) ──
  const entryMcStr = (pos.entry_mcap && pos.entry_mcap > 0) ? formatNum(pos.entry_mcap) : "—";
  const entryPxStr = pos.buy_price > 0 ? formatPrice(pos.buy_price) : "—";
  const curMcStr   = tokenData.mcap ? formatNum(tokenData.mcap) : "—";
  const curPxStr   = tokenData.price ? formatPrice(tokenData.price) : formatPrice(currentPrice);
  const liqStr     = tokenData.liquidity ? formatNum(tokenData.liquidity) : "—";
  const ageStr2    = formatAge(tokenData.pairCreatedAt) || "—";
  // price change since entry
  const chgPct = pos.buy_price > 0 && tokenData.price ? ((tokenData.price - pos.buy_price) / pos.buy_price * 100) : pnlPct;
  const chgChip = `${chgPct >= 0 ? "🟢 +" : "🔴 "}${chgPct.toFixed(1)}%`;
  // holdings: token amount, current SOL value, USD value
  const holdUsd = (pos.token_amount || 0) * (tokenData.price || 0);
  const holdSol = solPriceUsd > 0 ? (holdUsd / solPriceUsd) : 0;
  const boughtUsd = sbSol * solPriceUsd;
  const soldUsd   = ssSol * solPriceUsd;
  const pnlUsdSigned = pnlSol * solPriceUsd;

  const msg =
    `${icon} <a href="${dexUrl}"><b>${tokenName}</b></a> — ${getSourceLabel(pos)}\n` +
    `📋 <code>${pos.token_ca}</code>\n\n` +
    `📥 <b>Ent:</b> MC ${entryMcStr} · 💰 ${entryPxStr}\n` +
    `📊 <b>Cur:</b> MC ${curMcStr} · 💰 ${curPxStr}\n` +
    `💧 Liq ${liqStr} · 🕐 Age ${ageStr2}\n\n` +
    `💰 <b>Bought:</b> ${sbSol.toFixed(3)} SOL (${boughtUsd.toFixed(2)}) · ${sbCount} times\n` +
    `📤 <b>Sold:</b> ${ssSol.toFixed(3)} SOL (${soldUsd.toFixed(2)}) · ${ssCount} times\n` +
    `💎 <b>Holding:</b> ${(pos.token_amount||0).toLocaleString(undefined,{maximumFractionDigits:4})} tokens · ${holdSol.toFixed(4)} SOL (≈ ${holdUsd.toFixed(2)})\n` +
    `📈 <b>P&L:</b> ${formatPnl(pnlPct)} (${pnlSol >= 0 ? "+" : ""}${pnlSol.toFixed(4)} SOL · ${pnlUsdSigned.toFixed(2)})\n` +
    `⏱ Held: <b>${holdTime}</b>\n` +
    (scannerLine ? `\n${scannerLine}` : "") +
    (autoSummary ? autoSummary : "") +
    (autoSellLine || "") +
    `\n👛 ${activeWallet?.label || "Wallet"}: <b>${walletBal.toFixed(4)} SOL</b>`;

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
  catch (e) {
    if (!String(e.description || e.message || "").includes("not modified")) {
      try { await ctx.reply(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }); } catch {}
    }
  }
}

module.exports = { getPortfolio, getTokenPosition, getSourceLabel, formatPnl, formatSol };
