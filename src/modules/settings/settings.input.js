const db = require("../../../database");
const bcrypt = require("bcryptjs");
const { buildProSettingsMenu, buildBeginnerSettingsMenu, buildAutoSellTemplateScreen, buildSniperConfigMenu, buildMigrationSniperMenu, buildRealtimeSnipeMenu, buildExecutionSettingsMenu, buildRiskSettingsMenu } = require("../keyboards");
const { sendPrompt, deleteMsg, refreshSettings, showSettings } = require("./settings.helpers");

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
      const { buildAutoSellTemplateScreen } = require("../keyboards");
      if (editId) {
        db.updateAutoSellTemplate(userId, editId, { name: text });
        const t = db.getAutoSellTemplate(userId, editId);
        db.setSysConfig(`ast_edit_id_${userId}`, "");
        const tplMsgId = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
        const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
        try {
          if (tplMsgId) await ctx.api.editMessageText(ctx.chat.id, tplMsgId, msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) });
          else { const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
        } catch { const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) }); db.setSysConfig(`ast_msg_${userId}`, String(s.message_id)); }
      } else {
        const newId = db.createAutoSellTemplate(userId, text);
        const t = db.getAutoSellTemplate(userId, newId);
        db.setSysConfig(`ast_edit_id_${userId}`, "");
        const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
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
            const { buildChannelAutoSellScreen } = require("../keyboards");
            const { buildWalletAutoSellScreen } = require("../keyboards");
            const { buildSniperAutoSellScreen } = require("../keyboards");
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
      const { buildAutoSellTemplateScreen } = require("../keyboards");
      const tplMsgId = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
      const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
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
      const { buildAutoSellTemplateScreen: bats2 } = require("../keyboards");
      const tplMsgId2 = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
      const msg2 = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
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
      const { buildAutoSellTemplateScreen: bats3 } = require("../keyboards");
      const tplMsgId3 = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
      const msg3 = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
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
      const { buildAutoSellTemplateScreen: bats4 } = require("../keyboards");
      const tplMsgId4 = parseInt(db.getSysConfig(`ast_msg_${userId}`) || "0");
      const msg4 = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 *SL* = Stop Loss (sell if price drops)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n🎯 *TP* = Take Profit (sell if price rises)\n   📍 Fixed % | 🔄 Trail = follows price up\n   Sell% = how much to sell when triggered\n\n📌 *Order of triggers:*\n   SL1 → always watching from start\n   SL2 → activates after TP1 hits\n   SL3 → activates after TP2 hits\n\n💡 Set 0 = disabled\n✅ Save = confirms & saves template\n← Back = exits WITHOUT saving\n━━━━━━━━━━━━━━━━━━━`;
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
      db.setSysConfig(`refresh_to_${userId}`, "pset_execution");
      break;
    }
    case "set_sell_slippage": {
      const v = parseFloat(text);
      if (isNaN(v) || v < 1 || v > 50) {
        await ctx.reply("❌ Enter 1–50."); handled = false; break;
      }
      db.updateSettings(userId, { sell_slippage_pct: v });
      await ctx.reply(`✅ Sell slippage: *${v}%*`, { parse_mode: "Markdown" });
      db.setSysConfig(`refresh_to_${userId}`, "pset_execution");
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
      db.setSysConfig(`refresh_to_${userId}`, "pset_execution");
      break;
    }
    case "set_custom_speed": {
      const v = parseFloat(text);
      if (isNaN(v) || v < 0) { await ctx.reply("❌ Invalid SOL amount."); handled = false; break; }
      db.updateSettings(userId, { speed_mode: "custom", custom_fee: v });
      await ctx.reply(`✅ *Custom Fee Active: ${v} SOL per trade*\n\nThis will be used as priority fee for all trades.`, { parse_mode: "Markdown" });
      break;
    }
    case "buy_custom_amount": {
      const v = parseFloat(text);
      if (isNaN(v) || v <= 0) { await ctx.reply("❌ Invalid amount."); handled = false; break; }
      db.setSysConfig(`custom_buy_amt_${userId}`, String(v));
      await ctx.reply(`✅ Custom buy: *${v} SOL*`, { parse_mode: "Markdown" });
      break;
    }
    case "set_buy_amt_1": case "set_buy_amt_2": case "set_buy_amt_3": {
      const n = parseInt(pendingKey.slice(-1));
      const v = parseFloat(text);
      if (isNaN(v) || v <= 0) { await ctx.reply("❌ Invalid amount."); handled = false; break; }
      db.updateSettings(userId, { [`buy_amt_${n}`]: v });
      await ctx.reply(`✅ Buy Amount ${n}: *${v} SOL*`, { parse_mode: "Markdown" });
      db.setSysConfig(`refresh_to_${userId}`, "pset_execution");
      break;
    }
    case "set_sell_pct_1": case "set_sell_pct_2": case "set_sell_pct_3": {
      const n = parseInt(pendingKey.slice(-1));
      const v = parseFloat(text);
      if (isNaN(v) || v <= 0 || v > 100) { await ctx.reply("❌ Enter 1–100."); handled = false; break; }
      db.updateSettings(userId, { [`sell_pct_${n}`]: v });
      await ctx.reply(`✅ Sell ${n}: *${v}%*`, { parse_mode: "Markdown" });
      db.setSysConfig(`refresh_to_${userId}`, "pset_execution");
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

          // Refresh execution screen for execution-related settings
          const execKeys = ["set_slippage","set_sell_slippage","set_buy_amt_1","set_buy_amt_2","set_buy_amt_3","set_sell_pct_1","set_sell_pct_2","set_sell_pct_3","set_jito","set_custom_speed"];
          const riskKeys = ["set_stoploss","set_takeprofit","set_maxbuy"];
          if (execKeys.includes(pendingKey)) {
            const freshS = db.getSettings(userId);
            const execMsgId = parseInt(db.getSysConfig(`exec_msg_${userId}`) || "0");
            if (execMsgId) {
              try { await ctx.api.editMessageReplyMarkup(ctx.chat.id, execMsgId, { reply_markup: buildExecutionSettingsMenu(freshS) }); } catch {}
            }
          }
          if (riskKeys.includes(pendingKey)) {
            const freshS = db.getSettings(userId);
            const riskMsgId = parseInt(db.getSysConfig(`risk_msg_${userId}`) || "0");
            if (riskMsgId) {
              try { await ctx.api.editMessageReplyMarkup(ctx.chat.id, riskMsgId, { reply_markup: buildRiskSettingsMenu(freshS) }); } catch {}
            }
          }

          const abKeys = ["ab_set_amount","ab_set_slippage","ab_set_gas","ab_set_max"];
        if (abKeys.includes(pendingKey)) {
          const { buildAutoBuyScreen } = require("../keyboards");
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

        module.exports = { handleTextInput, doExportKey };
