// M07 — Settings V12
// All handlers — instant toggle, prompt messages auto-delete
// Beginner and Pro mode settings separated

const db     = require("../../database");
const bcrypt = require("bcryptjs");
const {
  buildBeginnerSettingsMenu, buildProSettingsMenu,
  buildExecutionSettingsMenu, buildMevSettingsMenu,
  buildRiskSettingsMenu, buildAlertsSettingsMenu,
} = require("./keyboards");

// ── Show settings based on mode ───────────────────────────────
async function showSettings(ctx, user) {
  const settings = db.getSettings(user.user_id);
  const isProMode = user.mode === "pro";
  const userWithSettings = { ...user, settings };
  const guide = isProMode
    ? "⚙️ *Pro Settings* — Choose a category:\n\n" +
      "⚡ *Execution* — Buy/sell amounts, slippage, speed\n" +
      "🛡 *MEV* — Protect trades from sandwich bots\n" +
      "🔒 *Risk* — Max trade size, daily limits, SL/TP\n" +
      "🔔 *Alerts* — Price alerts and notifications"
    : "⚙️ *Beginner Settings* — Tap any button to change instantly.\n\n" +
      "🟢 *Buy amounts* — SOL per trade\n" +
      "🔴 *Sell %* — % of position to sell\n" +
      "📉 *Slippage* — Price tolerance %\n" +
      "⚡ *Speed* — Trade execution priority\n" +
      "🔐 *PIN* — Security for key export/withdraw";
  const kb = isProMode
    ? buildProSettingsMenu()
    : buildBeginnerSettingsMenu(userWithSettings);

  try { await ctx.editMessageText(guide, { parse_mode: "Markdown", reply_markup: kb }); }
  catch { await ctx.reply(guide, { parse_mode: "Markdown", reply_markup: kb }); }
}

// ── Send prompt, return message ID for deletion ───────────────
async function sendPrompt(ctx, text) {
  const msg = await ctx.reply(text, { parse_mode: "Markdown" });
  return msg.message_id;
}

async function deleteMsg(ctx, msgId) {
  if (!msgId) return;
  try { await ctx.api.deleteMessage(ctx.chat.id, msgId); } catch {}
}

// ── Instant toggle refresh ────────────────────────────────────
async function refreshSettings(ctx, user) {
  const settings      = db.getSettings(user.user_id);
  const userWithSettings = { ...user, settings };
  const isProMode     = user.mode === "pro";
  const kb = isProMode
    ? buildProSettingsMenu()
    : buildBeginnerSettingsMenu(userWithSettings);
  try { await ctx.editMessageReplyMarkup({ reply_markup: kb }); } catch {}
}

    // ── Main callback handler ─────────────────────────────────────
    async function handleSettingCallback(ctx, user, action) {
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
    await ctx.answerCallbackQuery(`MEV Protection: ${v ? "✅ ON" : "◻️ OFF"}`);
    await refreshSettings(ctx, user);
    return;
  }

  if (action === "pset_confirm") {
    const v = settings.confirm_trades ? 0 : 1;
    db.updateSettings(user.user_id, { confirm_trades: v });
    await ctx.answerCallbackQuery(`Confirm Trades: ${v ? "✅ ON" : "◻️ OFF"}`);
    await refreshSettings(ctx, user);
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
    await refreshSettings(ctx, user);
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
  if (action === "bset_speed_fast" || action === "bset_speed_turbo") {
    const speed = action.includes("fast") ? "fast" : "turbo";
    db.updateSettings(user.user_id, { speed_mode: speed });
    await ctx.answerCallbackQuery(`✅ ${speed}`);
    await refreshSettings(ctx, user);
    return;
  }

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

  if (action === "set_stoploss") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx,
      "🛑 *Stop Loss*\n\nEnter negative % (e.g. -25) or 0 to disable.\n\nType *none* to cancel:"
    );
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "set_stoploss");
    return;
  }

  if (action === "set_takeprofit") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx,
      "🎯 *Take Profit*\n\nEnter positive % (e.g. 100) or 0 to disable.\n\nType *none* to cancel:"
    );
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "set_takeprofit");
    return;
  }

  if (action === "set_maxbuy") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "💰 *Max Buy SOL*\n\nEnter max SOL per trade (e.g. 0.5):");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "set_maxbuy");
    return;
  }

  if (action === "set_session") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "⏱ *Session Timeout*\n\nEnter hours (1–24) or 0 to disable:");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "set_session");
    return;
  }

  if (action === "pset_jito") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "⛽ *Jito Tip*\n\nEnter tip SOL amount (e.g. 0.005):");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "set_jito");
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
    await ctx.answerCallbackQuery(
      "Initial sell = sells your original buy amount worth of tokens. E.g. Bought 1 SOL, now 5 SOL — sells 1 SOL worth.",
      { show_alert: true }
    );
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
    const { buildAutoSellListScreen } = require("./keyboards");
    const templates = db.getAutoSellTemplates(user.user_id);
    const msg =
      `🤖 *Auto Sell Templates*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📚 *HOW IT WORKS:*\n` +
      `Create named templates with SL & TP.\n` +
      `Each template works separately.\n` +
      `Assign any template to any channel,\n` +
      `wallet or sniper independently.\n` +
      `━━━━━━━━━━━━━━━━━━━`;
    try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, db.getSettings(user.user_id)?.auto_sell_template_id, db.getSettings(user.user_id)?.auto_sell_enabled) }); }
          catch { await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, db.getSettings(user.user_id)?.auto_sell_template_id, db.getSettings(user.user_id)?.auto_sell_enabled) }); }
            return;
          }

          if (action.startsWith("ast_back_")) {
      const id = parseInt(action.replace("ast_back_", ""));
      await ctx.answerCallbackQuery();
      const returnTo = db.getSysConfig(`ast_return_to_${user.user_id}`) || "";
      if (returnTo) {
        db.setSysConfig(`ast_return_to_${user.user_id}`, "");
        const { buildChannelAutoSellScreen, buildWalletAutoSellScreen, buildSniperAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(user.user_id);
        if (returnTo.startsWith("cch_autosell_")) {
          const chId = parseInt(returnTo.replace("cch_autosell_", ""));
          const ch = db.getCopyChannel(chId, user.user_id);
          if (ch) {
            try { await ctx.editMessageText(`📡 *${ch.channel_name || ch.channel_id} — Auto Sell*\n\nSelect a template.`, { parse_mode: "Markdown", reply_markup: buildChannelAutoSellScreen(ch, templates) }); } catch {
              await ctx.reply(`📡 *${ch.channel_name || ch.channel_id} — Auto Sell*\n\nSelect a template.`, { parse_mode: "Markdown", reply_markup: buildChannelAutoSellScreen(ch, templates) });
            }
          }
        } else if (returnTo.startsWith("cw_autosell_")) {
          const cwId = parseInt(returnTo.replace("cw_autosell_", ""));
          const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(cwId, user.user_id);
          if (cw) {
            try { await ctx.editMessageText(`👛 *${cw.label || cw.wallet_address.slice(0,12)} — Auto Sell*\n\nSelect a template.`, { parse_mode: "Markdown", reply_markup: buildWalletAutoSellScreen(cw, templates) }); } catch {
              await ctx.reply(`👛 *${cw.label || cw.wallet_address.slice(0,12)} — Auto Sell*\n\nSelect a template.`, { parse_mode: "Markdown", reply_markup: buildWalletAutoSellScreen(cw, templates) });
            }
          }
        } else if (returnTo.startsWith("sniper_autosell_")) {
          const cfgId = parseInt(returnTo.replace("sniper_autosell_", ""));
          const cfg = db.getSniperConfig(cfgId, user.user_id);
          if (cfg) {
            try { await ctx.editMessageText(`🎯 *${cfg.label} — Auto Sell*\n\nSelect a template.`, { parse_mode: "Markdown", reply_markup: buildSniperAutoSellScreen(cfg, templates) }); } catch {
              await ctx.reply(`🎯 *${cfg.label} — Auto Sell*\n\nSelect a template.`, { parse_mode: "Markdown", reply_markup: buildSniperAutoSellScreen(cfg, templates) });
            }
          }
        } else if (returnTo === "msnipe_as_back") {
          const templates3 = db.getAutoSellTemplates(user.user_id);
          const tplId3 = parseInt(db.getSysConfig(`msnipe_tpl_${user.user_id}`) || "0");
          const asOn3 = db.getSysConfig(`msnipe_as_${user.user_id}`) === "1";
          const asKb4 = { inline_keyboard: [
            [{ text: asOn3 ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: "msnipe_as_toggle" }],
            [{ text: "━━━ Select Template ━━━", callback_data: "noop" }],
            ...(templates3.length ? templates3.map(t => ([{ text: `${tplId3 === t.id ? "✅" : "◻️"} ${t.name}`, callback_data: `msnipe_as_tpl_${t.id}` }])) : [[{ text: "No templates yet", callback_data: "noop" }]]),
            [{ text: "➕ New Template", callback_data: "msnipe_as_new" }],
            [{ text: "← Back", callback_data: "msnipe_as_back" }],
          ]};
          try { await ctx.editMessageText(`🔀 *Migration Sniper — Auto Sell*\n\nSelect a template.`, { parse_mode: "Markdown", reply_markup: asKb4 }); }
          catch { await ctx.reply(`🔀 *Migration Sniper — Auto Sell*\n\nSelect a template.`, { parse_mode: "Markdown", reply_markup: asKb4 }); }
        }
        } else if (returnTo === "cw_setup_autosell_back") {
          const templates2 = db.getAutoSellTemplates(user.user_id);
          const tplId2 = parseInt(db.getSysConfig(`cw_pending_autosell_tpl_${user.user_id}`) || "0");
          const asOn2 = db.getSysConfig(`cw_pending_autosell_${user.user_id}`) === "1";
          const { buildChannelAutoSellScreen: bcas } = require("./keyboards");
          const fakeChannel2 = { id: "setup", auto_sell_enabled: asOn2 ? 1 : 0, auto_sell_template_id: tplId2, channel_name: "Copy Wallet Setup" };
          try { await ctx.editMessageText(
            `🤖 *Auto Sell — Copy Wallet Setup*\n\nSelect a template to use for this wallet.`,
            { parse_mode: "Markdown", reply_markup: bcas(fakeChannel2, templates2) }
          ); } catch {
            await ctx.reply(
              `🤖 *Auto Sell — Copy Wallet Setup*\n\nSelect a template to use for this wallet.`,
              { parse_mode: "Markdown", reply_markup: bcas(fakeChannel2, templates2) }
            );
          }
        } else {
          // Default — go to settings auto sell
          const { buildAutoSellListScreen } = require("./keyboards");
          const s = db.getSettings(user.user_id);
          try { await ctx.editMessageText(`🤖 *Auto Sell Templates*`, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(db.getAutoSellTemplates(user.user_id), s.auto_sell_template_id, s.auto_sell_enabled) }); } catch {
            await ctx.reply(`🤖 *Auto Sell Templates*`, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(db.getAutoSellTemplates(user.user_id), s.auto_sell_template_id, s.auto_sell_enabled) });
          }
        }
      } else {
        // No return — go to settings auto sell
        const { buildAutoSellListScreen } = require("./keyboards");
        const s = db.getSettings(user.user_id);
        try { await ctx.editMessageText(`🤖 *Auto Sell Templates*`, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(db.getAutoSellTemplates(user.user_id), s.auto_sell_template_id, s.auto_sell_enabled) }); } catch {
          await ctx.reply(`🤖 *Auto Sell Templates*`, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(db.getAutoSellTemplates(user.user_id), s.auto_sell_template_id, s.auto_sell_enabled) });
  }
    return;
  }
  if (action.startsWith("ast_view_")) {
      const id = parseInt(action.replace("ast_view_", ""));
      const t  = db.getAutoSellTemplate(user.user_id, id);
      if (!t) { await ctx.answerCallbackQuery("Not found."); return; }
      await ctx.answerCallbackQuery();
      const { buildAutoSellTemplateScreen } = require("./keyboards");
      const msg =
        `🤖 *${t.name}*\n\n` +
        `━━━ 📚 HOW TO USE ━━━\n` +
        `🛑 SL = sells if price drops\n` +
        `🎯 TP = sells if price rises\n` +
        `📍 = fixed price level\n` +
        `🔄 Trail = follows price up\n` +
        `Sell% = % of remaining tokens\n\n` +
        `SL1 active from start\n` +
        `SL2 activates when TP1 hits\n` +
        `SL3 activates when TP2 hits\n\n` +
        `Tap any button to change instantly\n` +
        `━━━━━━━━━━━━━━━━━━━`;
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (msgId) db.setSysConfig(`ast_msg_${user.user_id}`, String(msgId));
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) }); }
      catch { 
        const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) });
        db.setSysConfig(`ast_msg_${user.user_id}`, String(sent.message_id));
      }
      return;
    }
    if (action === "ast_new") {
      await ctx.answerCallbackQuery();
      const newId = db.createAutoSellTemplate(user.user_id, "New Template");
      const t = db.getAutoSellTemplate(user.user_id, newId);
      const { buildAutoSellTemplateScreen } = require("./keyboards");
      const msg =
        `🤖 *${t.name}*\n\n` +
        `━━━ 📚 HOW TO USE ━━━\n` +
        `🛑 SL = sells if price drops\n` +
        `🎯 TP = sells if price rises\n` +
        `📍 = fixed price level\n` +
        `🔄 Trail = follows price up\n` +
        `Sell% = % of remaining tokens\n\n` +
        `SL1 active from start\n` +
        `SL2 activates when TP1 hits\n` +
        `SL3 activates when TP2 hits\n\n` +
        `Tap any button to change instantly\n` +
        `━━━━━━━━━━━━━━━━━━━`;
      const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) });
      db.setSysConfig(`ast_msg_${user.user_id}`, String(sent.message_id));
      return;
    }

    if (action.startsWith("ast_toggle_")) {
    const id = parseInt(action.replace("ast_toggle_", ""));
    const t  = db.getAutoSellTemplate(user.user_id, id);
    if (!t) { await ctx.answerCallbackQuery("Not found."); return; }
    db.updateAutoSellTemplate(user.user_id, id, { active: t.active ? 0 : 1 });
    await ctx.answerCallbackQuery(t.active ? "⏸ Paused" : "✅ Activated");
    const { buildAutoSellTemplateScreen } = require("./keyboards");
    const updated = db.getAutoSellTemplate(user.user_id, id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildAutoSellTemplateScreen(updated) }); } catch {}
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

  if (action.startsWith("ast_delete_") || action?.startsWith("ast_delete_")) {
    const id = parseInt(action.replace("ast_delete_", ""));
    db.deleteAutoSellTemplate(user.user_id, id);
    await ctx.answerCallbackQuery("🗑 Deleted.");
    const { buildAutoSellListScreen } = require("./keyboards");
    const templates = db.getAutoSellTemplates(user.user_id);
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildAutoSellListScreen(templates, null, null) }); } catch {}
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
      const { buildAutoSellTemplateScreen } = require("./keyboards");
      const updated = db.getAutoSellTemplate(user.user_id, id);
      const msg = `🤖 *${updated.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(updated) }); } catch {}
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
      const { buildAutoSellTemplateScreen } = require("./keyboards");
      const updated = db.getAutoSellTemplate(user.user_id, id);
      const msg = `🤖 *${updated.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(updated) }); } catch {}
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
      if (action.startsWith("ast_select_")) {
        const id = parseInt(action.replace("ast_select_", ""));
        const s = db.getSettings(user.user_id);
        // Toggle — if already selected deselect it
        const newId = s?.auto_sell_template_id === id ? null : id;
        db.updateSettings(user.user_id, { auto_sell_template_id: newId });
        await ctx.answerCallbackQuery(newId ? "✅ Selected!" : "◻️ Deselected!");
        const { buildAutoSellListScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(user.user_id);
        const fresh2 = db.getSettings(user.user_id);
      const msg =
        `🤖 *Auto Sell Templates*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📚 *HOW IT WORKS:*\n` +
        `Create named templates with SL & TP.\n` +
        `Each template works separately.\n` +
        `Assign any template to any channel,\n` +
        `wallet or sniper independently.\n` +
        `━━━━━━━━━━━━━━━━━━━`;
    try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, fresh2.auto_sell_template_id, fresh2.auto_sell_enabled) }); }
      catch (e) {
        if (e?.description?.includes("not modified")) return;
        await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellListScreen(templates, fresh2.auto_sell_template_id, fresh2.auto_sell_enabled) });
      }
      return;
    }

      if (action.startsWith("ast_save_") || action?.startsWith("ast_save_")) {
    const id = parseInt(action.replace("ast_save_", ""));
    await ctx.answerCallbackQuery("✅ Template saved!");
    return;
  }
      if (action === "sas_toggle") {
        const s = db.getSettings(user.user_id);
        const v = s?.auto_sell_enabled ? 0 : 1;
        db.updateSettings(user.user_id, { auto_sell_enabled: v });
        await ctx.answerCallbackQuery(v ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌");
        const { buildAutoSellListScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(user.user_id);
        const fresh = db.getSettings(user.user_id);
        try { await ctx.editMessageReplyMarkup({ reply_markup: buildAutoSellListScreen(templates, fresh.auto_sell_template_id, fresh.auto_sell_enabled) }); } catch {}
        return;
      }

      if (action === "pset_autosell_manual" || action.startsWith("sas_use_")) {
      const { buildSettingsAutoSellScreen } = require("./keyboards");
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
  if (action === "pset_autobuy_screen" || action === "ab_toggle" || action === "ab_mev") {
    const s = db.getSettings(user.user_id);
    if (action === "ab_toggle") {
      const v = s?.auto_buy_enabled ? 0 : 1;
      db.updateSettings(user.user_id, { auto_buy_enabled: v });
      await ctx.answerCallbackQuery(v ? "🤖 Auto Buy: ON ✅" : "🤖 Auto Buy: OFF ◻️");
    } else if (action === "ab_mev") {
      const v = s?.auto_buy_mev ? 0 : 1;
      db.updateSettings(user.user_id, { auto_buy_mev: v });
      await ctx.answerCallbackQuery(v ? "🛡 MEV: ON" : "🛡 MEV: OFF");
    } else {
      await ctx.answerCallbackQuery();
    }
    const fresh = db.getSettings(user.user_id);
    const { buildAutoBuyScreen } = require("./keyboards");
    const msg =
      `🤖 *Auto Buy*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📚 *HOW IT WORKS:*\n` +
      `When ON — any CA you paste in chat\n` +
      `auto-buys instantly with your settings.\n` +
      `No confirm screen needed.\n` +
      `━━━━━━━━━━━━━━━━━━━`;
    try { 
        await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: buildAutoBuyScreen(fresh) });
        const msgId = ctx.callbackQuery?.message?.message_id;
        if (msgId) db.setSysConfig(`autobuy_msg_${user.user_id}`, String(msgId));
      }
      catch (e) {
        if (e?.description?.includes("not modified")) return;
        const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoBuyScreen(fresh) });
        db.setSysConfig(`autobuy_msg_${user.user_id}`, String(sent.message_id));
      }
      return;
    }

    if (action === "ab_amount") {
      await ctx.answerCallbackQuery();
      const promptId = await sendPrompt(ctx, "🤖 *Auto Buy Amount*\n\nEnter SOL per auto buy (e.g. 0.1):");
      db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
      db.setSysConfig(`pending_${user.user_id}`, "ab_set_amount");
      
      return;
    }

  if (action === "ab_slippage") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "📉 *Auto Buy Slippage*\n\nEnter % (e.g. 10):");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "ab_set_slippage");
    return;
  }

  if (action === "ab_gas") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "⛽ *Auto Buy Gas*\n\nEnter SOL gas fee (e.g. 0.005):");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "ab_set_gas");
    return;
  }

  if (action === "ab_max") {
    await ctx.answerCallbackQuery();
    const promptId = await sendPrompt(ctx, "🔢 *Max Buys Per Token*\n\nEnter max times to auto-buy same token (e.g. 1):");
    db.setSysConfig(`prompt_msg_${user.user_id}`, String(promptId));
    db.setSysConfig(`pending_${user.user_id}`, "ab_set_max");
    return;
  }

    if (action === "ab_mev") {
    const s = db.getSettings(user.user_id);
    const v = s?.auto_buy_enabled ? 0 : 1;
    db.updateSettings(user.user_id, { auto_buy_enabled: v });
    await ctx.answerCallbackQuery(v ? "🤖 Auto Buy: ON ✅" : "🤖 Auto Buy: OFF ◻️");
    const { buildAutoBuyScreen } = require("./keyboards");
    try { await ctx.editMessageReplyMarkup({ reply_markup: buildAutoBuyScreen(db.getSettings(user.user_id)) }); } catch {}
    return;
  }
  if (action === "pset_execution") {
    await ctx.answerCallbackQuery();
    const s = db.getSettings(user.user_id);
    try { await ctx.editMessageText("⚡ *Execution Settings*", { parse_mode: "Markdown", reply_markup: buildExecutionSettingsMenu(s) }); }
    catch { await ctx.reply("⚡ *Execution Settings*", { parse_mode: "Markdown", reply_markup: buildExecutionSettingsMenu(s) }); }
    return;
  }

  if (action === "pset_mev") {
    await ctx.answerCallbackQuery();
    const s = db.getSettings(user.user_id);
    try { await ctx.editMessageText("🛡 *MEV & Protection*", { parse_mode: "Markdown", reply_markup: buildMevSettingsMenu(s) }); }
    catch { await ctx.reply("🛡 *MEV & Protection*", { parse_mode: "Markdown", reply_markup: buildMevSettingsMenu(s) }); }
    return;
  }

  if (action === "pset_risk") {
    await ctx.answerCallbackQuery();
    const s = db.getSettings(user.user_id);
    try { await ctx.editMessageText("🔒 *Risk Controls*", { parse_mode: "Markdown", reply_markup: buildRiskSettingsMenu(s) }); }
    catch { await ctx.reply("🔒 *Risk Controls*", { parse_mode: "Markdown", reply_markup: buildRiskSettingsMenu(s) }); }
    return;
  }

  if (action === "pset_alerts") {
    await ctx.answerCallbackQuery();
    try { await ctx.editMessageText("🔔 *Alerts & Notifications*", { parse_mode: "Markdown", reply_markup: buildAlertsSettingsMenu() }); }
    catch { await ctx.reply("🔔 *Alerts & Notifications*", { parse_mode: "Markdown", reply_markup: buildAlertsSettingsMenu() }); }
    return;
  }

  await ctx.answerCallbackQuery("Unknown setting.");
}

// ── Text input handler ────────────────────────────────────────
async function handleTextInput(ctx, user, pendingKey) {
  const text     = ctx.message.text.trim();
  const userId   = user.user_id;
  const promptId = parseInt(db.getSysConfig(`prompt_msg_${userId}`) || "0");

  // Auto-delete prompt message and user's reply
  await deleteMsg(ctx, promptId);
  db.setSysConfig(`prompt_msg_${userId}`, "");

  const userMsgId = ctx.message.message_id;

  if (text.toLowerCase() === "none") {
    db.setSysConfig(`pending_${userId}`, "");
    try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
    return;
  }

  let handled = true;

  switch (pendingKey) {
    case "ast_set_name": {
      if (text.length < 1) { await ctx.reply("❌ Enter a name."); handled = false; break; }
      const editId = parseInt(db.getSysConfig(`ast_edit_id_${userId}`) || "0");
      const { buildAutoSellTemplateScreen } = require("./keyboards");
      if (editId) {
        db.updateAutoSellTemplate(userId, editId, { name: text });
        const t = db.getAutoSellTemplate(userId, editId);
        db.setSysConfig(`ast_edit_id_${userId}`, "");
        const tplMsgId = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
        const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
        try {
          if (tplMsgId) await ctx.api.editMessageText(ctx.chat.id, tplMsgId, msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) });
          else { const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
        } catch { const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      } else {
        const newId = db.createAutoSellTemplate(userId, text);
        const t = db.getAutoSellTemplate(userId, newId);
        db.setSysConfig(`ast_edit_id_${userId}`, "");
        const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
        const tplMsgId = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
        try {
          if (tplMsgId) await ctx.api.editMessageText(ctx.chat.id, tplMsgId, msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) });
          else { const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
        } catch { const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      }
      db.setSysConfig(`pending_${userId}`, "");
        try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
        // Return to source screen
        const returnTo = db.getSysConfig(`ast_return_to_${userId}`) || "";
        if (returnTo) {
          db.setSysConfig(`ast_return_to_${userId}`, "");
          // Send return callback
          try {
            const { buildChannelAutoSellScreen } = require("./keyboards");
            const { buildWalletAutoSellScreen } = require("./keyboards");
            const { buildSniperAutoSellScreen } = require("./keyboards");
            if (returnTo.startsWith("cch_autosell_")) {
              const chId = parseInt(returnTo.replace("cch_autosell_", ""));
              const ch = db.getCopyChannel(chId, userId);
              const templates = db.getAutoSellTemplates(userId);
              if (ch) await ctx.reply(
                `📡 *${ch.channel_name || ch.channel_id} — Auto Sell*\n\nSelect a template for this channel.`,
                { parse_mode: "Markdown", reply_markup: buildChannelAutoSellScreen(ch, templates) }
              );
            } else if (returnTo.startsWith("cw_autosell_")) {
              const cwId = parseInt(returnTo.replace("cw_autosell_", ""));
              const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(cwId, userId);
              const templates = db.getAutoSellTemplates(userId);
              if (cw) await ctx.reply(
                `👛 *${cw.label || cw.wallet_address.slice(0,12)} — Auto Sell*\n\nSelect a template for this wallet.`,
                { parse_mode: "Markdown", reply_markup: buildWalletAutoSellScreen(cw, templates) }
              );
            } else if (returnTo.startsWith("sniper_autosell_")) {
              const cfgId = parseInt(returnTo.replace("sniper_autosell_", ""));
              const cfg = db.getSniperConfig(cfgId, userId);
              const templates = db.getAutoSellTemplates(userId);
              if (cfg) await ctx.reply(
                `🎯 *${cfg.label} — Auto Sell*\n\nSelect a template for this sniper setup.`,
                { parse_mode: "Markdown", reply_markup: buildSniperAutoSellScreen(cfg, templates) }
              );
            }
          } catch {}
        }
        return;
      }
      case "ast_set_sl": {
      const v = parseFloat(text);
      if (isNaN(v) || v > 0) { await ctx.reply("❌ Enter negative % (e.g. -25) or 0."); handled = false; break; }
      const id    = parseInt(db.getSysConfig(`ast_edit_id_${userId}`) || "0");
      const field = db.getSysConfig(`ast_edit_field_${userId}`) || "sl_1";
      db.updateAutoSellTemplate(userId, id, { [field]: v });
      db.setSysConfig(`ast_edit_id_${userId}`, "");
      db.setSysConfig(`ast_edit_field_${userId}`, "");
      const t = db.getAutoSellTemplate(userId, id);
      const { buildAutoSellTemplateScreen } = require("./keyboards");
      const tplMsgId = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
      const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
      try {
        if (tplMsgId) await ctx.api.editMessageText(ctx.chat.id, tplMsgId, msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) });
        else { const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      } catch { const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      db.setSysConfig(`pending_${userId}`, "");
      try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
      return;
    }
    case "ast_set_sl_pct": {
      const v = parseFloat(text);
      if (isNaN(v) || v <= 0 || v > 100) { await ctx.reply("❌ Enter 1–100."); handled = false; break; }
      const id    = parseInt(db.getSysConfig(`ast_edit_id_${userId}`) || "0");
      const field = db.getSysConfig(`ast_edit_field_${userId}`) || "sl_1_sell_pct";
      db.updateAutoSellTemplate(userId, id, { [field]: v });
      db.setSysConfig(`ast_edit_id_${userId}`, "");
      db.setSysConfig(`ast_edit_field_${userId}`, "");
      const t = db.getAutoSellTemplate(userId, id);
      const { buildAutoSellTemplateScreen: bats2 } = require("./keyboards");
      const tplMsgId2 = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
      const msg2 = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
      try {
        if (tplMsgId2) await ctx.api.editMessageText(ctx.chat.id, tplMsgId2, msg2, { parse_mode: "Markdown", reply_markup: bats2(t) });
        else { const s = await ctx.reply(msg2, { parse_mode: "Markdown", reply_markup: bats2(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      } catch { const s = await ctx.reply(msg2, { parse_mode: "Markdown", reply_markup: bats2(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      db.setSysConfig(`pending_${userId}`, "");
      try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
      return;
    }
    case "ast_set_tp": {
      const v = parseFloat(text);
      if (isNaN(v) || v < 0) { await ctx.reply("❌ Enter positive % (e.g. 100) or 0."); handled = false; break; }
      const id    = parseInt(db.getSysConfig(`ast_edit_id_${userId}`) || "0");
      const field = db.getSysConfig(`ast_edit_field_${userId}`) || "tp_1";
      db.updateAutoSellTemplate(userId, id, { [field]: v });
      db.setSysConfig(`ast_edit_id_${userId}`, "");
      db.setSysConfig(`ast_edit_field_${userId}`, "");
      const t = db.getAutoSellTemplate(userId, id);
      const { buildAutoSellTemplateScreen: bats3 } = require("./keyboards");
      const tplMsgId3 = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
      const msg3 = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
      try {
        if (tplMsgId3) await ctx.api.editMessageText(ctx.chat.id, tplMsgId3, msg3, { parse_mode: "Markdown", reply_markup: bats3(t) });
        else { const s = await ctx.reply(msg3, { parse_mode: "Markdown", reply_markup: bats3(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      } catch { const s = await ctx.reply(msg3, { parse_mode: "Markdown", reply_markup: bats3(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      db.setSysConfig(`pending_${userId}`, "");
      try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
      return;
    }
    case "ast_set_tp_pct": {
      const v = parseFloat(text);
      if (isNaN(v) || v <= 0 || v > 100) { await ctx.reply("❌ Enter 1–100."); handled = false; break; }
      const id    = parseInt(db.getSysConfig(`ast_edit_id_${userId}`) || "0");
      const field = db.getSysConfig(`ast_edit_field_${userId}`) || "tp_1_pct";
      db.updateAutoSellTemplate(userId, id, { [field]: v });
      db.setSysConfig(`ast_edit_id_${userId}`, "");
      db.setSysConfig(`ast_edit_field_${userId}`, "");
      const t = db.getAutoSellTemplate(userId, id);
      const { buildAutoSellTemplateScreen: bats4 } = require("./keyboards");
      const tplMsgId4 = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
      const msg4 = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
      try {
        if (tplMsgId4) await ctx.api.editMessageText(ctx.chat.id, tplMsgId4, msg4, { parse_mode: "Markdown", reply_markup: bats4(t) });
        else { const s = await ctx.reply(msg4, { parse_mode: "Markdown", reply_markup: bats4(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      } catch { const s = await ctx.reply(msg4, { parse_mode: "Markdown", reply_markup: bats4(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      db.setSysConfig(`pending_${userId}`, "");
      try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
      return;
    }
      case "ab_set_amount": {
        const v = parseFloat(text);
        if (isNaN(v) || v <= 0) { await ctx.reply("❌ Invalid amount."); handled = false; break; }
        db.updateSettings(userId, { auto_buy_sol: v });
        await ctx.reply(`✅ Amount set: *${v} SOL*`, { parse_mode: "Markdown" });
        break;
      }
      case "ab_set_slippage": {
        const v = parseFloat(text);
        if (isNaN(v) || v < 1 || v > 100) { await ctx.reply("❌ Enter 1–100."); handled = false; break; }
        db.updateSettings(userId, { auto_buy_slippage: v });
        await ctx.reply(`✅ Slippage set: *${v}%*`, { parse_mode: "Markdown" });
        break;
      }
      case "ab_set_gas": {
        const v = parseFloat(text);
        if (isNaN(v) || v < 0) { await ctx.reply("❌ Invalid amount."); handled = false; break; }
        db.updateSettings(userId, { auto_buy_gas: v });
        await ctx.reply(`✅ Gas set: *${v} SOL*`, { parse_mode: "Markdown" });
        break;
      }
      case "ab_set_max": {
        const v = parseInt(text);
        if (isNaN(v) || v < 1) { await ctx.reply("❌ Enter 1 or more."); handled = false; break; }
        db.updateSettings(userId, { auto_buy_max: v });
        await ctx.reply(`✅ Max buys set: *${v}*`, { parse_mode: "Markdown" });
        break;
      }
    case "set_slippage": {
      const v = parseFloat(text);
      if (isNaN(v) || v < 1 || v > 50) {
        await ctx.reply("❌ Enter 1–50."); handled = false; break;
      }
      db.updateSettings(userId, { slippage_pct: v });
      await ctx.reply(`✅ Buy slippage: *${v}%*`, { parse_mode: "Markdown" });
      break;
    }
    case "set_sell_slippage": {
      const v = parseFloat(text);
      if (isNaN(v) || v < 1 || v > 50) {
        await ctx.reply("❌ Enter 1–50."); handled = false; break;
      }
      db.updateSettings(userId, { sell_slippage_pct: v });
      await ctx.reply(`✅ Sell slippage: *${v}%*`, { parse_mode: "Markdown" });
      break;
    }
    case "set_stoploss": {
      const v = parseFloat(text);
      if (isNaN(v) || v > 0) {
        await ctx.reply("❌ Enter negative number (e.g. -25) or 0 to disable."); handled = false; break;
      }
      db.updateSettings(userId, { stop_loss_pct: v });
      await ctx.reply(v === 0 ? "✅ Stop Loss *disabled*." : `✅ Stop Loss: *${v}%*`, { parse_mode: "Markdown" });
      break;
    }
    case "set_takeprofit": {
      const v = parseFloat(text);
      if (isNaN(v) || v < 0) {
        await ctx.reply("❌ Enter positive number (e.g. 100) or 0 to disable."); handled = false; break;
      }
      db.updateSettings(userId, { take_profit_pct: v });
      await ctx.reply(v === 0 ? "✅ Take Profit *disabled*." : `✅ Take Profit: *${v}%*`, { parse_mode: "Markdown" });
      break;
    }
    case "set_maxbuy": {
      const v = parseFloat(text);
      if (isNaN(v) || v <= 0) { await ctx.reply("❌ Invalid amount."); handled = false; break; }
      db.updateSettings(userId, { max_buy_sol: v });
      await ctx.reply(`✅ Max buy: *${v} SOL*`, { parse_mode: "Markdown" });
      break;
    }
    case "set_session": {
      const v = parseInt(text);
      if (isNaN(v) || v < 0 || v > 24) { await ctx.reply("❌ Enter 1–24 or 0 to disable."); handled = false; break; }
      db.updateUser(userId, { session_timeout_sec: v * 3600 });
      await ctx.reply(v === 0 ? "✅ Session timeout *disabled*." : `✅ Session timeout: *${v} hour(s)*`, { parse_mode: "Markdown" });
      break;
    }
    case "set_jito": {
      const v = parseFloat(text);
      if (isNaN(v) || v < 0) { await ctx.reply("❌ Invalid amount."); handled = false; break; }
      db.updateSettings(userId, { jito_tip: v });
      await ctx.reply(`✅ Jito Tip: *${v} SOL*`, { parse_mode: "Markdown" });
      break;
    }
    case "set_custom_speed": {
      const v = parseFloat(text);
      if (isNaN(v) || v < 0) { await ctx.reply("❌ Invalid SOL amount."); handled = false; break; }
      db.updateSettings(userId, { speed_mode: "custom", custom_fee: v });
      await ctx.reply(`✅ *Custom Fee Active: ${v} SOL per trade*\n\nThis will be used as priority fee for all trades.`, { parse_mode: "Markdown" });
      break;
    }
    case "set_buy_amt_1": case "set_buy_amt_2": case "set_buy_amt_3": {
      const n = parseInt(pendingKey.slice(-1));
      const v = parseFloat(text);
      if (isNaN(v) || v <= 0) { await ctx.reply("❌ Invalid amount."); handled = false; break; }
      db.updateSettings(userId, { [`buy_amt_${n}`]: v });
      await ctx.reply(`✅ Buy Amount ${n}: *${v} SOL*`, { parse_mode: "Markdown" });
      break;
    }
    case "set_sell_pct_1": case "set_sell_pct_2": case "set_sell_pct_3": {
      const n = parseInt(pendingKey.slice(-1));
      const v = parseFloat(text);
      if (isNaN(v) || v <= 0 || v > 100) { await ctx.reply("❌ Enter 1–100."); handled = false; break; }
      db.updateSettings(userId, { [`sell_pct_${n}`]: v });
      await ctx.reply(`✅ Sell ${n}: *${v}%*`, { parse_mode: "Markdown" });
      break;
    }
      case "sap_set_new": {
            if (text.length < 6 || text.length > 34) {
              await ctx.reply("❌ PIN must be 6–34 characters."); handled = false; break;
            }
            const hash = await bcrypt.hash(text, 10);
            db.setSapHash(userId, hash);
            await ctx.reply(
              "✅ *Security PIN set!*\n\n" +
              "Required before: withdrawing, exporting key, wallet switch.\n" +
              "⚠️ *Save it — cannot be recovered.*",
              { parse_mode: "Markdown" }
            );
            break;
          }
            case "sap_verify_remove": {
              const freshUser = db.getUser(userId);
              const valid = freshUser.sap_hash ? await bcrypt.compare(text, freshUser.sap_hash) : false;
              if (!valid) {
                await ctx.reply("❌ *Incorrect PIN.* Removal cancelled.", { parse_mode: "Markdown" });
                break;
              }
              db.clearSap(userId);
              await ctx.reply("✅ *Security PIN removed.*", { parse_mode: "Markdown" });
              break;
            }
          case "sap_verify_change": {
            const freshUser = db.getUser(userId);
            const valid = freshUser.sap_hash ? await bcrypt.compare(text, freshUser.sap_hash) : false;
            if (!valid) {
              try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
              await ctx.reply(
                "❌ *Incorrect PIN.*\n\nThe PIN you entered is wrong. Please try again.\n\nType your current PIN:",
                { parse_mode: "Markdown" }
              );
              db.setSysConfig(`pending_${userId}`, "sap_verify_change");
              handled = false;
              break;
            }
            const promptId2 = await sendPrompt(ctx, "✅ *PIN verified.*\n\nNow enter your *new* PIN (6–34 characters):", );
            db.setSysConfig(`prompt_msg_${userId}`, String(promptId2));
            db.setSysConfig(`pending_${userId}`, "sap_set_new");
            try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
            return;
          }
          case "sap_verify_export": {
            const freshUser = db.getUser(userId);
            const valid = freshUser.sap_hash ? await bcrypt.compare(text, freshUser.sap_hash) : true;
            if (!valid) { await ctx.reply("❌ Incorrect PIN. Export cancelled."); break; }
            const walletId = parseInt(db.getSysConfig(`sap_next_wallet_${userId}`) || "0");
            db.setSysConfig(`pending_${userId}`, "");
            if (walletId) await doExportKey(ctx, userId, walletId);
            try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
            return;
          }
          default:
            await ctx.reply("❓ Unknown input. Tap /start to go back.");
        }

        if (handled) {
          db.setSysConfig(`pending_${userId}`, "");
          try { await ctx.api.deleteMessage(ctx.chat.id, userMsgId); } catch {}
          const abKeys = ["ab_set_amount","ab_set_slippage","ab_set_gas","ab_set_max"];
        if (abKeys.includes(pendingKey)) {
          const { buildAutoBuyScreen } = require("./keyboards");
          const fresh = db.getSettings(userId);
          const msg = `🤖 *Auto Buy*\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `📚 *HOW IT WORKS:*\n` +
            `When ON — any CA you paste in chat\n` +
            `auto-buys instantly with your settings.\n` +
            `No confirm screen needed.\n` +
            `━━━━━━━━━━━━━━━━━━━`;
          const promptMsgId = parseInt(db.getSysConfig(`prompt_msg_${userId}`) || "0");
          try { await ctx.api.deleteMessage(ctx.chat.id, promptMsgId); } catch {}
          try {
            const autoBuyMsgId = parseInt(db.getSysConfig(`autobuy_msg_${userId}`) || "0");
            if (autoBuyMsgId) {
              await ctx.api.editMessageText(ctx.chat.id, autoBuyMsgId, msg, { parse_mode: "Markdown", reply_markup: buildAutoBuyScreen(fresh) });
            } else {
              const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoBuyScreen(fresh) });
              db.setSysConfig(`autobuy_msg_${userId}`, String(sent.message_id));
            }
          } catch {
            const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoBuyScreen(fresh) });
            db.setSysConfig(`autobuy_msg_${userId}`, String(sent.message_id));
          }
          }
          }
          }
      // ── Export key helper ─────────────────────────────────────────
      async function doExportKey(ctx, userId, walletId) {
        try {
          const { decryptWallet } = require("./walletVault");
          const bs58    = require("bs58");
          const keypair = decryptWallet(walletId);
          const privKey = bs58.encode(keypair.secretKey);
          const wallet  = db.getWallet(walletId);

          const msg = await ctx.reply(
            `🔑 *Private Key* — ${wallet?.label || "Wallet"}\n\n\`${privKey}\`\n\n` +
            `⚠️ *KEEP THIS SECRET*\n` +
            `• Never share with anyone\n` +
            `• This message deletes in *20 seconds*\n` +
            `• Save it now`,
            { parse_mode: "Markdown" }
          );

          setTimeout(async () => {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, msg.message_id);
              await ctx.reply("🔑 Private key deleted for your security.");
            } catch {}
          }, 20000);
        } catch {
          await ctx.reply("❌ Could not export key.");
        }
      }

        module.exports = { showSettings, handleSettingCallback, handleTextInput, doExportKey };
