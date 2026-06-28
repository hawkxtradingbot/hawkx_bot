const db = require("../../../database");
const { safeEdit } = require("./helpers.routes");
const { getPortfolio, getTokenPosition } = require("../portfolio");
const { mockBuy, mockSell, simulatePriceMovement } = require("../executor");
const { getTokenInfo, getTokenSafety, formatSafetyCard, formatAge, formatNum, formatPrice } = require("../tokenInfo");

async function handleTradingCallbacks(ctx, data, userId, user, bot, ks) {

    // ── PORTFOLIO ─────────────────────────────────────────────
    if (data === "pos_wallet_expand") {
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user, "all", 0, false, null, true);
    }
    if (data.startsWith("pos_setwallet_")) {
      const wId = parseInt(data.replace("pos_setwallet_", ""));
      db.getDb().prepare("UPDATE users SET active_wallet_id = ? WHERE user_id = ?").run(wId, userId);
      await ctx.answerCallbackQuery("✅ Wallet switched!");
      return getPortfolio(ctx, db.getUser(userId));
    }
    if (data === "menu_portfolio") {
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user, "all", 0, false, null);
    }
    if (data.startsWith("pos_filter_")) {
      const parts = data.split("_");
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user, parts[2], parseInt(parts[3]||"0"), false, parseInt(parts[4]||"0")||null);
    }
    if (data.startsWith("pos_expand_")) {
      const parts = data.split("_");
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user, parts[2], parseInt(parts[3]||"0"), true, null);
    }
    if (data.startsWith("pos_select_")) {
      const parts = data.split("_");
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user, parts[3]||"all", parseInt(parts[4]||"0"), false, parseInt(parts[2]));
    }
    if (data.startsWith("pos_token_")) {
      const posId = parseInt(data.replace("pos_token_", ""));
      await ctx.answerCallbackQuery();
      const pos = db.getPosition(posId, userId);
      if (!pos || pos.status !== "open") return getPortfolio(ctx, db.getUser(userId), "all", 0, false, null);
      return getTokenPosition(ctx, user, posId);
    }

    // ── TRADE ─────────────────────────────────────────────────
    if (data === "trade_positions") {
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user);
    }
    if (data === "trade_cancel") {
      await ctx.answerCallbackQuery("❌ Cancelled.");
      db.setSysConfig(`pending_ca_${userId}`, "");
      db.setSysConfig(`pending_${userId}`, "");
      try { await ctx.deleteMessage(); } catch {}
      return true;
    }
    if (data === "trade_refresh_ca") {
      await ctx.answerCallbackQuery("🔄 Refreshed!");
      const ca2 = db.getSysConfig(`pending_ca_${userId}`) || "";
      if (!ca2) return true;
      const { showTokenScanner } = require("./helpers.routes");
      await showTokenScanner(ctx, user, ca2, true);
      return true;
    }
    if (data === "trade_quickbuy") {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return true; }
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("▶▶ *Send Token CA*\n\nPaste the contract address:", { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "buy_paste_ca_first");
      return true;
    }
    if (data.startsWith("buy_ca_amt_")) {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return true; }
      const amt = parseFloat(data.replace("buy_ca_amt_", ""));
      const ca = db.getSysConfig(`pending_ca_${userId}`);
      if (!ca) { await ctx.answerCallbackQuery("❌ Please paste a token CA first."); return true; }
      await ctx.answerCallbackQuery();
      await mockBuy(ctx, user, ca, amt, "manual", "");
      return true;
    }
    // Pro safety override — buy a risky token after confirmation
    if (data.startsWith("buy_override_")) {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return true; }
      if ((user.mode || "beginner") !== "pro") { await ctx.answerCallbackQuery("❌ Override is Pro-only.", { show_alert: true }); return true; }
      const rest = data.replace("buy_override_", "");
      const lastUnderscore = rest.lastIndexOf("_");
      const ca = rest.slice(0, lastUnderscore);
      const amt = parseFloat(rest.slice(lastUnderscore + 1));
      if (!ca || !(amt > 0)) { await ctx.answerCallbackQuery("❌ Invalid override."); return true; }
      await ctx.answerCallbackQuery("⚠️ Overriding safety — buying anyway...");
      await mockBuy(ctx, user, ca, amt, "manual", "", { skipSafety: true });
      return true;
    }
    if (data === "buy_ca_custom") {
      const customAmt = parseFloat(db.getSysConfig(`custom_buy_amt_${userId}`) || "0");
      if (customAmt > 0) { await mockBuy(ctx, user, db.getSysConfig(`pending_ca_${userId}`) || "", customAmt, "manual", ""); return true; }
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("✏️ Enter custom SOL amount (e.g. 0.25):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "buy_ca_custom_amt");
      return true;
    }

    // ── SELL ─────────────────────────────────────────────────
    if (data.startsWith("sell_pct_")) {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return true; }
      const parts = data.split("_");
      await ctx.answerCallbackQuery();
      const position = db.getPosition(parseInt(parts[3]), userId);
      if (!position) { await ctx.reply("❌ Position not found."); return true; }
      await mockSell(ctx, user, position, parseInt(parts[2]));
      return true;
    }
    if (data.startsWith("sell_quick_")) {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return true; }
      const pct = parseInt(data.replace("sell_quick_", ""));
      const positions = db.getOpenPositions(userId);
      if (!positions.length) { await ctx.answerCallbackQuery("No open positions."); return true; }
      await ctx.answerCallbackQuery();
      await mockSell(ctx, user, positions[0], pct);
      return true;
    }
    if (data === "sell_initial" || data.startsWith("sell_initial_") || data.startsWith("sell_initial_pos_")) {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return true; }
      await ctx.answerCallbackQuery();
      const posId = data.startsWith("sell_initial_pos_") ? parseInt(data.replace("sell_initial_pos_", "")) : (data.includes("_") && data !== "sell_initial" ? parseInt(data.split("_")[2]) : null);
      const positions = posId ? [db.getPosition(posId, userId)] : db.getOpenPositions(userId);
      const pos = positions[0];
      if (!pos) { await ctx.reply("No open positions."); return true; }
      const currentPrice = simulatePriceMovement(pos.token_ca);
      const pnlPct = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price) * 100 : 0;
      const currentValue = pos.sol_invested * (1 + pnlPct / 100);
      const initialPct = currentValue > 0 ? Math.min(100, (pos.sol_invested / currentValue) * 100) : 100;
      await mockSell(ctx, user, pos, initialPct);
      return true;
    }
    if (data.startsWith("sell_limit_")) {
      const posId = data.replace("sell_limit_", "");
      db.setSysConfig(`pending_${userId}`, `set_limit_sell_${posId}`);
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("📌 *Set Limit Sell*\n\nEnter target price in SOL:", { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      return true;
    }

    return false;
}

module.exports = { handleTradingCallbacks };

// PnL card hide amounts toggle
async function handlePnlCardToggle(ctx, data, userId) {
  if (!data.startsWith("pnlcard_toggle_hide_")) return false;
  const targetUserId = data.replace("pnlcard_toggle_hide_", "");
  if (String(userId) !== String(targetUserId)) {
    await ctx.answerCallbackQuery("Not your card!");
    return true;
  }
  const current = db.getSysConfig(`pnlcard_hide_${userId}`) === "1";
  const newHide = !current;
  db.setSysConfig(`pnlcard_hide_${userId}`, newHide ? "1" : "0");
  await ctx.answerCallbackQuery(newHide ? "Amounts hidden!" : "Amounts shown!");

  // Regenerate card with new hide setting
  try {
    const lastCardData = db.getSysConfig(`last_card_data_${userId}`);
    if (lastCardData) {
      const opts = JSON.parse(lastCardData);
      opts.hideAmounts = newHide;
      opts.pnlSol = newHide ? (opts._pnlSol >= 0 ? 0.001 : -0.001) : opts._pnlSol;
      opts.pnlUsd = newHide ? 0 : opts._pnlUsd;
      opts.invested = newHide ? 0 : opts._invested;
      opts.returned = newHide ? 0 : opts._returned;
      opts.feeSaved = newHide ? 0 : opts._feeSaved;
      opts.dailyFeeSaved = newHide ? 0 : opts._dailyFeeSaved;
      opts.weeklyFeeSaved = newHide ? 0 : opts._weeklyFeeSaved;

      const { generateTradeCard } = require("../statsCard");
      const result = await generateTradeCard(opts);
      const { InputFile } = require("grammy");
      const pnlKb = { inline_keyboard: [[
        { text: newHide ? "Show Amounts" : "Hide Amounts", callback_data: `pnlcard_toggle_hide_${userId}` }
      ]]};

      if (result && result.type === "photo") {
        await ctx.replyWithPhoto(new InputFile(result.buffer, "pnl_card.png"), { reply_markup: pnlKb });
        // Delete old card
        try { await ctx.deleteMessage(); } catch {}
      }
    }
  } catch (e) {
    console.error('[PnlToggle] Error:', e.message);
  }
  return true;
}

module.exports = { handleTradingCallbacks, handlePnlCardToggle, handlePositionAutoSell };

// ── Position Auto Sell ────────────────────────────────────────
async function handlePositionAutoSell(ctx, data, userId, user) {
  // Show template list for position
  if (data.startsWith("pos_autosell_")) {
    const posId = parseInt(data.replace("pos_autosell_", ""));
    const pos = db.getPosition(posId, userId);
    if (!pos) { await ctx.answerCallbackQuery("Position not found!"); return true; }
    await ctx.answerCallbackQuery();
    const templates = db.getAutoSellTemplates(userId);
    const current = pos.auto_sell_template_id;
    const tokenName = pos.token_name || pos.token_ca.slice(0,8);
    const { InlineKeyboard } = require("grammy");
    const kb = new InlineKeyboard();
    if (!templates.length) {
      kb.text("⚙️ Manage Templates", "pset_autosell_screen").row();
    } else {
      templates.forEach(t => {
        const isSel = current === t.id;
        kb.text(isSel ? `✅ ${t.name}` : t.name, `pos_ast_use_${posId}_${t.id}`).row();
      });
      if (current) kb.text("❌ Remove Auto Sell", `pos_ast_remove_${posId}`).row();
      
    }
    kb.text("← Back", `pos_filter_all_0_${posId}`).row();
    const msg = `📌 *Auto Sell — ${tokenName}*\n\n` +
      `${current ? `✅ Active: *${templates.find(t=>t.id===current)?.name || "Template"}*` : "❌ No template attached"}\n\n` +
      `Select a template to attach:`;
    try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); }
    catch { await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb }); }
    return true;
  }

  // Attach template to position
  if (data.startsWith("pos_ast_use_")) {
    const parts = data.replace("pos_ast_use_", "").split("_");
    const posId = parseInt(parts[0]);
    const tplId = parseInt(parts[1]);
    db.getDb().prepare("UPDATE positions SET auto_sell_template_id = ? WHERE position_id = ? AND user_id = ?")
      .run(tplId, posId, userId);
    await ctx.answerCallbackQuery("✅ Auto Sell attached!");
    return getPortfolio(ctx, user, "all", 0, false, posId);
  }

  // Remove template from position
  if (data.startsWith("pos_ast_remove_")) {
    const posId = parseInt(data.replace("pos_ast_remove_", ""));
    db.getDb().prepare("UPDATE positions SET auto_sell_template_id = NULL WHERE position_id = ? AND user_id = ?")
      .run(posId, userId);
    await ctx.answerCallbackQuery("❌ Auto Sell removed!");
    return getPortfolio(ctx, user, "all", 0, false, posId);
  }

  return false;
}
