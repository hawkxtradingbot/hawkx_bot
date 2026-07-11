// DCA (Dollar-Cost Averaging) — buy a token in chunks over time
// Smart single-screen design with wallet selector + holdings + balance check
const db = require("../../../database");

const INTERVALS = [
  { label: "30m", sec: 1800 },
  { label: "1h",  sec: 3600 },
  { label: "6h",  sec: 21600 },
  { label: "1d",  sec: 86400 },
];

function fmtInterval(sec) {
  if (sec % 86400 === 0) return `${sec/86400}d`;
  if (sec % 3600 === 0) return `${sec/3600}h`;
  if (sec % 60 === 0) return `${sec/60}m`;
  return `${sec}s`;
}
function fmtNext(nextAt) {
  const diff = new Date(nextAt).getTime() - Date.now();
  if (diff <= 0) return "soon";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h/24)}d ${h % 24}h`;
}

// ── MAIN DCA SCREEN: wallet selector + holdings + orders ──
async function showDcaScreen(ctx, userId) {
  const user = db.getUser(userId);
  const wallets = db.getWallets(userId) || [];
  const selWalletId = parseInt(db.getSysConfig(`dca_sel_wallet_${userId}`) || user.active_wallet_id);
  const activeWallet = wallets.find(w => w.wallet_id === selWalletId) || wallets[0];
  const walletNum = wallets.indexOf(activeWallet) + 1;
  const balance = activeWallet ? parseFloat(db.getSysConfig(`mock_balance_${activeWallet.public_key}`) || "0") : 0;

  // Holdings in selected wallet
  const allPos = db.getAllOpenPositions().filter(p => p.user_id === userId && p.wallet_id === selWalletId);
  // DCA orders in selected wallet
  const orders = db.getDcaOrders(userId).filter(o => o.wallet_id === selWalletId || (!o.wallet_id && selWalletId === parseInt(user.active_wallet_id)));

  // Merge tokens: one entry per CA (from holdings OR orders)
  const tokenMap = {};
  allPos.forEach(p => { tokenMap[p.token_ca] = { ca: p.token_ca, name: p.token_name || p.token_ca.slice(0,8), held: true }; });
  orders.forEach(o => {
    if (!tokenMap[o.token_ca]) tokenMap[o.token_ca] = { ca: o.token_ca, name: o.token_name || o.token_ca.slice(0,8), held: false };
  });
  // Attach order status to each token
  const byToken = {};
  orders.forEach(o => { if (!byToken[o.token_ca]) byToken[o.token_ca] = []; byToken[o.token_ca].push(o); });
  const tokenList = Object.values(tokenMap);

  const deployedSol = orders.reduce((s,o)=> s + (o.total_spent||0), 0);
  const activeCount = orders.filter(o => !o.paused && o.buys_done < o.total_buys).length;

  let msg = `📉 *DCA Orders*\n\n━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💼 W${walletNum} — *${balance.toFixed(3)} SOL*\n`;
  msg += `📊 ${activeCount} active · ${deployedSol.toFixed(3)} SOL deployed · ${tokenList.length} tokens\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_DCA auto-buys a token in small chunks over time,\nso you average your entry instead of buying all at once._\n\n`;
  msg += `🟢 active · ⏸ paused · 💼 held in wallet\n`;
  msg += `👉 Tap a token to set up or manage its DCA.\n`;
  msg += `👉 Tap ➕ New DCA to add any token by CA.\n`;
  msg += `━━━━━━━━━━━━━━━━━━━`;

  const kb = { inline_keyboard: [] };

  // Wallet selector (expand/collapse)
  const expanded = db.getSysConfig(`dca_wallet_expanded_${userId}`) === "1";
  if (expanded) {
    for (let i = 0; i < wallets.length; i += 4) {
      kb.inline_keyboard.push(wallets.slice(i, i+4).map((w, idx) => {
        const num = i+idx+1;
        const isSel = w.wallet_id === selWalletId;
        const lbl = (w.label && !w.label.match(/^W\d+$/)) ? ` ${w.label}` : "";
        return { text: (isSel ? `W${num}${lbl} ✅` : `W${num}${lbl}`).slice(0,20), callback_data: `dca_switch_wallet_${w.wallet_id}` };
      }));
    }
    kb.inline_keyboard.push([{ text: "▲ Close", callback_data: "dca_wallet_collapse" }]);
  } else {
    kb.inline_keyboard.push([{ text: `💼 W${walletNum} ✅ — ${balance.toFixed(3)} SOL ▼`, callback_data: "dca_wallet_expand" }]);
  }

  // Token buttons — ONE per token, stacked icons, adaptive rows
  if (!tokenList.length) {
    msg += `\n\n_No tokens yet. Tap ➕ New DCA to paste a token CA._`;
  } else {
    const makeBtn = (t) => {
      const ords = byToken[t.ca] || [];
      const hasOrder = ords.length > 0;
      const allPaused = hasOrder && ords.every(o => o.paused);
      const orderIcon = !hasOrder ? "" : allPaused ? "⏸" : "🟢";
      const heldIcon = t.held ? "💼" : "";
      const icons = (heldIcon || orderIcon) ? ` ${heldIcon}${orderIcon}` : "";
      const caKey = t.ca.slice(0,12);
      db.setSysConfig(`dca_ca_map_${userId}_${caKey}`, t.ca);
      return { text: `📊 ${t.name}${icons}`, callback_data: `dca_token_${caKey}`, _len: t.name.length };
    };
    let i = 0;
    while (i < tokenList.length) {
      const first = makeBtn(tokenList[i]);
      const perRow = first._len > 5 ? 2 : 3;
      const row = tokenList.slice(i, i+perRow).map(makeBtn).map(b => { delete b._len; return b; });
      kb.inline_keyboard.push(row);
      i += perRow;
    }
  }

  kb.inline_keyboard.push([{ text: "➕ New DCA", callback_data: "dca_new" }]);
  kb.inline_keyboard.push([{ text: "← Back", callback_data: "menu_main" }, { text: "🔄 Refresh", callback_data: "dca_refresh" }]);

  const dcaMsgId = parseInt(db.getSysConfig(`dca_msg_${userId}`) || "0");
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
  try {
    if (dcaMsgId && chatId) await ctx.api.editMessageText(chatId, dcaMsgId, msg, { parse_mode: "Markdown", reply_markup: kb });
    else throw new Error("fresh");
  } catch (e) {
    if (e?.description?.includes("not modified")) return;
    const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
    db.setSysConfig(`dca_msg_${userId}`, String(s.message_id));
  }
}

// ── TOKEN SETUP / MANAGE SCREEN ──
// Preset options for tap-to-set
const AMT_PRESETS = [0.05, 0.1, 0.5];
const CNT_PRESETS = [5, 10, 20];

async function showTokenDca(ctx, userId, ca) {
  const user = db.getUser(userId);
  const wallets = db.getWallets(userId) || [];
  const selWalletId = parseInt(db.getSysConfig(`dca_sel_wallet_${userId}`) || user.active_wallet_id);
  const activeWallet = wallets.find(w => w.wallet_id === selWalletId) || wallets[0];
  const balance = activeWallet ? parseFloat(db.getSysConfig(`mock_balance_${activeWallet.public_key}`) || "0") : 0;

  const orders = db.getDcaOrders(userId, ca).filter(o => o.wallet_id === selWalletId || !o.wallet_id);
  let name = orders[0]?.token_name || ca.slice(0,8);

  // Holdings in this wallet
  const pos = db.getAllOpenPositions().find(p => p.user_id === userId && p.token_ca === ca && p.wallet_id === selWalletId);
  const isHeld = !!pos;

  // Fetch token info
  let price = 0, mcap = 0, liqVal = 0, ageStr = "", safetyStr = "";
  try {
    const { getTokenInfo, getTokenSafety, formatAge, formatNum, formatPrice } = require("../tokenInfo");
    const ti = await getTokenInfo(ca);
    if (ti?.symbol) name = ti.symbol; else if (ti?.name) name = ti.name;
    price = ti?.price || 0;
    mcap = ti?.mcap || 0;
    liqVal = ti?.liquidity ?? ti?.liq ?? 0;
    if (!isHeld) {
      ageStr = formatAge(ti?.pairCreatedAt ?? ti?.age) || "";
      const safety = await getTokenSafety(ca);
      const sb = [];
      if (safety?.mintRevoked === true) sb.push("✅ Mint"); else if (safety?.mintRevoked === false) sb.push("🔴 Mint");
      if (safety?.freezeRevoked === true) sb.push("✅ Freeze"); else if (safety?.freezeRevoked === false) sb.push("🔴 Freeze");
      safetyStr = sb.join(" ");
    }
    var _fmtNum = formatNum, _fmtPrice = formatPrice;
  } catch {}
  const fmtNum = (n) => { try { return require("../tokenInfo").formatNum(n); } catch { return "$"+n; } };
  const fmtPrice = (n) => { try { return require("../tokenInfo").formatPrice(n); } catch { return "$"+n; } };

  db.setSysConfig(`dca_setup_ca_${userId}`, ca);
  db.setSysConfig(`dca_setup_name_${userId}`, name);

  let msg = `📉 *DCA — ${name}*\n\n━━━━━━━━━━━━━━━━━━━\n`;

  if (isHeld) {
    // HELD: price + MC + holdings + PnL (top focus)
    const { simulatePriceMovement } = (() => { try { return require("../portfolio"); } catch { return {}; } })();
    let curPrice = price;
    try { if (simulatePriceMovement) curPrice = simulatePriceMovement(ca) || price; } catch {}
    const pnlPct = pos.buy_price > 0 ? ((curPrice - pos.buy_price) / pos.buy_price * 100) : 0;
    const pnlSol = (pos.sol_invested||0) * (pnlPct/100);
    const icon = pnlPct >= 0 ? "🟢" : "🔴";
    const sign = pnlPct >= 0 ? "+" : "";
    msg += `🎯 PnL: *${sign}${pnlPct.toFixed(1)}%* (${sign}${pnlSol.toFixed(3)} SOL) ${icon}\n`;
    msg += `💼 You hold: ${(pos.token_amount||0).toLocaleString()} (~${(pos.sol_invested||0).toFixed(2)} SOL)\n`;
    const dParts = [];
    if (mcap) dParts.push(`📊 MC ${fmtNum(mcap)}`);
    if (price) dParts.push(`💲 PR ${fmtPrice(price)}`);
    if (dParts.length) msg += dParts.join("  ") + "\n";
  } else {
    // NEW: price + MC + Liq + age + safety
    const dParts = [];
    if (price) dParts.push(`💰 ${fmtPrice(price)}`);
    if (mcap) dParts.push(`MC ${fmtNum(mcap)}`);
    if (liqVal) dParts.push(`Liq ${fmtNum(liqVal)}`);
    if (dParts.length) msg += dParts.join(" · ") + "\n";
    if (ageStr || safetyStr) msg += `${ageStr ? "🕐 Age "+ageStr : ""}${ageStr && safetyStr ? " · " : ""}${safetyStr ? "🛡 "+safetyStr : ""}\n`;
  }
  msg += `💵 Wallet: *${balance.toFixed(3)} SOL*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n`;

  const kb = { inline_keyboard: [] };

  // Existing DCA orders — collapsed by default, tap to expand
  const expandedOrderId = parseInt(db.getSysConfig(`dca_order_expand_${userId}`) || "0");
  if (orders.length) {
    msg += `\n*Your DCA orders:*\n`;
    orders.forEach(o => {
      const status = o.paused ? "⏸" : "🟢";
      if (o.id === expandedOrderId) {
        // Expanded: full details in message + action buttons
        msg += `\n${status} ${o.sol_per_buy} SOL × ${o.total_buys} · ${o.buys_done}/${o.total_buys} done\n`;
        msg += `⏱ Every ${fmtInterval(o.interval_sec)}`;
        if (o.buys_done < o.total_buys && !o.paused) msg += ` · next ${fmtNext(o.next_buy_at)}`;
        msg += `\n💰 Spent ${(o.total_spent||0).toFixed(3)} SOL`;
        if (o.avg_price > 0) msg += ` · avg ${o.avg_price.toFixed(8)}`;
        msg += `\n`;
        kb.inline_keyboard.push([{ text: `${status} ${o.sol_per_buy}×${o.total_buys} ▲`, callback_data: `dca_order_collapse_${o.id}` }]);
        kb.inline_keyboard.push([
          { text: "✏️ Edit", callback_data: `dca_edit_${o.id}` },
          { text: o.paused ? "▶️ Resume" : "⏸ Pause", callback_data: `dca_pause_${o.id}` },
          { text: "🛑 Delete", callback_data: `dca_del_${o.id}` },
        ]);
      } else {
        // Collapsed: one tappable line
        kb.inline_keyboard.push([{ text: `${status} ${o.sol_per_buy} SOL × ${o.total_buys} · ${o.buys_done}/${o.total_buys} ▼`, callback_data: `dca_order_expand_${o.id}` }]);
      }
    });
  }

  // Is the setup panel expanded?
  const expanded = db.getSysConfig(`dca_setup_open_${userId}`) === ca;
  if (!expanded) {
    if (orders.length) msg += `\n👉 Tap an order above to edit, pause, or delete it.\n`;
    msg += `\n👉 Tap *➕ Add DCA Buy* to start a new DCA for this token.`;
    kb.inline_keyboard.push([{ text: "➕ Add DCA Buy", callback_data: `dca_open_setup` }]);
  } else {
    // Tap-to-set panel
    const amt = parseFloat(db.getSysConfig(`dca_draft_amt_${userId}`) || "0");
    const cnt = parseInt(db.getSysConfig(`dca_draft_cnt_${userId}`) || "0");
    const intv = parseInt(db.getSysConfig(`dca_draft_int_${userId}`) || "0");
    msg += `\n*Set up your DCA:*\n`;
    msg += `_Tap a value in each row to set it. Use ✏️ to type a custom number._\n\n`;
    msg += `💵 Amount/buy: ${amt ? "*"+amt+" SOL*" : "_tap below_"}\n`;
    msg += `🔁 Buys: ${cnt ? "*"+cnt+"*" : "_tap below_"}\n`;
    msg += `⏱ Interval: ${intv ? "*"+fmtInterval(intv)+"*" : "_tap below_"}\n`;
    if (amt && cnt) {
      const total = amt * cnt;
      msg += `\n📊 Total: *${total.toFixed(2)} SOL*`;
      if (total > balance) msg += ` · ⚠️ need ${(total-balance).toFixed(3)} more`;
      else msg += ` · enough ✅`;
      msg += `\n`;
    }
    // Amount row
    const amtCustom = amt && !AMT_PRESETS.includes(amt);
    kb.inline_keyboard.push(AMT_PRESETS.map(a => ({ text: `${amt===a?"✅ ":""}${a}`, callback_data: `dca_set_amt_${a}` })).concat([{ text: amtCustom ? `✅ ✏️ ${amt}` : "✏️", callback_data: "dca_set_amt_custom" }]));
    // Count row
    const cntCustom = cnt && !CNT_PRESETS.includes(cnt);
    kb.inline_keyboard.push(CNT_PRESETS.map(n => ({ text: `${cnt===n?"✅ ":""}${n}×`, callback_data: `dca_set_cnt_${n}` })).concat([{ text: cntCustom ? `✅ ✏️ ${cnt}×` : "✏️", callback_data: "dca_set_cnt_custom" }]));
    // Interval row
    const intvCustom = intv && !INTERVALS.find(iv => iv.sec === intv);
    kb.inline_keyboard.push(INTERVALS.map(iv => ({ text: `${intv===iv.sec?"✅ ":""}${iv.label}`, callback_data: `dca_set_int_${iv.sec}` })).concat([{ text: intvCustom ? `✅ ✏️ ${fmtInterval(intv)}` : "✏️", callback_data: "dca_set_int_custom" }]));
    // Start / Cancel
    if (amt && cnt && intv) msg += `\n👉 Tap *Start DCA* to begin, or *Cancel* to discard.\n`;
    else msg += `\n_Set all three (amount, buys, interval) to start._\n`;
    const ready = amt && cnt && intv;
    const isEditing = (db.getSysConfig(`dca_editing_id_${userId}`) || "") !== "";
    const startLabel = isEditing ? (ready ? "💾 Save Changes" : "💾 Save (set all)") : (ready ? "▶️ Start DCA" : "▶️ Start (set all)");
    kb.inline_keyboard.push([
      { text: startLabel, callback_data: ready ? "dca_start" : "noop" },
      { text: "✖ Cancel", callback_data: "dca_cancel_setup" },
    ]);
  }
  kb.inline_keyboard.push([{ text: "← Back", callback_data: "dca_refresh" }, { text: "📂 Portfolio", callback_data: "menu_portfolio" }]);

  const dcaMsgId = parseInt(db.getSysConfig(`dca_msg_${userId}`) || "0");
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
  try {
    if (dcaMsgId && chatId) await ctx.api.editMessageText(chatId, dcaMsgId, msg, { parse_mode: "Markdown", reply_markup: kb });
    else throw new Error("fresh");
  } catch (e) {
    if (e?.description?.includes("not modified")) return;
    const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
    db.setSysConfig(`dca_msg_${userId}`, String(s.message_id));
  }
}

// Finalize: create DCA + balance check
async function finalizeDca(ctx, userId, intervalSec) {
  const ca = db.getSysConfig(`dca_setup_ca_${userId}`) || "";
  const name = db.getSysConfig(`dca_setup_name_${userId}`) || ca.slice(0,8);
  const amt = parseFloat(db.getSysConfig(`dca_setup_amount_${userId}`) || "0.1");
  const cnt = parseInt(db.getSysConfig(`dca_setup_count_${userId}`) || "5");
  if (!ca) { await ctx.reply("❌ Setup expired. Start again."); return; }

  const user = db.getUser(userId);
  const wallets = db.getWallets(userId) || [];
  const selWalletId = parseInt(db.getSysConfig(`dca_sel_wallet_${userId}`) || user.active_wallet_id);
  const activeWallet = wallets.find(w => w.wallet_id === selWalletId) || wallets[0];
  const balance = activeWallet ? parseFloat(db.getSysConfig(`mock_balance_${activeWallet.public_key}`) || "0") : 0;
  const totalCost = amt * cnt;

  db.addDcaOrder(userId, {
    tokenCa: ca, tokenName: name, solPerBuy: amt, totalBuys: cnt,
    intervalSec, walletId: selWalletId,
  });
  ["amount","count"].forEach(k => db.setSysConfig(`dca_setup_${k}_${userId}`, ""));
  // keep dca_msg_ so the screen edits in place (no new page)
  // keep dca_setup_ca_ so the token screen can re-render

  // Build first-buy time string
  const firstBuyMs = Date.now() + intervalSec * 1000;
  const firstBuyDate = new Date(firstBuyMs);
  const fmtTime = (d) => {
    const diff = d.getTime() - Date.now();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `in ${days}d ${hrs % 24}h`;
    if (hrs > 0) return `in ${hrs}h ${mins % 60}m`;
    return `in ${mins}m`;
  };

  // Full confirmation message (stays visible, not just a toast)
  let confirmMsg = `✅ *DCA Order Confirmed!*\n\n`;
  confirmMsg += `🪙 Token: *${name}*\n`;
  confirmMsg += `💵 Amount: *${amt} SOL* per buy\n`;
  confirmMsg += `🔁 Buys: *${cnt}* total\n`;
  confirmMsg += `⏱ Every: *${fmtInterval(intervalSec)}*\n`;
  confirmMsg += `📊 Total cost: *${totalCost.toFixed(2)} SOL*\n`;
  confirmMsg += `⏰ First buy: *${fmtTime(firstBuyDate)}*\n\n`;

  if (totalCost > balance) {
    const need = (totalCost - balance).toFixed(3);
    confirmMsg += `⚠️ *Low balance:* wallet has ${balance.toFixed(3)} SOL, needs ${totalCost.toFixed(2)} SOL.\nDeposit *${need} SOL* more or some buys may fail.\n`;
  } else {
    confirmMsg += `💼 Wallet: ${balance.toFixed(3)} SOL — enough ✅\n`;
  }

  try { await ctx.answerCallbackQuery({ text: "✅ DCA started!" }); } catch {}
  const confirmSent = await ctx.reply(confirmMsg, { parse_mode: "Markdown" });
  // Auto-delete confirmation after 30s
  setTimeout(async () => { try { await ctx.api.deleteMessage(ctx.chat.id, confirmSent.message_id); } catch {} }, 30000);
  db.setSysConfig(`dca_last_note_${userId}`, confirmMsg);
  return showTokenDca(ctx, userId, ca);
}

async function handleDcaCallbacks(ctx, data, userId, user) {
  if (data === "menu_dca" || data === "dca_refresh") {
    try { await ctx.answerCallbackQuery(); } catch {}
    const mid = ctx.callbackQuery?.message?.message_id;
    if (mid) db.setSysConfig(`dca_msg_${userId}`, String(mid));
    return showDcaScreen(ctx, userId);
  }
  if (data.startsWith("dca_switch_wallet_")) {
    const wId = parseInt(data.replace("dca_switch_wallet_", ""));
    db.setSysConfig(`dca_sel_wallet_${userId}`, String(wId));
    db.setSysConfig(`dca_wallet_expanded_${userId}`, "0");
    await ctx.answerCallbackQuery("✅ Wallet switched!");
    return showDcaScreen(ctx, userId);
  }
  if (data === "dca_wallet_expand") {
    db.setSysConfig(`dca_wallet_expanded_${userId}`, "1");
    await ctx.answerCallbackQuery();
    return showDcaScreen(ctx, userId);
  }
  if (data === "dca_wallet_collapse") {
    db.setSysConfig(`dca_wallet_expanded_${userId}`, "0");
    await ctx.answerCallbackQuery();
    return showDcaScreen(ctx, userId);
  }
  if (data.startsWith("dca_token_")) {
    await ctx.answerCallbackQuery();
    const caKey = data.replace("dca_token_", "");
    const ca = db.getSysConfig(`dca_ca_map_${userId}_${caKey}`) || caKey;
    const mid = ctx.callbackQuery?.message?.message_id;
    if (mid) db.setSysConfig(`dca_msg_${userId}`, String(mid));
    return showTokenDca(ctx, userId, ca);
  }
  if (data.startsWith("dca_pause_")) {
    const id = parseInt(data.replace("dca_pause_", ""));
    db.pauseDcaOrder(userId, id);
    await ctx.answerCallbackQuery("✅ Updated!");
    const ca = db.getSysConfig(`dca_setup_ca_${userId}`);
    if (ca) return showTokenDca(ctx, userId, ca);
    return showDcaScreen(ctx, userId);
  }
  if (data.startsWith("dca_del_")) {
    const id = parseInt(data.replace("dca_del_", ""));
    db.cancelDcaOrder(userId, id);
    await ctx.answerCallbackQuery("🗑 Deleted!");
    db.setSysConfig(`dca_order_expand_${userId}`, "");
    const ca = db.getSysConfig(`dca_setup_ca_${userId}`);
    if (ca) return showTokenDca(ctx, userId, ca);
    return showDcaScreen(ctx, userId);
  }
  // New DCA from main screen — ask to paste CA
  if (data === "dca_new") {
    await ctx.answerCallbackQuery();
    const m = await ctx.reply("📉 *New DCA*\n\nPaste the token CA you want to DCA into:", { parse_mode: "Markdown" });
    db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
    db.setSysConfig(`pending_${userId}`, "dca_paste_ca");
    return true;
  }
  // Begin setup (from token screen) — ask amount
  // From scanner
  if (data === "scanner_dca") {
    await ctx.answerCallbackQuery();
    const ca = db.getSysConfig(`pending_ca_${userId}`) || "";
    if (!ca) { try { await ctx.answerCallbackQuery({ text: "Paste a token first", show_alert: true }); } catch {} return true; }
    // Open the token DCA screen (held/new layout + Add DCA Buy panel)
    db.setSysConfig(`dca_msg_${userId}`, ""); // fresh screen
    db.setSysConfig(`dca_order_expand_${userId}`, "");
    db.setSysConfig(`dca_setup_open_${userId}`, "");
    return showTokenDca(ctx, userId, ca);
  }
  if (data.startsWith("dca_int_") && data !== "dca_int_custom") {
    await ctx.answerCallbackQuery();
    const sec = parseInt(data.replace("dca_int_", ""));
    return finalizeDca(ctx, userId, sec);
  }
  if (data === "dca_int_custom") {
    await ctx.answerCallbackQuery();
    const m = await ctx.reply("⏱ Enter interval in *hours* (e.g. 2 or 0.5):", { parse_mode: "Markdown" });
    db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
    db.setSysConfig(`pending_${userId}`, "dca_set_interval_custom");
    return true;
  }
  // ── ORDER EXPAND / COLLAPSE / EDIT ──
  if (data.startsWith("dca_order_expand_")) {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`dca_order_expand_${userId}`, data.replace("dca_order_expand_", ""));
    return showTokenDca(ctx, userId, db.getSysConfig(`dca_setup_ca_${userId}`));
  }
  if (data.startsWith("dca_order_collapse_")) {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`dca_order_expand_${userId}`, "");
    return showTokenDca(ctx, userId, db.getSysConfig(`dca_setup_ca_${userId}`));
  }
  if (data.startsWith("dca_edit_")) {
    await ctx.answerCallbackQuery();
    const id = parseInt(data.replace("dca_edit_", ""));
    const ord = db.getDcaOrders(userId).find(o => o.id === id);
    if (!ord) { try { await ctx.answerCallbackQuery({ text: "Order not found", show_alert: true }); } catch {} return true; }
    // Pre-fill draft with this order's values + mark as editing
    db.setSysConfig(`dca_draft_amt_${userId}`, String(ord.sol_per_buy));
    db.setSysConfig(`dca_draft_cnt_${userId}`, String(ord.total_buys));
    db.setSysConfig(`dca_draft_int_${userId}`, String(ord.interval_sec));
    db.setSysConfig(`dca_editing_id_${userId}`, String(id));
    db.setSysConfig(`dca_setup_open_${userId}`, ord.token_ca);
    db.setSysConfig(`dca_order_expand_${userId}`, "");
    return showTokenDca(ctx, userId, ord.token_ca);
  }

  // ── TAP-TO-SET PANEL ──
  if (data === "dca_open_setup") {
    await ctx.answerCallbackQuery();
    const ca = db.getSysConfig(`dca_setup_ca_${userId}`) || "";
    db.setSysConfig(`dca_draft_amt_${userId}`, "");
    db.setSysConfig(`dca_draft_cnt_${userId}`, "");
    db.setSysConfig(`dca_draft_int_${userId}`, "");
    db.setSysConfig(`dca_setup_open_${userId}`, ca);
    return showTokenDca(ctx, userId, ca);
  }
  if (data === "dca_cancel_setup") {
    await ctx.answerCallbackQuery();
    const ca = db.getSysConfig(`dca_setup_ca_${userId}`) || "";
    db.setSysConfig(`dca_setup_open_${userId}`, "");
    db.setSysConfig(`dca_editing_id_${userId}`, "");
    return showTokenDca(ctx, userId, ca);
  }
  if (data.startsWith("dca_set_amt_") && data !== "dca_set_amt_custom") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`dca_draft_amt_${userId}`, data.replace("dca_set_amt_", ""));
    return showTokenDca(ctx, userId, db.getSysConfig(`dca_setup_ca_${userId}`));
  }
  if (data.startsWith("dca_set_cnt_") && data !== "dca_set_cnt_custom") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`dca_draft_cnt_${userId}`, data.replace("dca_set_cnt_", ""));
    return showTokenDca(ctx, userId, db.getSysConfig(`dca_setup_ca_${userId}`));
  }
  if (data.startsWith("dca_set_int_") && data !== "dca_set_int_custom") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`dca_draft_int_${userId}`, data.replace("dca_set_int_", ""));
    return showTokenDca(ctx, userId, db.getSysConfig(`dca_setup_ca_${userId}`));
  }
  if (data === "dca_set_amt_custom") {
    await ctx.answerCallbackQuery();
    const m = await ctx.reply("💵 Enter SOL amount per buy (e.g. 0.25):");
    db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
    db.setSysConfig(`pending_${userId}`, "dca_custom_amt");
    return true;
  }
  if (data === "dca_set_cnt_custom") {
    await ctx.answerCallbackQuery();
    const m = await ctx.reply("🔁 Enter number of buys (e.g. 15):");
    db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
    db.setSysConfig(`pending_${userId}`, "dca_custom_cnt");
    return true;
  }
  if (data === "dca_set_int_custom") {
    await ctx.answerCallbackQuery();
    const m = await ctx.reply("⏱ *Custom Interval*\n\nExamples:\n• 30m (30 minutes)\n• 2h (2 hours)\n• 1d (1 day)\n• 90m (90 minutes)", { parse_mode: "Markdown" });
    db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
    db.setSysConfig(`pending_${userId}`, "dca_custom_int");
    return true;
  }
  if (data === "dca_start") {
    await ctx.answerCallbackQuery();
    const amt = parseFloat(db.getSysConfig(`dca_draft_amt_${userId}`) || "0");
    const cnt = parseInt(db.getSysConfig(`dca_draft_cnt_${userId}`) || "0");
    const intv = parseInt(db.getSysConfig(`dca_draft_int_${userId}`) || "0");
    if (!amt || !cnt || !intv) { try { await ctx.answerCallbackQuery({ text: "Set amount, buys & interval first", show_alert: true }); } catch {} return true; }
    const editId = parseInt(db.getSysConfig(`dca_editing_id_${userId}`) || "0");
    const ca = db.getSysConfig(`dca_setup_ca_${userId}`);
    if (editId) {
      // UPDATE existing order
      db.getDb().prepare("UPDATE dca_orders SET sol_per_buy = ?, total_buys = ?, interval_sec = ? WHERE id = ? AND user_id = ?")
        .run(amt, cnt, intv, editId, userId);
      db.setSysConfig(`dca_editing_id_${userId}`, "");
      db.setSysConfig(`dca_setup_open_${userId}`, "");
      try { await ctx.answerCallbackQuery({ text: `✅ Updated — ${cnt}×${amt} SOL every ${fmtInterval(intv)}` }); } catch {}
      return showTokenDca(ctx, userId, ca);
    }
    db.setSysConfig(`dca_setup_amount_${userId}`, String(amt));
    db.setSysConfig(`dca_setup_count_${userId}`, String(cnt));
    db.setSysConfig(`dca_setup_open_${userId}`, "");
    return finalizeDca(ctx, userId, intv);
  }
  if (data === "noop") { try { await ctx.answerCallbackQuery({ text: "Set amount, buys & interval", show_alert: true }); } catch {} return true; }

  return false;
}

module.exports = { handleDcaCallbacks, showDcaScreen, showTokenDca, finalizeDca, INTERVALS };
