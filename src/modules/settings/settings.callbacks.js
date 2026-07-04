const db = require("../../../database");
const bcrypt = require("bcryptjs");
const { buildProSettingsMenu, buildBeginnerSettingsMenu, buildAutoSellTemplateScreen, buildSniperConfigMenu, buildMigrationSniperMenu, buildRealtimeSnipeMenu, buildChannelAutoSellScreen, buildWalletAutoSellScreen, buildExecutionSettingsMenu, buildMevSettingsMenu, buildAlertsSettingsMenu } = require("../keyboards");
const { sendPrompt, deleteMsg, refreshSettings, showSettings } = require("./settings.helpers");

    // ── Main callback handler ─────────────────────────────────────
      async function handleSettingCallback(ctx, user, action, bot, onSourceBack) {
    console.log("[SETTINGS CB]:", action?.slice(0,25));
    // Handle select FIRST
    if (action && action.indexOf("ast_select_") === 0) {
      const id = parseInt(action.replace("ast_select_", ""));
      const s = db.getSettings(user.user_id);
      const newId = s?.auto_sell_template_id === id ? null : id;
      db.updateSettings(user.user_id, { auto_sell_template_id: newId });
      await ctx.answerCallbackQuery(newId ? "✅ Selected!" : "◻️ Deselected!");
      const { buildAutoSellListScreen } = require("../keyboards");
      const templates = db.getAutoSellTemplates(user.user_id);
      const fresh = db.getSettings(user.user_id);
      const selMsg = `🤖 *Auto Sell Templates*\n\n━━━━━━━━━━━━━━━━━━━\n📚 *HOW IT WORKS:*\n🛑 SL = auto sell if price drops\n🎯 TP = auto sell if price rises\n\n📌 Selected template here applies to:\n   Manual buys & Auto Buy only\n\n💡 Each Copy Wallet, Copy Channel\n   and Sniper can have its OWN\n   template assigned separately\n━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(selMsg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, fresh?.auto_sell_template_id, fresh?.auto_sell_enabled) }); }
      catch { try { await ctx.editMessageReplyMarkup({ reply_markup: buildAutoSellListScreen(templates, fresh?.auto_sell_template_id, fresh?.auto_sell_enabled) }); } catch {} }
      return;
    }

    // Handle ALL ast_template actions FIRST
    if (action.startsWith("ast_sl_") || action.startsWith("ast_tp_") || 
        action.startsWith("ast_toggle_") || action.startsWith("ast_rename_") ||
        action.startsWith("ast_view_") || action.startsWith("ast_save_")) {
      // These are handled below - just fall through
    } else if (action.startsWith("ast_back_")) {
      const id = parseInt(action.replace("ast_back_", ""));
      await ctx.answerCallbackQuery();
      const unsavedId = parseInt(db.getSysConfig(`ast_unsaved_${user.user_id}`) || "0");
      if (unsavedId && unsavedId === id) {
        db.deleteAutoSellTemplate(user.user_id, unsavedId);
        db.setSysConfig(`ast_unsaved_${user.user_id}`, "");
      }
      // Return to source screen
      const source = db.getSysConfig(`ast_return_to_${user.user_id}`) || db.getSysConfig(`ast_source_${user.user_id}`) || "pset_autosell_manual";
      db.setSysConfig(`ast_return_to_${user.user_id}`, "");
      db.setSysConfig(`ast_source_${user.user_id}`, "");
        if (source !== "pset_autosell_manual") {
          console.log("[AST BACK] source:", source, "onSourceBack:", !!onSourceBack);
          if (onSourceBack) return onSourceBack(source);
        ctx.callbackQuery.data = source;
        await bot.handleUpdate({ callback_query: ctx.callbackQuery });
        return;
      }
      const { buildAutoSellListScreen } = require("../keyboards");
      const s = db.getSettings(user.user_id);
      const templates = db.getAutoSellTemplates(user.user_id);
      const listMsg = `🤖 *Auto Sell Templates*\n\n━━━━━━━━━━━━━━━━━━━\n📚 *HOW IT WORKS:*\n🛑 SL = auto sell if price drops\n🎯 TP = auto sell if price rises\n\n📌 Selected template here applies to:\n   Manual buys & Auto Buy only\n\n💡 Each Copy Wallet, Copy Channel\n   and Sniper can have its OWN\n   template assigned separately\n━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(listMsg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, s?.auto_sell_template_id, s?.auto_sell_enabled) }); }
      catch { await ctx.reply(listMsg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, s?.auto_sell_template_id, s?.auto_sell_enabled) }); }
      return;
    }

    // Handle sas_toggle FIRST
    if (action === "sas_toggle") {
      const s = db.getSettings(user.user_id);
      const v = s?.auto_sell_enabled ? 0 : 1;
      db.updateSettings(user.user_id, { auto_sell_enabled: v });
      await ctx.answerCallbackQuery(v ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌");
      const { buildAutoSellListScreen } = require("../keyboards");
      const templates = db.getAutoSellTemplates(user.user_id);
      const fresh = db.getSettings(user.user_id);
      const togMsg = `🤖 *Auto Sell Templates*\n\n━━━━━━━━━━━━━━━━━━━\n📚 *HOW IT WORKS:*\n🛑 SL = auto sell if price drops\n🎯 TP = auto sell if price rises\n\n📌 Selected template here applies to:\n   Manual buys & Auto Buy only\n\n💡 Each Copy Wallet, Copy Channel\n   and Sniper can have its OWN\n   template assigned separately\n━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(togMsg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, fresh?.auto_sell_template_id, fresh?.auto_sell_enabled) }); }
      catch { try { await ctx.editMessageReplyMarkup({ reply_markup: buildAutoSellListScreen(templates, fresh?.auto_sell_template_id, fresh?.auto_sell_enabled) }); } catch {} }
      return;
    }

    // Handle ast_new FIRST
    if (action === "ast_new") {
      await ctx.answerCallbackQuery();
      const newId = db.createAutoSellTemplate(user.user_id, "New Template");
      db.setSysConfig(`ast_unsaved_${user.user_id}`, String(newId));
      const sourceData = ctx.callbackQuery?.data || "auto_sell";
      db.setSysConfig(`ast_source_${user.user_id}`, "pset_autosell_manual");
      const t = db.getAutoSellTemplate(user.user_id, newId);
      const { buildAutoSellTemplateScreen } = require("../keyboards");
      const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
      const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t, db.getSysConfig(`ast_expand_${user.user_id}_${t.id}`) || "") });
      db.setSysConfig(`ast_msg_${user.user_id}`, String(sent.message_id));
      return;
    }

    // Handle autobuy FIRST
    if (action === "pset_autobuy_screen" || action === "ab_toggle" || action === "ab_amount" || action === "ab_slippage" || action === "ab_gas" || action === "ab_max" || action === "ab_mev") {
      const s2 = db.getSettings(user.user_id);
      if (action === "ab_toggle") { const v = s2?.auto_buy_enabled ? 0 : 1; db.updateSettings(user.user_id, { auto_buy_enabled: v }); await ctx.answerCallbackQuery(v ? "🤖 Auto Buy: ON ✅" : "🤖 Auto Buy: OFF ◻️"); }
      else if (action === "ab_mev") { const v = s2?.auto_buy_mev ? 0 : 1; db.updateSettings(user.user_id, { auto_buy_mev: v }); await ctx.answerCallbackQuery(v ? "🛡 MEV: ON" : "🛡 MEV: OFF"); }
      else if (action === "ab_amount") { await ctx.answerCallbackQuery(); const p = await sendPrompt(ctx, "🤖 *Auto Buy Amount*\n\nEnter SOL per auto buy (e.g. 0.1):"); db.setSysConfig(`prompt_msg_${user.user_id}`, String(p)); db.setSysConfig(`pending_${user.user_id}`, "ab_set_amount"); return; }
      else if (action === "ab_slippage") { await ctx.answerCallbackQuery(); const p = await sendPrompt(ctx, "📉 *Auto Buy Slippage*\n\nEnter % (e.g. 10):"); db.setSysConfig(`prompt_msg_${user.user_id}`, String(p)); db.setSysConfig(`pending_${user.user_id}`, "ab_set_slippage"); return; }
      else if (action === "ab_gas") { await ctx.answerCallbackQuery(); const p = await sendPrompt(ctx, "⛽ *Auto Buy Gas*\n\nEnter SOL gas fee (e.g. 0.005):"); db.setSysConfig(`prompt_msg_${user.user_id}`, String(p)); db.setSysConfig(`pending_${user.user_id}`, "ab_set_gas"); return; }
      else if (action === "ab_max") { await ctx.answerCallbackQuery(); const p = await sendPrompt(ctx, "🔢 *Max Buys Per Token*\n\nEnter max times (e.g. 1):"); db.setSysConfig(`prompt_msg_${user.user_id}`, String(p)); db.setSysConfig(`pending_${user.user_id}`, "ab_set_max"); return; }
      else { await ctx.answerCallbackQuery(); }
      const fresh2 = db.getSettings(user.user_id);
      const { buildAutoBuyScreen } = require("../keyboards");
      const abMsg = `🤖 *Auto Buy*\n\n━━━━━━━━━━━━━━━━━━━\n📚 *HOW IT WORKS:*\nWhen ON — any CA you paste in chat\nauto-buys instantly with your settings.\nNo confirm screen needed.\n━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(abMsg, { parse_mode: "Markdown", reply_markup: buildAutoBuyScreen(fresh2) }); const mid = ctx.callbackQuery?.message?.message_id; if (mid) db.setSysConfig(`autobuy_msg_${user.user_id}`, String(mid)); }
      catch { const sent = await ctx.reply(abMsg, { parse_mode: "Markdown", reply_markup: buildAutoBuyScreen(fresh2) }); db.setSysConfig(`autobuy_msg_${user.user_id}`, String(sent.message_id)); }
      return;
    }

    // Handle delete FIRST before anything else
    if (action && action.indexOf("ast_delete_") === 0) {
      const id = parseInt(action.replace("ast_delete_", ""));
      db.deleteAutoSellTemplate(user.user_id, id);
      await ctx.answerCallbackQuery("🗑 Deleted!");
      const { buildAutoSellListScreen } = require("../keyboards");
      const s2 = db.getSettings(user.user_id);
      const templates2 = db.getAutoSellTemplates(user.user_id);
      const listMsg2 = `🤖 *Auto Sell Templates*\n\n━━━━━━━━━━━━━━━━━━━\n📋 Templates define when to auto-sell\n✅ Selected = currently in use\n━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(listMsg2, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates2, s2?.auto_sell_template_id, s2?.auto_sell_enabled) }); }
      catch { await ctx.reply(listMsg2, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates2, s2?.auto_sell_template_id, s2?.auto_sell_enabled) }); }
      return;
    }
        const settings = db.getSettings(user.user_id) || {};

  // ── INSTANT TOGGLES ──────────────────────────────────────────
  if (action === "set_autobuy") {
    const v = settings.auto_buy ? 0 : 1;
    db.updateSettings(user.user_id, { auto_buy: v });
    await ctx.answerCallbackQuery(`Auto Buy: ${v ? "✅ ON" : "◻️ OFF"}`);
    await refreshSettings(ctx, user);
    return;
  }

  if (action === "set_autosell") {
    const v = settings.auto_sell ? 0 : 1;
    db.updateSettings(user.user_id, { auto_sell: v });
    await ctx.answerCallbackQuery(`Auto Sell: ${v ? "✅ ON" : "◻️ OFF"}`);
    await refreshSettings(ctx, user);
    return;
  }

  if (action === "set_mev") {
    const v = (settings.mev_protect ?? 1) ? 0 : 1;
    db.updateSettings(user.user_id, { mev_protect: v });
    await ctx.answerCallbackQuery(`MEV Protection: ${v ? "✅ ON" : "⬜ OFF"}`);
    const fresh = db.getUser(user.user_id);
    const freshS = db.getSettings(user.user_id);
    const uws = { ...fresh, settings: freshS };
    const kb = fresh.mode === "pro" ? buildExecutionSettingsMenu(freshS) : buildBeginnerSettingsMenu(uws);
    try { await ctx.editMessageReplyMarkup({ reply_markup: kb }); } catch {}
    return;
  }

  if (action === "pset_confirm") {
    const v = settings.confirm_trades ? 0 : 1;
    db.updateSettings(user.user_id, { confirm_trades: v });
    await ctx.answerCallbackQuery(`Confirm Trades: ${v ? "✅ ON" : "⬜ OFF"}`);
    const freshS = db.getSettings(user.user_id);
    const execG = `⚡ *Execution Settings*

🟢 *Buy* — SOL per trade (B1/B2/B3)
🔴 *Sell* — % of position (S1/S2/S3)
📉 *Slippage* — Max price movement
✅ *Confirm* — Ask before each trade
🛡 *MEV* — Sandwich protection

⚡ *Priority Fee (Speed):*
▸ Std: ~0.001 SOL
▸ Fast 🐎: ~0.003 SOL
▸ Turbo 🚀: ~0.0075 SOL
▸ Boost 🔥: ~0.01 SOL
▸ Custom ✏️: set your own

⚡ *Jito Tip* — Bundle priority
▸ Min: 0.0001 | Std: 0.005 | Fast: 0.01 | Pri: 0.05`;
    try { await ctx.editMessageText(execG, { parse_mode: "Markdown", reply_markup: buildExecutionSettingsMenu(freshS) }); } catch {}
    return;
  }

  if (action === "set_weekly") {
    const v = settings.weekly_summary ? 0 : 1;
    db.updateSettings(user.user_id, { weekly_summary: v });
    await ctx.answerCallbackQuery(`Weekly PnL: ${v ? "✅ ON" : "◻️ OFF"}`);
    await refreshSettings(ctx, user);
    return;
  }

  // ── SPEED MODES — instant ─────────────────────────────────────
  if (action === "bset_speed_fast" || action === "bset_speed_turbo") {
    const speed = action === "bset_speed_fast" ? "fast" : "turbo";
    db.updateSettings(user.user_id, { speed_mode: speed });
    await ctx.answerCallbackQuery(`✅ Speed: ${speed}`);
    const freshU = db.getUser(user.user_id);
    const freshS = db.getSettings(user.user_id);
    const uws = { ...freshU, settings: freshS };
    // Refresh the CORRECT menu based on mode (was always Pro execution)
    const kb = freshU.mode === "pro" ? buildExecutionSettingsMenu(freshS, false, false, false) : buildBeginnerSettingsMenu(uws);
    try { await ctx.editMessageReplyMarkup({ reply_markup: kb }); } catch {}
    return;
  }

  if (action === "bset_speed_custom") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx,
      "⚡ *Custom Priority Fee*\n\n" +
      "Fast 🐎 uses *0.003 SOL* per trade.\n" +
      "Turbo 🚀 uses *0.0075 SOL* per trade.\n\n" +
      "Enter your preferred SOL amount (e.g. 0.005):"
    );
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "set_custom_speed");
    return;
  }

  // Pro speed

  // ── TEXT INPUT PROMPTS ────────────────────────────────────────
  if (action === "set_slippage") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "📉 *Buy Slippage*\n\nEnter % (1–50). Type *none* to cancel:");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "set_slippage");
    return;
  }

  if (action === "set_sell_slippage") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "📉 *Sell Slippage*\n\nEnter % (1–50). Type *none* to cancel:");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "set_sell_slippage");
    return;
  }



  if (action === "set_session") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "⏱ *Session Timeout*\n\nEnter hours (1–24) or 0 to disable:");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "set_session");
    return;
  }

  if (action.startsWith("pset_jito_preset_")) {
    const val = action.replace("pset_jito_preset_", "");
    db.updateSettings(user.user_id, { jito_tip: parseFloat(val) });
    await ctx.answerCallbackQuery(`✅ Jito: ${val} SOL`);
    const freshS2 = db.getSettings(user.user_id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildExecutionSettingsMenu(freshS2, false) }); } catch {}
    return;
  }

  if (action === "pset_jito") {
    await ctx.answerCallbackQuery();
    const freshS = db.getSettings(user.user_id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildExecutionSettingsMenu(freshS, true) }); } catch {}
    return;
  }

  if (action === "pset_jito_custom") {
    await ctx.answerCallbackQuery();
    const p = await sendPrompt(ctx, "⚡ *Custom Jito Tip*\n\nEnter SOL (e.g. 0.005):");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(p));
    db.setSysConfig(`pending_${user.user_id}`, "set_jito");
    return;
  }

  if (action === "pset_b_custom") {
    await ctx.answerCallbackQuery();
    const p = await sendPrompt(ctx, "🟢 *Custom Buy Amount*\n\nEnter SOL amount (e.g. 0.15):\n_One-time custom buy._");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(p));
    db.setSysConfig(`pending_${user.user_id}`, "buy_custom_amount");
    return;
  }

  // Buy/sell amount presets
  for (const n of [1,2,3]) {
    if (action === `bset_buy${n}` || action === `pset_b${n}`) {
      await ctx.answerCallbackQuery();
      const promptId = await sendPrompt(ctx, `🟢 *Buy Amount ${n}*\n\nEnter SOL amount (e.g. 0.2):`);
      db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
      db.setSysConfig(`pending_${user.user_id}`, `set_buy_amt_${n}`);
      return;
    }
    if (action === `bset_sell${n}` || action === `pset_s${n}`) {
      await ctx.answerCallbackQuery();
      const promptId = await sendPrompt(ctx, `🔴 *Sell % ${n}*\n\nEnter sell percentage (e.g. 50):`);
      db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
      db.setSysConfig(`pending_${user.user_id}`, `set_sell_pct_${n}`);
      return;
    }
  }

  if (action === "bset_sell_info") {
    await ctx.answerCallbackQuery({ text: "Initial = sells your original invested SOL worth. e.g. bought 1 SOL → sells 1 SOL worth of tokens", show_alert: true });
    return;
  }

  if (action === "bset_show_hide") {
    await ctx.answerCallbackQuery("Tap a token in Positions → tap 👁 to hide/show it.");
    return;
  }

  // ── SAP PIN ───────────────────────────────────────────────────
  if (action === "set_sap") {
    await ctx.answerCallbackQuery();
    const freshUser = db.getUser(user.user_id);
    if (freshUser.sap_enabled && freshUser.sap_hash) {
      await ctx.reply(
        "🔐 *Security PIN*\n\nYou already have a PIN set.\n\nEnter your current PIN to change it, or tap Remove PIN:",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🗑 Remove PIN", callback_data: "sap_remove" }],
              [{ text: "← Cancel",     callback_data: "menu_settings" }],
            ],
          },
        }
      );
      db.setSysConfig(`pending_${user.user_id}`, "sap_verify_change");
    } else {
      const promptId = await sendPrompt(ctx,
        "🔐 *Set Security PIN*\n\n" +
        "Enter a PIN (6–34 characters).\n\n" +
        "Make it strong — mix numbers and letters.\n" +
        "⚠️ *Cannot be recovered if lost. Save it somewhere safe.*"
      );
      db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
      db.setSysConfig(`pending_${user.user_id}`, "sap_set_new");
    }
    return;
  }

  if (action === "sap_remove") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "🔐 *Remove PIN*\n\nEnter your current PIN to confirm removal:");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "sap_verify_remove");
    return;
  }

  // ── LANGUAGE ──────────────────────────────────────────────────
  if (action === "alert_add_price") {
    await ctx.answerCallbackQuery();
    const alerts = db.getPriceAlerts(user.user_id);
    let msg = "🔔 *Price Alerts*\n\nGet notified when token hits target.\n▸ Paste CA → set Price or MCap\n━━━━━━━━━━━━━━━━━━━\n";
    if (alerts.length === 0) msg += "_No active alerts._\n";
    else alerts.forEach((a,i) => { const tn=a.token_name||a.token_ca.slice(0,8); const dir=a.direction==="mcap_above"?"MCap▲":"Price▲"; const val=a.target_price>=1000000?"$"+(a.target_price/1000000).toFixed(1)+"M":a.target_price>=1000?"$"+(a.target_price/1000).toFixed(0)+"K":"$"+a.target_price; msg+=(i+1)+". *"+tn+"* — "+dir+" "+val+"\n"; });
    msg += "\n_Paste CA to add alert:_";
    db.setSysConfig("pending_"+user.user_id, "alert_add_ca");
    const alertKb = { inline_keyboard: [
      ...alerts.map(a => { const tn=(a.token_name||a.token_ca.slice(0,8)).slice(0,12); const dir=a.direction==="mcap_above"?"MCap▲":"▲"; const val=a.target_price>=1000000?"$"+(a.target_price/1000000).toFixed(1)+"M":a.target_price>=1000?"$"+(a.target_price/1000).toFixed(0)+"K":"$"+a.target_price; return [{ text: tn+" "+dir+" "+val+" 🗑", callback_data: "alert_remove_"+a.id }]; }),
      [{ text: "← Back", callback_data: "pset_alerts" }],
    ]};
    try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: alertKb }); }
    catch { await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: alertKb }); }
    return true;
  }

  if (action.startsWith("alert_remove_")) {
    const id = parseInt(action.replace("alert_remove_", ""));
    db.getDb().prepare("DELETE FROM price_alerts WHERE id = ? AND user_id = ?").run(id, user.user_id);
    await ctx.answerCallbackQuery("✅ Removed!");
    const alerts2 = db.getPriceAlerts(user.user_id);
    const alertKb2 = { inline_keyboard: [
      ...alerts2.map(a => { const tn=(a.token_name||a.token_ca.slice(0,8)).slice(0,12); const dir=a.direction==="mcap_above"?"MCap▲":"▲"; const val=a.target_price>=1000000?"$"+(a.target_price/1000000).toFixed(1)+"M":a.target_price>=1000?"$"+(a.target_price/1000).toFixed(0)+"K":"$"+a.target_price; return [{ text: tn+" "+dir+" "+val+" 🗑", callback_data: "alert_remove_"+a.id }]; }),
      [{ text: "← Back", callback_data: "pset_alerts" }],
    ]};
    try { await ctx.editMessageReplyMarkup({ reply_markup: alertKb2 }); } catch {}
    return true;
  }

  if (action === "alert_add_wallet") {
    await ctx.answerCallbackQuery();
    const trackers = db.getWalletTrackers(user.user_id);
    let msg2 = "👛 *Wallet Tracker*\n\nGet notified when a wallet trades.\n▸ Paste wallet address to track\n━━━━━━━━━━━━━━━━━━━\n";
    if (trackers.length === 0) msg2 += "_No wallets tracked._\n";
    else trackers.forEach((t,i) => { msg2 += (i+1)+". *"+t.label+"*\n"; });
    msg2 += "\n_Paste wallet address:_";
    db.setSysConfig("pending_"+user.user_id, "tracker_add_address");
    const trackerKb = { inline_keyboard: [
      ...trackers.map(t => [{ text: t.label+" 🗑", callback_data: "tracker_remove_"+t.id }]),
      [{ text: "← Back", callback_data: "pset_alerts" }],
    ]};
    try { await ctx.editMessageText(msg2, { parse_mode: "Markdown", reply_markup: trackerKb }); }
    catch { await ctx.reply(msg2, { parse_mode: "Markdown", reply_markup: trackerKb }); }
    return true;
  }

  if (action.startsWith("tracker_remove_")) {
    const id = parseInt(action.replace("tracker_remove_", ""));
    db.removeWalletTracker(user.user_id, id);
    await ctx.answerCallbackQuery("✅ Removed!");
    const trackers2 = db.getWalletTrackers(user.user_id);
    const trackerKb2 = { inline_keyboard: [
      ...trackers2.map(t => [{ text: t.label+" 🗑", callback_data: "tracker_remove_"+t.id }]),
      [{ text: "← Back", callback_data: "pset_alerts" }],
    ]};
    try { await ctx.editMessageReplyMarkup({ reply_markup: trackerKb2 }); } catch {}
    return true;
  }

  if (action === "set_language") {
    await ctx.answerCallbackQuery();
    await ctx.reply("🌐 Select your language:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🇺🇸 English", callback_data: "lang_en" },
            { text: "🇸🇦 العربية", callback_data: "lang_ar" },
          ],
          [
            { text: "🇨🇳 中文",    callback_data: "lang_zh" },
            { text: "🇷🇺 Русский", callback_data: "lang_ru" },
          ],
          [{ text: "← Back", callback_data: "menu_settings" }],
        ],
      },
    });
    return;
  }

  // ── PRO SUB-SETTINGS SCREENS ─────────────────────────────────
  if (action === "pset_autosell_screen") {
    await ctx.answerCallbackQuery();
    const { buildAutoSellListScreen } = require("../keyboards");
    const templates = db.getAutoSellTemplates(user.user_id);
    const s = db.getSettings(user.user_id);
    const msg = `🤖 *Auto Sell Templates*\n\n━━━━━━━━━━━━━━━━━━━\n📚 *HOW IT WORKS:*\n🛑 SL = auto sell if price drops\n🎯 TP = auto sell if price rises\n\n📌 Selected template here applies to:\n   Manual buys & Auto Buy only\n\n💡 Each Copy Wallet, Copy Channel\n   and Sniper can have its OWN\n   template assigned separately\n━━━━━━━━━━━━━━━━━━━`;
    try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, s?.auto_sell_template_id, s?.auto_sell_enabled) }); }
    catch {
      try { await ctx.deleteMessage(); } catch {}
      await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, s?.auto_sell_template_id, s?.auto_sell_enabled) });
    }
    return;
  }


  if (action.startsWith("ast_view_")) {
      const id = parseInt(action.replace("ast_view_", ""));
      const t  = db.getAutoSellTemplate(user.user_id, id);
      if (!t) { await ctx.answerCallbackQuery("Not found."); return; }
      await ctx.answerCallbackQuery();
      const { buildAutoSellTemplateScreen } = require("../keyboards");
      const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (msgId) db.setSysConfig(`ast_msg_${user.user_id}`, String(msgId));
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t, db.getSysConfig(`ast_expand_${user.user_id}_${t.id}`) || "") }); }
      catch { 
        const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t, db.getSysConfig(`ast_expand_${user.user_id}_${t.id}`) || "") });
        db.setSysConfig(`ast_msg_${user.user_id}`, String(sent.message_id));
      }
      return;
    }
    if (action === "ast_new") {
      await ctx.answerCallbackQuery();
      const newId = db.createAutoSellTemplate(user.user_id, "New Template");
      const t = db.getAutoSellTemplate(user.user_id, newId);
      const { buildAutoSellTemplateScreen } = require("../keyboards");
      const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
      const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t, db.getSysConfig(`ast_expand_${user.user_id}_${t.id}`) || "") });
      db.setSysConfig(`ast_msg_${user.user_id}`, String(sent.message_id));
      return;
    }

    if (action.startsWith("ast_toggle_")) {
    const id = parseInt(action.replace("ast_toggle_", ""));
    const t  = db.getAutoSellTemplate(user.user_id, id);
    if (!t) { await ctx.answerCallbackQuery("Not found."); return; }
    db.updateAutoSellTemplate(user.user_id, id, { active: t.active ? 0 : 1 });
    await ctx.answerCallbackQuery(t.active ? "⏸ Paused" : "✅ Activated");
    const { buildAutoSellTemplateScreen } = require("../keyboards");
    const updated = db.getAutoSellTemplate(user.user_id, id);
    try { await ctx.editMessageText(`🤖 *${updated.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(updated, db.getSysConfig(`ast_expand_${user.user_id}_${updated.id}`) || "") }); } catch {}
    return;
  }

  // Expand/collapse SL or TP section
  if (action.startsWith("ast_expand_sl_") || action.startsWith("ast_expand_tp_")) {
    const isSl = action.startsWith("ast_expand_sl_");
    const id = parseInt(action.replace(isSl ? "ast_expand_sl_" : "ast_expand_tp_", ""));
    await ctx.answerCallbackQuery();
    const t = db.getAutoSellTemplate(user.user_id, id);
    if (!t) { await ctx.answerCallbackQuery("Not found."); return; }
    const { buildAutoSellTemplateScreen } = require("../keyboards");
    // Toggle: if already expanded, collapse (no expand param)
    const curExpand = db.getSysConfig(`ast_expand_${user.user_id}_${id}`) || "";
    const newExpand = curExpand === (isSl ? "sl" : "tp") ? "" : (isSl ? "sl" : "tp");
    db.setSysConfig(`ast_expand_${user.user_id}_${id}`, newExpand);
    const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
    try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t, newExpand) }); } catch {}
    return;
  }

  // Delete confirm step
  if (action.startsWith("ast_del_confirm_")) {
    const id = parseInt(action.replace("ast_del_confirm_", ""));
    const t = db.getAutoSellTemplate(user.user_id, id);
    if (!t) { await ctx.answerCallbackQuery("Not found."); return; }
    await ctx.answerCallbackQuery();
    const { InlineKeyboard } = require("grammy");
    const kb = new InlineKeyboard();
    kb.text("✅ Yes, delete it", `ast_delete_${id}`).row();
    kb.text("❌ Cancel", "pset_autosell_screen").row();
    try { await ctx.editMessageText(`🗑 *Delete "${t.name}"?*\n\nThis cannot be undone.`, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
    return;
  }

  // Select template (stays on list screen)
  if (action.startsWith("ast_select_")) {
    const id = parseInt(action.replace("ast_select_", ""));
    await ctx.answerCallbackQuery("✅ Template selected!");
    const s = db.getSettings(user.user_id);
    db.updateSettings(user.user_id, { auto_sell_template_id: id });
    const { buildAutoSellListScreen } = require("../keyboards");
    const templates = db.getAutoSellTemplates(user.user_id);
    const updatedS = db.getSettings(user.user_id);
    const listMsg = `🤖 *Auto Sell Templates*\n\n━━━━━━━━━━━━━━━━━━━\n📚 *HOW IT WORKS:*\n🛑 SL = auto sell if price drops\n🎯 TP = auto sell if price rises\n\n📌 Selected template applies to:\n   Manual buys & Auto Buy only\n━━━━━━━━━━━━━━━━━━━`;
    try { await ctx.editMessageText(listMsg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, updatedS?.auto_sell_template_id, updatedS?.auto_sell_enabled) }); } catch {}
    return;
  }

  if (action.startsWith("ast_rename_") || action?.startsWith("ast_rename_")) {
    const id = parseInt(action.replace("ast_rename_", ""));
    await ctx.answerCallbackQuery();
    db.setSysConfig(`ast_edit_id_${user.user_id}`, String(id));
    const promptId = await sendPrompt(ctx, "✏️ Enter new template name:");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "ast_set_name");
    return;
  }

  if (action.includes("ast_delete")) {
    const id = parseInt(action.replace("ast_delete_", ""));
    db.deleteAutoSellTemplate(user.user_id, id);
    await ctx.answerCallbackQuery("🗑 Deleted!");
    const { buildAutoSellListScreen } = require("../keyboards");
    const s2 = db.getSettings(user.user_id);
    const templates2 = db.getAutoSellTemplates(user.user_id);
    const listMsg2 = `🤖 *Auto Sell Templates*\n\n━━━━━━━━━━━━━━━━━━━\n📚 *HOW IT WORKS:*\n🛑 SL = auto sell if price drops\n🎯 TP = auto sell if price rises\n\n📌 Selected template here applies to:\n   Manual buys & Auto Buy only\n\n💡 Each Copy Wallet, Copy Channel\n   and Sniper can have its OWN\n   template assigned separately\n━━━━━━━━━━━━━━━━━━━`;
    const chatId4 = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
    const msgId4 = ctx.callbackQuery?.message?.message_id;
    console.log("[AST] chatId:", chatId4, "msgId:", msgId4);
    try { if (chatId4 && msgId4) await ctx.api.deleteMessage(chatId4, msgId4); } catch(e) { console.log("[AST] del err:", e.message); }
    try { await ctx.api.sendMessage(chatId4, listMsg2, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates2, s2?.auto_sell_template_id, s2?.auto_sell_enabled) }); console.log("[AST] sent!"); } catch(e) { console.log("[AST] send err:", e.message); }
    return;
  }
    if (action.startsWith("ast_sl_pct_")) {
      const parts = action.replace("ast_sl_pct_", "").split("_");
      const i = parseInt(parts[0]); const id = parseInt(parts[1]);
      await ctx.answerCallbackQuery();
      db.setSysConfig(`ast_edit_id_${user.user_id}`, String(id));
      db.setSysConfig(`ast_edit_field_${user.user_id}`, `sl_${i}_sell_pct`);
      const promptId = await sendPrompt(ctx, `🛑 *SL${i} Sell %*\n\nEnter % of remaining tokens to sell (e.g. 100):`);
      db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
      db.setSysConfig(`pending_${user.user_id}`, "ast_set_sl_pct");
      return;
    }
    
    if (action.startsWith("ast_sl_trail_")) {
      const parts = action.replace("ast_sl_trail_", "").split("_");
      const i = parseInt(parts[0]); const id = parseInt(parts[1]);
      const t = db.getAutoSellTemplate(user.user_id, id);
      if (!t) { await ctx.answerCallbackQuery("Not found."); return; }
      db.updateAutoSellTemplate(user.user_id, id, { [`sl_${i}_trail`]: t[`sl_${i}_trail`] ? 0 : 1 });
      await ctx.answerCallbackQuery("✅ Updated");
      const { buildAutoSellTemplateScreen } = require("../keyboards");
      const updated = db.getAutoSellTemplate(user.user_id, id);
      const msg = `🤖 *${updated.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(updated, db.getSysConfig(`ast_expand_${user.user_id}_${updated.id}`) || "") }); } catch {}
      return;
    }
    if (action.startsWith("ast_tp_pct_")) {
      const parts = action.replace("ast_tp_pct_", "").split("_");
      const i = parseInt(parts[0]); const id = parseInt(parts[1]);
      await ctx.answerCallbackQuery();
      db.setSysConfig(`ast_edit_id_${user.user_id}`, String(id));
      db.setSysConfig(`ast_edit_field_${user.user_id}`, `tp_${i}_pct`);
      const promptId = await sendPrompt(ctx, `🎯 *TP${i} Sell %*\n\nEnter % of remaining tokens to sell (e.g. 50):`);
      db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
      db.setSysConfig(`pending_${user.user_id}`, "ast_set_tp_pct");
      return;
    }
    
    if (action.startsWith("ast_tp_trail_")) {
      const parts = action.replace("ast_tp_trail_", "").split("_");
      const i = parseInt(parts[0]); const id = parseInt(parts[1]);
      const t = db.getAutoSellTemplate(user.user_id, id);
      if (!t) { await ctx.answerCallbackQuery("Not found."); return; }
      db.updateAutoSellTemplate(user.user_id, id, { [`tp_${i}_trail`]: t[`tp_${i}_trail`] ? 0 : 1 });
      await ctx.answerCallbackQuery("✅ Updated");
      const { buildAutoSellTemplateScreen } = require("../keyboards");
      const updated = db.getAutoSellTemplate(user.user_id, id);
      const msg = `🤖 *${updated.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(updated, db.getSysConfig(`ast_expand_${user.user_id}_${updated.id}`) || "") }); } catch {}
      return;
    }

    if (action.startsWith("ast_sl_") && !action.startsWith("ast_sl_pct_") && !action.startsWith("ast_sl_trail_")) {
    const parts = action.replace("ast_sl_", "").split("_");
    const i = parseInt(parts[0]); const id = parseInt(parts[1]);
    await ctx.answerCallbackQuery();
    db.setSysConfig(`ast_edit_id_${user.user_id}`, String(id));
    db.setSysConfig(`ast_edit_field_${user.user_id}`, `sl_${i}`);
    const promptId = await sendPrompt(ctx, `🛑 *SL${i}*\n\nEnter stop loss % (e.g. -25) or 0 to disable:`);
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "ast_set_sl");
    return;
  }
    if (action.startsWith("ast_tp_") && !action.startsWith("ast_tp_pct_") && !action.startsWith("ast_tp_trail_")) {
      const parts = action.replace("ast_tp_", "").split("_");
      const i = parseInt(parts[0]); const id = parseInt(parts[1]);
      await ctx.answerCallbackQuery();
      db.setSysConfig(`ast_edit_id_${user.user_id}`, String(id));
      db.setSysConfig(`ast_edit_field_${user.user_id}`, `tp_${i}`);
      const promptId = await sendPrompt(ctx, `🎯 *TP${i}*\n\nEnter take profit % (e.g. 100) or 0 to disable:`);
      db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
      db.setSysConfig(`pending_${user.user_id}`, "ast_set_tp");
      return;
    }
  if (action.startsWith("ast_tp_pct_") || action?.startsWith("ast_tp_pct_")) {
    const parts = action.replace("ast_tp_pct_", "").split("_");
    const i = parseInt(parts[0]); const id = parseInt(parts[1]);
    await ctx.answerCallbackQuery();
    db.setSysConfig(`ast_edit_id_${user.user_id}`, String(id));
    db.setSysConfig(`ast_edit_field_${user.user_id}`, `tp_${i}_pct`);
    const promptId = await sendPrompt(ctx, `🎯 *TP${i} Sell %*\n\nEnter % to sell at this TP (e.g. 50):`);
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "ast_set_tp_pct");
    return;
  }

      if (action.startsWith("ast_save_") || action?.startsWith("ast_save_")) {
    db.setSysConfig(`ast_unsaved_${user.user_id}`, "");
    db.setSysConfig(`ast_source_${user.user_id}`, "");
    await ctx.answerCallbackQuery("✅ Template saved!");
    const { buildAutoSellListScreen } = require("../keyboards");
    const s = db.getSettings(user.user_id);
    const templates = db.getAutoSellTemplates(user.user_id);
    const listMsg = `🤖 *Auto Sell Templates*\n\n━━━━━━━━━━━━━━━━━━━\n📚 *HOW IT WORKS:*\n🛑 SL = auto sell if price drops\n🎯 TP = auto sell if price rises\n\n📌 Selected template here applies to:\n   Manual buys & Auto Buy only\n\n💡 Each Copy Wallet, Copy Channel\n   and Sniper can have its OWN\n   template assigned separately\n━━━━━━━━━━━━━━━━━━━`;
    try { await ctx.editMessageText(listMsg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, s?.auto_sell_template_id, s?.auto_sell_enabled) }); }
    catch { await ctx.reply(listMsg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, s?.auto_sell_template_id, s?.auto_sell_enabled) }); }
    return;
  }
      if (action === "sas_toggle") {
        const s = db.getSettings(user.user_id);
        const v = s?.auto_sell_enabled ? 0 : 1;
        db.updateSettings(user.user_id, { auto_sell_enabled: v });
        await ctx.answerCallbackQuery(v ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌");
        const { buildAutoSellListScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(user.user_id);
        const fresh = db.getSettings(user.user_id);
        const togMsg = `🤖 *Auto Sell Templates*\n\n━━━━━━━━━━━━━━━━━━━\n📚 *HOW IT WORKS:*\n🛑 SL = auto sell if price drops\n🎯 TP = auto sell if price rises\n\n📌 Selected template here applies to:\n   Manual buys & Auto Buy only\n\n💡 Each Copy Wallet, Copy Channel\n   and Sniper can have its OWN\n   template assigned separately\n━━━━━━━━━━━━━━━━━━━`;
        try { await ctx.editMessageText(togMsg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, fresh.auto_sell_template_id, fresh.auto_sell_enabled) }); }
        catch { try { await ctx.editMessageReplyMarkup({ reply_markup: buildAutoSellListScreen(templates, fresh.auto_sell_template_id, fresh.auto_sell_enabled) }); } catch {} }
        return;
      }

      if (action === "pset_autosell_manual" || action.startsWith("sas_use_")) {
      const { buildSettingsAutoSellScreen } = require("../keyboards");
      const s = db.getSettings(user.user_id);

      if (action === "sas_toggle") {
        const v = s?.auto_sell_enabled ? 0 : 1;
        db.updateSettings(user.user_id, { auto_sell_enabled: v });
        await ctx.answerCallbackQuery(v ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌");
      } else if (action.startsWith("sas_use_")) {
        const tId = parseInt(action.replace("sas_use_", ""));
        db.updateSettings(user.user_id, { auto_sell_template_id: tId });
        await ctx.answerCallbackQuery("✅ Template selected!");
      } else {
        await ctx.answerCallbackQuery();
      }

      const fresh = db.getSettings(user.user_id);
      const templates = db.getAutoSellTemplates(user.user_id);
      const msg =
        `🤖 *Auto Sell — Manual Buys*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📚 *HOW IT WORKS:*\n` +
        `When ON — every manual buy or\n` +
        `auto buy will use this template\n` +
        `to auto sell based on SL & TP.\n` +
        `━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildSettingsAutoSellScreen(fresh, templates) }); }
      catch (e) {
        if (e?.description?.includes("not modified")) return;
        await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildSettingsAutoSellScreen(fresh, templates) });
      }
      return;
    }
  console.log("[AUTOBUY] checking:", action);

    if (action === "ab_amount") {
      await ctx.answerCallbackQuery();
      const promptId = await sendPrompt(ctx, "🤖 *Auto Buy Amount*\n\nEnter SOL per auto buy (e.g. 0.1):");
      db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
      db.setSysConfig(`pending_${user.user_id}`, "ab_set_amount");
      
      return;
    }




  if (action === "pset_execution") {
    await ctx.answerCallbackQuery();
    const s = db.getSettings(user.user_id);
    const execGuide = `⚡ *Execution Settings*

` +
      `🟢 *Buy* — SOL per trade (B1/B2/B3)
` +
      `🔴 *Sell* — % of position (S1/S2/S3)
` +
      `📉 *Slippage* — Max price movement
` +
      `✅ *Confirm* — Ask before each trade
` +
      `🛡 *MEV* — Sandwich protection

` +
      `⚡ *Priority Fee (Speed):*
` +
      `▸ Std: ~0.001 SOL
` +
      `▸ Fast 🐎: ~0.003 SOL
` +
      `▸ Turbo 🚀: ~0.0075 SOL
` +
      `▸ Boost 🔥: ~0.01 SOL
` +
      `▸ Custom ✏️: set your own

` +
      `⚡ *Jito Tip* — Extra fee for bundle priority
` +
      `▸ Min: 0.0001 | Std: 0.005 | Fast: 0.01 | Pri: 0.05`;
    try {
      await ctx.editMessageText(execGuide, { parse_mode: "Markdown", reply_markup: buildExecutionSettingsMenu(s) });
      db.setSysConfig(`exec_msg_${user.user_id}`, String(ctx.callbackQuery?.message?.message_id || 0));
    } catch {
      const sent = await ctx.reply("⚡ *Execution Settings*", { parse_mode: "Markdown", reply_markup: buildExecutionSettingsMenu(s) });
      db.setSysConfig(`exec_msg_${user.user_id}`, String(sent.message_id));
    }
    return;
  }




  if (action === "pset_alerts") {
    await ctx.answerCallbackQuery();
    const alertsS = db.getSettings(user.user_id);
    const alertGuide = "🔔 *Alerts & Notifications*\n\n▸ *Wallet Tracker* — notify when a wallet trades\n▸ *Daily PnL* — daily summary report\n\n💡 _For token price alerts, use_ ⭐ *Watchlist*\n━━━━━━━━━━━━━━━━━━━";
    try { await ctx.editMessageText(alertGuide, { parse_mode: "Markdown", reply_markup: buildAlertsSettingsMenu(alertsS) }); }
    catch { await ctx.reply(alertGuide, { parse_mode: "Markdown", reply_markup: buildAlertsSettingsMenu(alertsS) }); }
    return true;
  }


  // ── Speed expand/presets ─────────────────────────────────────
  if (action === "pset_speed_expand") {
    await ctx.answerCallbackQuery();
    const freshS = db.getSettings(user.user_id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildExecutionSettingsMenu(freshS, false, true, false) }); } catch {}
    return;
  }
  if (action === "pset_speed_standard") {
    db.updateSettings(user.user_id, { speed_mode: "standard" });
    await ctx.answerCallbackQuery("✅ Standard speed");
    const freshS = db.getSettings(user.user_id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildExecutionSettingsMenu(freshS, false, false, false) }); } catch {}
    return;
  }
  if (action === "pset_speed_boost") {
    db.updateSettings(user.user_id, { speed_mode: "boost" });
    await ctx.answerCallbackQuery("✅ Boost speed 🔥");
    const freshS = db.getSettings(user.user_id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildExecutionSettingsMenu(freshS, false, false, false) }); } catch {}
    return;
  }
  // ── Slippage expand/presets ───────────────────────────────────
  if (action === "pset_slippage_expand") {
    await ctx.answerCallbackQuery();
    const freshS = db.getSettings(user.user_id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildExecutionSettingsMenu(freshS, false, false, true) }); } catch {}
    return;
  }
  if (action.startsWith("pset_slip_buy_")) {
    const val = parseInt(action.replace("pset_slip_buy_", ""));
    db.updateSettings(user.user_id, { slippage_pct: val });
    await ctx.answerCallbackQuery(`✅ Buy slippage: ${val}%`);
    const freshS = db.getSettings(user.user_id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildExecutionSettingsMenu(freshS, false, false, true) }); } catch {}
    return;
  }
  if (action.startsWith("pset_slip_sell_")) {
    const val = parseInt(action.replace("pset_slip_sell_", ""));
    db.updateSettings(user.user_id, { sell_slippage_pct: val });
    await ctx.answerCallbackQuery(`✅ Sell slippage: ${val}%`);
    const freshS = db.getSettings(user.user_id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildExecutionSettingsMenu(freshS, false, false, true) }); } catch {}
    return;
  }




  await ctx.answerCallbackQuery("Unknown setting.");
}

// ── Text input handler ────────────────────────────────────────
module.exports = { handleSettingCallback };