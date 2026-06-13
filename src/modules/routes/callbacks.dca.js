// DCA (Dollar-Cost Averaging) — buy a token in chunks over time
// Styled to match Limit Orders (active 🟢 / paused ⏸ / 💼 held)
const db = require("../../../database");

const INTERVALS = [
  { label: "1h", sec: 3600 },
  { label: "6h", sec: 21600 },
  { label: "1d", sec: 86400 },
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

// ── Main DCA screen (token list) ──
async function showDcaScreen(ctx, userId) {
  const orders = db.getDcaOrders(userId);
  const user = db.getUser(userId);
  const wallets = db.getWallets(userId) || [];
  const allPos = db.getAllOpenPositions ? db.getAllOpenPositions().filter(p => p.user_id === userId) : [];
  const heldCas = new Set(allPos.map(p => p.token_ca));

  let msg = `📉 *DCA Orders*\n\n━━━━━━━━━━━━━━━━━━━\nAuto-buy a token in chunks over time —\nsmooths your entry, less timing risk.\n\n🟢 = active   ⏸ = paused   💼 = held\n━━━━━━━━━━━━━━━━━━━\n`;
  const kb = { inline_keyboard: [] };

  // Group by token
  const byToken = {};
  orders.forEach(o => { if (!byToken[o.token_ca]) byToken[o.token_ca] = []; byToken[o.token_ca].push(o); });
  const tokenCas = Object.keys(byToken);

  if (!tokenCas.length) {
    msg += `\n_No DCA orders yet. Paste a token and tap 📉 DCA, or add one below._`;
  } else {
    const makeBtn = (ca) => {
      const ords = byToken[ca];
      const name = ords[0].token_name || ca.slice(0,8);
      const allPaused = ords.every(o => o.paused);
      const icon = allPaused ? "⏸" : "🟢";
      const held = heldCas.has(ca) ? "💼" : "";
      const caKey = ca.slice(0,12);
      db.setSysConfig(`dca_ca_map_${userId}_${caKey}`, ca);
      return { text: `📊 ${name} ${held}${icon}`, callback_data: `dca_token_${caKey}`, _len: name.length };
    };
    let i = 0;
    while (i < tokenCas.length) {
      const first = makeBtn(tokenCas[i]);
      const perRow = first._len > 5 ? 2 : 3;
      const row = tokenCas.slice(i, i + perRow).map(makeBtn).map(b => { delete b._len; return b; });
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

// ── Per-token DCA screen ──
async function showTokenDca(ctx, userId, ca) {
  const orders = db.getDcaOrders(userId, ca);
  const name = orders[0]?.token_name || ca.slice(0,8);
  let msg = `📉 *DCA — ${name}*\n\n━━━━━━━━━━━━━━━━━━━\n`;
  const kb = { inline_keyboard: [] };
  if (!orders.length) {
    msg += `_No active DCA for this token._`;
  } else {
    orders.forEach(o => {
      const status = o.paused ? "⏸ Paused" : "🟢 Active";
      msg += `${status}\n🟢 Buy ${o.sol_per_buy} SOL × ${o.total_buys}  ·  ${o.buys_done}/${o.total_buys} done\n⏱ Every ${fmtInterval(o.interval_sec)}`;
      if (o.buys_done < o.total_buys && !o.paused) msg += `  ·  next ${fmtNext(o.next_buy_at)}`;
      msg += `\n💰 Spent: ${(o.total_spent||0).toFixed(3)} SOL`;
      if (o.avg_price > 0) msg += `  ·  avg ${o.avg_price.toFixed(8)}`;
      msg += `\n━━━━━━━━━━━━━━━━━━━\n`;
      kb.inline_keyboard.push([
        { text: o.paused ? "▶️ Resume" : "⏸ Pause", callback_data: `dca_pause_${o.id}` },
        { text: "🛑 Delete", callback_data: `dca_del_${o.id}` },
      ]);
    });
  }
  kb.inline_keyboard.push([{ text: "← Back", callback_data: "dca_refresh" }]);
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

async function handleDcaCallbacks(ctx, data, userId, user) {
  if (data === "menu_dca" || data === "dca_refresh") {
    try { await ctx.answerCallbackQuery(); } catch {}
    const mid = ctx.callbackQuery?.message?.message_id;
    if (mid) db.setSysConfig(`dca_msg_${userId}`, String(mid));
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
    return showDcaScreen(ctx, userId);
  }
  if (data.startsWith("dca_del_")) {
    const id = parseInt(data.replace("dca_del_", ""));
    db.cancelDcaOrder(userId, id);
    await ctx.answerCallbackQuery("🗑 Deleted!");
    return showDcaScreen(ctx, userId);
  }
  // New DCA (from menu) — ask to paste CA
  if (data === "dca_new") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`dca_setup_ca_${userId}`, "");
    const m = await ctx.reply("📉 *New DCA*\n\n━━━━━━━━━━━━━━━━━━━\nAuto-buy a token in chunks over time.\n━━━━━━━━━━━━━━━━━━━\n\nPaste the token CA to begin:", { parse_mode: "Markdown" });
    db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
    db.setSysConfig(`pending_${userId}`, "dca_paste_ca");
    return true;
  }
  // From scanner — CA already known
  if (data === "scanner_dca") {
    await ctx.answerCallbackQuery();
    const ca = db.getSysConfig(`pending_ca_${userId}`) || "";
    if (!ca) { await ctx.answerCallbackQuery({ text: "Paste a token first", show_alert: true }); return true; }
    db.setSysConfig(`dca_setup_ca_${userId}`, ca);
    let tName = ca.slice(0,8);
    try { const { getTokenInfo } = require("../../tokenInfo"); const ti = await getTokenInfo(ca); if (ti?.name) tName = ti.name; } catch {}
    db.setSysConfig(`dca_setup_name_${userId}`, tName);
    const m = await ctx.reply(`📉 *DCA Setup — ${tName}*\n\n━━━━━━━━━━━━━━━━━━━\nBuy in chunks over time.\n━━━━━━━━━━━━━━━━━━━\n\n💰 Enter SOL amount *per buy* (e.g. 0.1):`, { parse_mode: "Markdown" });
    db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
    db.setSysConfig(`pending_${userId}`, "dca_set_amount");
    return true;
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
  return false;
}

// Create the DCA order + open the DCA screen
async function finalizeDca(ctx, userId, intervalSec) {
  const ca = db.getSysConfig(`dca_setup_ca_${userId}`) || "";
  const name = db.getSysConfig(`dca_setup_name_${userId}`) || ca.slice(0,8);
  const amt = parseFloat(db.getSysConfig(`dca_setup_amount_${userId}`) || "0.1");
  const cnt = parseInt(db.getSysConfig(`dca_setup_count_${userId}`) || "5");
  if (!ca) { await ctx.reply("❌ Setup expired. Start again."); return; }
  db.addDcaOrder(userId, {
    tokenCa: ca, tokenName: name, solPerBuy: amt, totalBuys: cnt,
    intervalSec, walletId: db.getUser(userId).active_wallet_id,
  });
  // clear setup
  ["ca","name","amount","count"].forEach(k => db.setSysConfig(`dca_setup_${k}_${userId}`, ""));
  db.setSysConfig(`dca_msg_${userId}`, "");
  await ctx.reply(`✅ DCA started — ${cnt} buys × ${amt} SOL, every ${fmtInterval(intervalSec)}.`);
  return showDcaScreen(ctx, userId);
}

module.exports = { handleDcaCallbacks, showDcaScreen, showTokenDca, finalizeDca, INTERVALS };
