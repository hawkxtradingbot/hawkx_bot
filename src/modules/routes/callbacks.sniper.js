const db = require("../../../database");
const { safeEdit, refreshMsnipeScreen } = require("./helpers.routes");
const { buildSniperMainMenu, buildAutoSniperMenu, buildSniperConfigMenu, buildMigrationSniperMenu, buildRealtimeSnipeMenu, getGuide } = require("../keyboards");
const { executeRealtimeSnipe } = require("../executor");

async function handleSniperCallbacks(ctx, data, userId, user, bot, ks) {
    // ── SNIPER ────────────────────────────────────────────────
    if (data === "menu_sniper") {
      await ctx.answerCallbackQuery();
      return safeEdit(
        ctx,
        `🎯 *Sniper*\n\n${getGuide("sniper")}`,
        buildSniperMainMenu(),
      );
    }

    if (data === "sniper_auto_menu") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`sniper_screen_${userId}`, "auto");
      const configs = db.getSniperConfigs(userId);
      const AUTO_GUIDE = "🎯 *Auto Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Create multiple setups with different settings\n▸ Each setup targets different platforms\n▸ Filters prevent sniping rugs\n▸ Auto sell templates apply per setup\n━━━━━━━━━━━━━━━━━━━";
      return safeEdit(ctx, AUTO_GUIDE, buildAutoSniperMenu(configs));
    }

    if (data === "sniper_config_new") {
      await ctx.answerCallbackQuery();
      const id = db.createSniperConfig(
        userId,
        `Setup ${db.getSniperConfigs(userId).length + 1}`,
        "auto",
      );
      const cfg = db.getSniperConfig(id, userId);
      return safeEdit(
        ctx,
        "🎯 *Auto Sniper Setup*\n\n━━━━━━━━━━━━━━━━━━━\n⚡ *Trade Settings*\n💰 Amount — SOL per snipe\n📉 Slippage — max price move %\n⛽ Fee — priority fee SOL\n🎯 Tip — Jito bundle tip\n🛡 MEV — sandwich protection\n━━━━━━━━━━━━━━━━━━━\n🔍 *Safety Filters*\n💧 Min Liq — min pool SOL\n🧢 Max MCap — max market cap\n👤 Dev% — max dev holdings\n✅ Mint Rev — mint authority off\n✅ Freeze Rev — freeze auth off\n━━━━━━━━━━━━━━━━━━━\n📦 *Platforms*\nRaydium | Pumpfun | Moonshot\n🦅 HawkX Launch\n━━━━━━━━━━━━━━━━━━━\n💾 *Auto-saves instantly* — no save button needed\n✏️ Rename | ✅ Activate | ⏸ Pause",
        buildSniperConfigMenu(cfg),
      );
    }

    if (data.startsWith("sniper_config_view_")) {
      const id = parseInt(data.replace("sniper_config_view_", ""));
      const cfg = db.getSniperConfig(id, userId);
      if (!cfg) {
        await ctx.answerCallbackQuery("Not found.");
        return true;
      }
      await ctx.answerCallbackQuery();
      await safeEdit(ctx, `🎯 *${cfg.label}*\n\n━━━━━━━━━━━━━━━━━━━\n⚡ *Trade Settings*\n💰 Amount — SOL per snipe\n📉 Slippage — max price move %\n⛽ Fee — priority fee SOL\n🎯 Tip — Jito bundle tip\n🛡 MEV — sandwich protection\n━━━━━━━━━━━━━━━━━━━\n🔍 *Safety Filters*\n💧 Min Liq — min pool SOL\n🧢 Max MCap — max market cap\n👤 Dev% — max dev holdings\n✅ Mint Rev — mint authority off\n✅ Freeze Rev — freeze auth off\n━━━━━━━━━━━━━━━━━━━\n📦 *Platforms*\nRaydium | Pumpfun | Moonshot\n🦅 HawkX Launch\n━━━━━━━━━━━━━━━━━━━\n💾 *Auto-saves instantly* — no save button needed\n✏️ Rename | ✅ Activate | ⏸ Pause`, buildSniperConfigMenu(cfg));
      db.setSysConfig(`scfg_msg_${userId}`, String(ctx.callbackQuery?.message?.message_id || 0));
      return true;
    }

    if (data.startsWith("sniper_config_save_")) {
      const id = parseInt(data.replace("sniper_config_save_", ""));
      db.updateSniperConfig(userId, id, { active: 1 });
      await ctx.answerCallbackQuery("✅ Activated!");
      const AUTO_GUIDE = "🎯 *Auto Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Create multiple setups with different settings\n▸ Each setup targets different platforms\n▸ Filters prevent sniping rugs\n▸ Auto sell templates apply per setup\n━━━━━━━━━━━━━━━━━━━";
      return safeEdit(ctx, AUTO_GUIDE, buildAutoSniperMenu(db.getSniperConfigs(userId)));
    }

    if (data.startsWith("sniper_config_toggle_")) {
      const id = parseInt(data.replace("sniper_config_toggle_", ""));
      const cfg = db.getSniperConfig(id, userId);
      if (!cfg) { await ctx.answerCallbackQuery("Not found."); return true; }
      const newActive = cfg.active ? 0 : 1;
      db.updateSniperConfig(userId, id, { active: newActive });
      await ctx.answerCallbackQuery(newActive ? "✅ Activated!" : "⏸ Paused!");
      const updated = db.getSniperConfig(id, userId);
      db.setSysConfig(`scfg_msg_${userId}`, String(ctx.callbackQuery?.message?.message_id || 0));
      return safeEdit(ctx, `🎯 *${updated.label}*

Edit your sniper setup:`, buildSniperConfigMenu(updated));
    }

    if (data.startsWith("scfg_rename_")) {
      const id = parseInt(data.replace("scfg_rename_", ""));
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("✏️ Enter new name for this setup:");
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, `scfg_set_label_${id}`);
      return true;
    }

    if (data.startsWith("sniper_config_delete_")) {
      const id = parseInt(data.replace("sniper_config_delete_", ""));
      db.deleteSniperConfig(userId, id);
      await ctx.answerCallbackQuery("🗑 Deleted.");
      const AUTO_GUIDE = "🎯 *Auto Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Create multiple setups with different settings\n▸ Each setup targets different platforms\n▸ Filters prevent sniping rugs\n▸ Auto sell templates apply per setup\n━━━━━━━━━━━━━━━━━━━";
      return safeEdit(ctx, AUTO_GUIDE, buildAutoSniperMenu(db.getSniperConfigs(userId)));
    }

    

        if (data === "sniper_migration_menu") {
      await ctx.answerCallbackQuery();
      const snipes = db.getActiveSnipes(userId);
      db.setSysConfig(`sniper_screen_${userId}`, "migration");
      const migGuide = "🔀 *Migration Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Auto-snipes tokens at ~68K MCap\n▸ Catches PumpFun → Raydium migrations\n▸ No CA needed — bot catches it live\n▸ Set amount, slippage & auto sell\n━━━━━━━━━━━━━━━━━━━";
      return safeEdit(ctx, migGuide, buildMigrationSniperMenu(snipes));
    }

    if (data === "sniper_migration_new") {
      await ctx.answerCallbackQuery();
      // Clear config for a FRESH setup (don't reuse last snipe's values)
      ["sol","label","slip","gas","mev","tpl","as","minliq","maxmcap","editing","msg"].forEach(k =>
        db.setSysConfig(`msnipe_${k}_${userId}`, "")
      );
      await refreshMsnipeScreen(ctx, userId);
      return true;
    }

    if (data.startsWith("msnipe_")) {
      if (data === "msnipe_set_sol") {
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("💰 Enter snipe amount in SOL (e.g. 0.5):");
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "msnipe_sol");
        return true;
      }
      if (data === "msnipe_set_slip") {
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("📉 Enter slippage % (e.g. 50):");
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "msnipe_slip");
        return true;
      }
      if (data === "msnipe_set_gas") {
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("⛽ Enter gas fee in SOL (e.g. 0.005):");
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "msnipe_gas");
        return true;
      }
      if (data === "msnipe_rename") {
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("✏️ Enter name for this migration snipe:");
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "msnipe_set_label");
        return true;
      }
      if (data === "msnipe_set_minliq") {
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("💧 Min Liquidity SOL (0=off, e.g. 5):");
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "msnipe_minliq");
        return true;
      }
      if (data === "msnipe_set_maxmcap") {
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("🧢 Max MCap USD (0=off, e.g. 500000 or 500K):");
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "msnipe_maxmcap");
        return true;
      }
      if (data === "msnipe_toggle_mev") {
        const mev = db.getSysConfig(`msnipe_mev_${userId}`) === "1";
        db.setSysConfig(`msnipe_mev_${userId}`, mev ? "0" : "1");
        await ctx.answerCallbackQuery(mev ? "🛡 MEV OFF" : "🛡 MEV ON ✅");
        await refreshMsnipeScreen(ctx, userId);
        return true;
      }
      if (data === "msnipe_open_as") {
        await ctx.answerCallbackQuery();
        const templates = db.getAutoSellTemplates(userId);
        const tplId = parseInt(db.getSysConfig(`msnipe_tpl_${userId}`) || "0");
        const asOn = db.getSysConfig(`msnipe_as_${userId}`) === "1";
        db.setSysConfig(`ast_return_to_${userId}`, "msnipe_open_as");
        const asKb = { inline_keyboard: [
          [{ text: asOn ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: "msnipe_as_toggle" }],
          [{ text: "━━━ Select Template ━━━", callback_data: "noop" }],
          ...(templates.length ? templates.map(t => ([{ text: `${tplId === t.id ? "✅" : "◻️"} ${t.name}`, callback_data: `msnipe_as_tpl_${t.id}` }])) : [[{ text: "No templates yet", callback_data: "noop" }]]),
          [{ text: "➕ New Template", callback_data: "msnipe_as_new" }],
          [{ text: "← Back", callback_data: "msnipe_as_back" }],
        ]};
      const curMsgMs = ctx.callbackQuery?.message?.message_id;
        if (curMsgMs) db.setSysConfig(`msnipe_msg_${userId}`, String(curMsgMs));
        try { await ctx.editMessageText(`🔀 *Migration Sniper — Auto Sell*\n\nSelect a template for migration snipes.`, { parse_mode: "Markdown", reply_markup: asKb }); }
        catch { const s = await ctx.reply(`🔀 *Migration Sniper — Auto Sell*\n\nSelect a template for migration snipes.`, { parse_mode: "Markdown", reply_markup: asKb }); db.setSysConfig(`msnipe_msg_${userId}`, String(s.message_id)); }
        return true;
      }
      if (data === "msnipe_as_toggle") {
        const asOn = db.getSysConfig(`msnipe_as_${userId}`) === "1";
        db.setSysConfig(`msnipe_as_${userId}`, asOn ? "0" : "1");
        await ctx.answerCallbackQuery(asOn ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅");
        const templates = db.getAutoSellTemplates(userId);
        const tplId = parseInt(db.getSysConfig(`msnipe_tpl_${userId}`) || "0");
        const newAsOn = !asOn;
        const asKb2 = { inline_keyboard: [
          [{ text: newAsOn ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: "msnipe_as_toggle" }],
          [{ text: "━━━ Select Template ━━━", callback_data: "noop" }],
          ...(templates.length ? templates.map(t => ([{ text: `${tplId === t.id ? "✅" : "◻️"} ${t.name}`, callback_data: `msnipe_as_tpl_${t.id}` }])) : [[{ text: "No templates yet", callback_data: "noop" }]]),
          [{ text: "➕ New Template", callback_data: "msnipe_as_new" }],
          [{ text: "← Back", callback_data: "msnipe_as_back" }],
        ]};
        try { await ctx.editMessageReplyMarkup({ reply_markup: asKb2 }); } catch {}
        return true;
      }
      if (data.startsWith("msnipe_as_tpl_")) {
        const tId = parseInt(data.replace("msnipe_as_tpl_", ""));
        const current = parseInt(db.getSysConfig(`msnipe_tpl_${userId}`) || "0");
        db.setSysConfig(`msnipe_tpl_${userId}`, String(current === tId ? 0 : tId));
        await ctx.answerCallbackQuery(current === tId ? "◻️ Deselected!" : "✅ Selected!");
        const templates = db.getAutoSellTemplates(userId);
        const newTplId = parseInt(db.getSysConfig(`msnipe_tpl_${userId}`) || "0");
        const asOn = db.getSysConfig(`msnipe_as_${userId}`) === "1";
        const asKb3 = { inline_keyboard: [
          [{ text: asOn ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: "msnipe_as_toggle" }],
          [{ text: "━━━ Select Template ━━━", callback_data: "noop" }],
          ...(templates.length ? templates.map(t => ([{ text: `${newTplId === t.id ? "✅" : "◻️"} ${t.name}`, callback_data: `msnipe_as_tpl_${t.id}` }])) : [[{ text: "No templates yet", callback_data: "noop" }]]),
          [{ text: "➕ New Template", callback_data: "msnipe_as_new" }],
          [{ text: "← Back", callback_data: "msnipe_as_back" }],
        ]};
        try { await ctx.editMessageText(`🔀 *Migration Sniper — Auto Sell*\n\nSelect a template for migration snipes.`, { parse_mode: "Markdown", reply_markup: asKb3 }); } catch {}
        return true;
      }
      if (data === "msnipe_as_new") {
        db.setSysConfig(`ast_return_to_${userId}`, "msnipe_open_as");
        await ctx.answerCallbackQuery();
        const newId = db.createAutoSellTemplate(userId, "New Template");
        db.setSysConfig(`ast_unsaved_${userId}`, String(newId));
        const t = db.getAutoSellTemplate(userId, newId);
        const { buildAutoSellTemplateScreen } = require("../keyboards");
        const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
        const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) });
        db.setSysConfig(`ast_msg_${userId}`, String(sent.message_id));
        return true;
      }
      if (data === "msnipe_as_back") {
        await ctx.answerCallbackQuery().catch(()=>{});
        await refreshMsnipeScreen(ctx, userId);
        return true;
      }
      if (data === "msnipe_confirm") {
        const sol = parseFloat(db.getSysConfig(`msnipe_sol_${userId}`) || "0.1");
        const slippage = parseFloat(db.getSysConfig(`msnipe_slip_${userId}`) || "50");
        const gas = parseFloat(db.getSysConfig(`msnipe_gas_${userId}`) || "0.005");
        const mev = db.getSysConfig(`msnipe_mev_${userId}`) === "1";
        const tplId = parseInt(db.getSysConfig(`msnipe_tpl_${userId}`) || "0");
        const asOn = db.getSysConfig(`msnipe_as_${userId}`) === "1";
        const msnipeLabel2 = db.getSysConfig(`msnipe_label_${userId}`) || null;
        db.addSnipe(userId, null, sol, slippage, null, { gas, mev, auto_sell_template_id: asOn ? tplId : null, label: msnipeLabel2 });
        await ctx.answerCallbackQuery("✅ Migration Snipe Armed!");
        const snipes = db.getActiveSnipes(userId);
        return safeEdit(ctx,
          `🔀 *Migration Sniper*\n\n${getGuide("sniper")}\n\nSnipes tokens migrating from PumpFun → Raydium at ~68K mcap.`,
          buildMigrationSniperMenu(snipes)
        );
      }
      await ctx.answerCallbackQuery();
      return true;
    }
    if (data.startsWith("sniper_autosell_")) {
      // Open auto sell screen
      if (
        !data.startsWith("sniper_autosell_toggle_") &&
        !data.startsWith("sniper_autosell_use_") &&
        !data.startsWith("sniper_autosell_new_")
      ) {
          const id = parseInt(data.replace("sniper_autosell_", ""));
          const cfg = db.getSniperConfig(id, userId);
          if (!cfg) {
            await ctx.answerCallbackQuery("Not found.");
          return true;
        }
        await ctx.answerCallbackQuery();
        const { buildSniperAutoSellScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try {
          await ctx.editMessageText(
            `🎯 *${cfg.label} — Auto Sell*\n\n` +
              `Select a template for this sniper setup.`,
            {
              parse_mode: "Markdown",
              reply_markup: buildSniperAutoSellScreen(cfg, templates),
            },
          );
        } catch {}
        return true;
      }

      // Toggle ON/OFF
      if (data.startsWith("sniper_autosell_toggle_")) {
        const id = parseInt(data.replace("sniper_autosell_toggle_", ""));
        const cfg = db.getSniperConfig(id, userId);
        if (!cfg) {
          await ctx.answerCallbackQuery("Not found.");
          return true;
        }
        db.updateSniperConfig(userId, id, {
          auto_sell_enabled: cfg.auto_sell_enabled ? 0 : 1,
        });
        await ctx.answerCallbackQuery(
          cfg.auto_sell_enabled ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅",
        );
        const { buildSniperAutoSellScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: buildSniperAutoSellScreen(
              db.getSniperConfig(id, userId),
              templates,
            ),
          });
        } catch {}
        return true;
      }

      // Select template
      if (data.startsWith("sniper_autosell_use_")) {
        const withoutPrefix = data.replace("sniper_autosell_use_", "");
        const lastIdx = withoutPrefix.lastIndexOf("_");
        const cfgId = parseInt(withoutPrefix.slice(0, lastIdx));
        const tId = parseInt(withoutPrefix.slice(lastIdx + 1));
        db.updateSniperConfig(userId, cfgId, { auto_sell_template_id: tId });
        await ctx.answerCallbackQuery("✅ Template selected!");
        const { buildSniperAutoSellScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: buildSniperAutoSellScreen(
              db.getSniperConfig(cfgId, userId),
              templates,
            ),
          });
        } catch {}
        return true;
      }

      // New template from sniper screen
      if (data.startsWith("sniper_autosell_new_")) {
        const id = parseInt(data.replace("sniper_autosell_new_", ""));
        db.setSysConfig(`ast_return_to_${userId}`, `sniper_autosell_${id}`);
        await ctx.answerCallbackQuery();
        const newId3 = db.createAutoSellTemplate(userId, "New Template");
        db.setSysConfig(`ast_unsaved_${userId}`, String(newId3));
        const t3 = db.getAutoSellTemplate(userId, newId3);
        const { buildAutoSellTemplateScreen: bats3 } = require("../keyboards");
        const msg3 =
          `🤖 *${t3.name}*\n\n` +
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
        const sent3 = await ctx.reply(msg3, { parse_mode: "Markdown", reply_markup: bats3(t3) });
        db.setSysConfig(`ast_msg_${userId}`, String(sent3.message_id));
        return true;
      }

      await ctx.answerCallbackQuery();
      return true;
    }
    if (data === "auto_pause_all") {
      const allConfigs = db.getSniperConfigs(userId);
      const anyActive2 = allConfigs.some(s => s.active);
      db.getDb().prepare(`UPDATE sniper_configs SET active = ? WHERE user_id = ?`).run(anyActive2 ? 0 : 1, userId);
      await ctx.answerCallbackQuery(anyActive2 ? "⏸ Auto Sniper paused." : "▶ Auto Sniper resumed.");
      const AUTO_GUIDE = "🎯 *Auto Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Create multiple setups with different settings\n▸ Each setup targets different platforms\n▸ Filters prevent sniping rugs\n▸ Auto sell templates apply per setup\n━━━━━━━━━━━━━━━━━━━";
      return safeEdit(ctx, AUTO_GUIDE, buildAutoSniperMenu(db.getSniperConfigs(userId)));
    }

    if (data === "migration_pause_all") {
      const allSnipes2 = db.getActiveSnipes(userId);
      const anySnipeActive = allSnipes2.some(s => s.active);
      db.getDb().prepare(`UPDATE snipes SET active = ? WHERE user_id = ?`).run(anySnipeActive ? 0 : 1, userId);
      await ctx.answerCallbackQuery(anySnipeActive ? "⏸ Migration paused." : "▶ Migration resumed.");
      const migGuide = "🔀 *Migration Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Auto-snipes tokens at ~68K MCap\n▸ Catches PumpFun → Raydium migrations\n▸ No CA needed — bot catches it live\n▸ Set amount, slippage & auto sell\n━━━━━━━━━━━━━━━━━━━";
      return safeEdit(ctx, migGuide, buildMigrationSniperMenu(db.getActiveSnipes(userId)));
    }

    if (data === "sniper_pause_all") {
      const allConfigs = db.getSniperConfigs(userId);
      const allSnipes = db.getActiveSnipes(userId);
      const anyActive = allConfigs.some(s => s.active) || allSnipes.some(s => s.active);
      if (anyActive) {
        db.getDb().prepare("UPDATE snipes SET active = 0 WHERE user_id = ?").run(userId);
        db.getDb().prepare("UPDATE sniper_configs SET active = 0 WHERE user_id = ?").run(userId);
        await ctx.answerCallbackQuery("⏸ All paused.");
      } else {
        db.getDb().prepare("UPDATE snipes SET active = 1 WHERE user_id = ?").run(userId);
        db.getDb().prepare("UPDATE sniper_configs SET active = 1 WHERE user_id = ?").run(userId);
        await ctx.answerCallbackQuery("▶ All resumed.");
      }
      const AUTO_GUIDE = "🎯 *Auto Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Create multiple setups with different settings\n▸ Each setup targets different platforms\n▸ Filters prevent sniping rugs\n▸ Auto sell templates apply per setup\n━━━━━━━━━━━━━━━━━━━";
      return safeEdit(ctx, AUTO_GUIDE, buildAutoSniperMenu(db.getSniperConfigs(userId)));
    }

    if (data === "sniper_realtime_menu") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`sniper_screen_${userId}`, "realtime");
      const rtMsg0 = "⚡ *Real-Time Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Snipes ANY new Raydium pool instantly\n▸ Fastest entry — catches first block\n▸ No CA needed — fully automatic\n▸ Toggle sources: Raydium, Migrations, HawkX\n▸ All settings auto-save instantly\n━━━━━━━━━━━━━━━━━━━\n\n💰 Amount — SOL per snipe\n📉 Slippage — max price move %\n⛽ Fee — priority fee SOL\n⚡ Jito — bundle priority tip\n🛡 MEV — sandwich protection\n━━━━━━━━━━━━━━━━━━━";
      try {
        await ctx.editMessageText(rtMsg0, { parse_mode: "Markdown", reply_markup: buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)) });
        const msgId = ctx.callbackQuery?.message?.message_id;
        if (msgId) db.setSysConfig(`rt_msg_${userId}`, String(msgId));
      } catch {
        const s = await ctx.reply(rtMsg0, { parse_mode: "Markdown", reply_markup: buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)) });
        db.setSysConfig(`rt_msg_${userId}`, String(s.message_id));
      }
      return true;
    }

    if (data === "sniper_rt_amount") {
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("💰 Enter amount in SOL (e.g. 0.1):");
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "sniper_rt_amount");
      return true;
    }
    if (data === "sniper_rt_slippage") {
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("📉 Enter slippage % (e.g. 50):");
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "sniper_rt_slippage");
      return true;
    }
    if (data === "sniper_rt_fee") {
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("⛽ Enter fee in SOL (e.g. 0.003):");
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "sniper_rt_fee");
      return true;
    }
    if (data === "sniper_rt_toggle" || data === "sniper_rt_mev" || data === "sniper_rt_raydium" || data === "sniper_rt_migrating" || data === "sniper_rt_hawkx" || data === "sniper_rt_jito") {
      await ctx.answerCallbackQuery();
      const cfg = db.getRealtimeSniperConfig(userId);
      if (data === "sniper_rt_toggle") db.updateRealtimeSniperConfig(userId, { sniper_rt_enabled: cfg.enabled ? 0 : 1 });
      if (data === "sniper_rt_mev") db.updateRealtimeSniperConfig(userId, { sniper_rt_mev: cfg.mev ? 0 : 1 });
      if (data === "sniper_rt_raydium") db.updateRealtimeSniperConfig(userId, { sniper_rt_raydium: cfg.raydium ? 0 : 1 });
      if (data === "sniper_rt_migrating") db.updateRealtimeSniperConfig(userId, { sniper_rt_migrating: cfg.migrating ? 0 : 1 });
      if (data === "sniper_rt_hawkx") db.updateRealtimeSniperConfig(userId, { sniper_rt_launchlab: cfg.platform_launchlab ? 0 : 1 });
      if (data === "sniper_rt_jito") { const m = await ctx.reply("⚡ Enter Jito tip SOL (e.g. 0.0075):"); db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id)); db.setSysConfig(`pending_${userId}`, "sniper_rt_jito"); return true; }
      const rtGuide = "⚡ *Real-Time Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Snipes ANY new Raydium pool instantly\n▸ Fastest entry — catches first block\n▸ No CA needed — fully automatic\n▸ Toggle sources: Raydium, Migrations, HawkX\n▸ All settings auto-save instantly\n━━━━━━━━━━━━━━━━━━━\n\n💰 Amount — SOL per snipe\n📉 Slippage — max price move %\n⛽ Fee — priority fee SOL\n⚡ Jito — bundle priority tip\n🛡 MEV — sandwich protection\n━━━━━━━━━━━━━━━━━━━";
      const rtMsgId = parseInt(db.getSysConfig(`rt_msg_${userId}`) || "0");
      const rtChatId = ctx.chat?.id;
      if (rtMsgId && rtChatId) { try { await ctx.api.editMessageText(rtChatId, rtMsgId, rtGuide, { parse_mode: "Markdown", reply_markup: buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)) }); } catch { try { await ctx.editMessageReplyMarkup({ reply_markup: buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)) }); } catch {} } }
      return true;
    }
    if (data === "sniper_rt_autosell") {
      await ctx.answerCallbackQuery();
      const rtCfg = db.getRealtimeSniperConfig(userId);
      const templates = db.getAutoSellTemplates(userId);
      const tplId = rtCfg?.auto_sell_template_id || 0;
      const asOn = rtCfg?.auto_sell_enabled || 0;
      const tpl = templates.find((t) => t.id === tplId);

      const msg =
        `⚡ *Real-Time Snipe — Auto Sell*\n\n` +
        `Select a template for real-time snipes.\n` +
        `Each snipe will auto-sell using this template.`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: asOn ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌",
              callback_data: "sniper_rt_as_toggle",
            },
          ],
          [{ text: "━━━ Select Template ━━━", callback_data: "noop" }],
          ...(templates.length
            ? templates.map((t) => [
                {
                  text: `${tplId === t.id ? "✅" : "◻️"} ${t.name}`,
                  callback_data: `sniper_rt_as_tpl_${t.id}`,
                },
              ])
            : [[{ text: "No templates yet", callback_data: "noop" }]]),
          [{ text: "➕ New Template", callback_data: "sniper_rt_as_new" }],
          [{ text: "← Back", callback_data: "sniper_realtime_menu" }],
        ],
      };

      try {
        await ctx.editMessageText(msg, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } catch {
        await ctx.reply(msg, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
      return true;
    }

    if (data === "sniper_rt_as_toggle") {
      const rtCfg = db.getRealtimeSniperConfig(userId);
      db.updateRealtimeSniperConfig(userId, { sniper_rt_auto_sell_enabled: rtCfg?.auto_sell_enabled ? 0 : 1 });
      await ctx.answerCallbackQuery(rtCfg?.auto_sell_enabled ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅");
      const templates2 = db.getAutoSellTemplates(userId);
      const rtCfg2 = db.getRealtimeSniperConfig(userId);
      const tplId2 = rtCfg2?.auto_sell_template_id || 0;
      const asOn2 = rtCfg2?.auto_sell_enabled || 0;
      const kb2 = { inline_keyboard: [
        [{ text: asOn2 ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: "sniper_rt_as_toggle" }],
        [{ text: "━━━ Select Template ━━━", callback_data: "noop" }],
        ...(templates2.length ? templates2.map(t => ([{ text: `${tplId2 === t.id ? "✅" : "◻️"} ${t.name}`, callback_data: `sniper_rt_as_tpl_${t.id}` }])) : [[{ text: "No templates yet", callback_data: "noop" }]]),
        [{ text: "➕ New Template", callback_data: "sniper_rt_as_new" }],
        [{ text: "← Back", callback_data: "sniper_realtime_menu" }],
      ]};
      try { await ctx.editMessageReplyMarkup({ reply_markup: kb2 }); } catch {}
      return true;
    }

    if (data.startsWith("sniper_rt_as_tpl_")) {
      const tId = parseInt(data.replace("sniper_rt_as_tpl_", ""));
      const rtCfg3 = db.getRealtimeSniperConfig(userId);
      const current3 = rtCfg3?.auto_sell_template_id || 0;
      db.updateRealtimeSniperConfig(userId, { sniper_rt_auto_sell_template_id: current3 === tId ? 0 : tId });
      await ctx.answerCallbackQuery(current3 === tId ? "◻️ Deselected!" : "✅ Selected!");
      const templates3 = db.getAutoSellTemplates(userId);
      const rtCfg4 = db.getRealtimeSniperConfig(userId);
      const tplId3 = rtCfg4?.auto_sell_template_id || 0;
      const asOn3 = rtCfg4?.auto_sell_enabled || 0;
      const kb3 = { inline_keyboard: [
        [{ text: asOn3 ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: "sniper_rt_as_toggle" }],
        [{ text: "━━━ Select Template ━━━", callback_data: "noop" }],
        ...(templates3.length ? templates3.map(t => ([{ text: `${tplId3 === t.id ? "✅" : "◻️"} ${t.name}`, callback_data: `sniper_rt_as_tpl_${t.id}` }])) : [[{ text: "No templates yet", callback_data: "noop" }]]),
        [{ text: "➕ New Template", callback_data: "sniper_rt_as_new" }],
        [{ text: "← Back", callback_data: "sniper_realtime_menu" }],
      ]};
      try { await ctx.editMessageText(`⚡ *Real-Time Snipe — Auto Sell*\n\nSelect a template for real-time snipes.`, { parse_mode: "Markdown", reply_markup: kb3 }); } catch {}
      return true;
    }

    if (data === "sniper_rt_as_new") {
      db.setSysConfig(`ast_return_to_${userId}`, "sniper_rt_autosell");
      await ctx.answerCallbackQuery();
      const newId = db.createAutoSellTemplate(userId, "New Template");
      db.setSysConfig(`ast_unsaved_${userId}`, String(newId));
      const t = db.getAutoSellTemplate(userId, newId);
      const { buildAutoSellTemplateScreen } = require("../keyboards");
      const msg = `🤖 *${t.name}*\n\n━━━ 📚 HOW TO USE ━━━\n🛑 SL = sells if price drops\n🎯 TP = sells if price rises\n📍 = fixed price level\n🔄 Trail = follows price up\nSell% = % of remaining tokens\n\nSL1 active from start\nSL2 activates when TP1 hits\nSL3 activates when TP2 hits\n\nTap any button to change instantly\n━━━━━━━━━━━━━━━━━━━`;
      const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: buildAutoSellTemplateScreen(t) });
      db.setSysConfig(`ast_msg_${userId}`, String(sent.message_id));
      return true;
    }
    if (data === "sniper_rt_save") {
      await ctx.answerCallbackQuery("✅ Saved.");
      try { await ctx.editMessageReplyMarkup({ reply_markup: buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)) }); } catch {}
      return true;
    }

    if (data.startsWith("snipe_view_")) {
      const id = parseInt(data.replace("snipe_view_", ""));
      const s = db.getDb().prepare("SELECT * FROM snipes WHERE id = ? AND user_id = ?").get(id, userId);
      if (!s) { await ctx.answerCallbackQuery("Not found."); return true; }
      await ctx.answerCallbackQuery();
      const asOn = s.auto_sell_template_id ? "ON ✅" : "OFF ❌";
      const snipeLabel = s.label || `Snipe #${id}`;
      const snipeMsg = `🔀 *${snipeLabel}*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Tap Pause to stop this snipe\n▸ Tap Rename to change name\n▸ Tap Delete to remove permanently\n━━━━━━━━━━━━━━━━━━━\n\n${s.active ? "🟢 Active" : "⏸ Paused"}\n\n💰 Amount: *${s.sol_amount} SOL*\n📉 Slippage: *${s.slippage||50}%*\n⛽ Gas: *${s.gas||0.005} SOL*\n🛡 MEV: *${s.mev ? "ON ✅" : "OFF ❌"}*\n🤖 Auto Sell: *${asOn}*`;
        `${s.active ? "🟢 Active" : "⏸ Paused"}\n\n` +
        `💰 Amount: *${s.sol_amount} SOL*\n` +
        `📉 Slippage: *${s.slippage||50}%*\n` +
        `⛽ Gas: *${s.gas||0.005} SOL*\n` +
        `🛡 MEV: *${s.mev ? "ON ✅" : "OFF ❌"}*\n` +
        `🤖 Auto Sell: *${asOn}*`;
      const snipeKb = { inline_keyboard: [
        [{ text: s.active ? "⏸ Pause" : "▶ Resume", callback_data: `snipe_toggle_${id}` }, { text: "✏️ Rename", callback_data: `snipe_rename_${id}` }],
        [{ text: "🗑 Delete Snipe", callback_data: `snipe_cancel_${id}` }],
        [{ text: "← Back", callback_data: "sniper_migration_menu" }],
      ]};
      db.setSysConfig(`snipe_view_msg_${userId}`, String(ctx.callbackQuery?.message?.message_id || 0));
      return safeEdit(ctx, snipeMsg, snipeKb);
    }

    if (data.startsWith("snipe_rename_")) {
      const id = parseInt(data.replace("snipe_rename_", ""));
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("✏️ Enter new name for this snipe:");
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, `snipe_set_label_${id}`);
      return true;
    }

    if (data.startsWith("snipe_toggle_")) {
      const id = parseInt(data.replace("snipe_toggle_", ""));
      const s = db.getDb().prepare("SELECT * FROM snipes WHERE id = ? AND user_id = ?").get(id, userId);
      if (!s) { await ctx.answerCallbackQuery("Not found."); return true; }
      db.getDb().prepare("UPDATE snipes SET active = ? WHERE id = ? AND user_id = ?").run(s.active ? 0 : 1, id, userId);
      await ctx.answerCallbackQuery(s.active ? "⏸ Paused" : "▶ Resumed");
      const updated = db.getDb().prepare("SELECT * FROM snipes WHERE id = ? AND user_id = ?").get(id, userId);
      const asOn2 = updated.auto_sell_template_id ? "ON ✅" : "OFF ❌";
      const snipeName2 = updated.label || `Snipe #${id}`;
      const toggleMsg = `🔀 *${snipeName2}*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Tap Pause to stop this snipe\n▸ Tap Rename to change name\n▸ Tap Delete to remove permanently\n━━━━━━━━━━━━━━━━━━━\n\n${updated.active ? '🟢 Active' : '⏸ Paused'}\n\n💰 Amount: *${updated.sol_amount} SOL*\n📉 Slippage: *${updated.slippage||50}%*\n⛽ Gas: *${updated.gas||0.005} SOL*\n🛡 MEV: *${updated.mev ? 'ON ✅' : 'OFF ❌'}*\n🤖 Auto Sell: *${asOn2}*`;
      const toggleKb = { inline_keyboard: [
        [{ text: updated.active ? "⏸ Pause" : "▶ Resume", callback_data: `snipe_toggle_${id}` }, { text: "✏️ Rename", callback_data: `snipe_rename_${id}` }],
        [{ text: "🗑 Delete Snipe", callback_data: `snipe_cancel_${id}` }],
        [{ text: "← Back", callback_data: "sniper_migration_menu" }],
      ]};
      return safeEdit(ctx, toggleMsg, toggleKb);
    }

    if (data.startsWith("snipe_cancel_")) {
      const id = parseInt(data.replace("snipe_cancel_", ""));
      db.cancelSnipe(userId, id);
      await ctx.answerCallbackQuery("🗑 Deleted.");
      db.setSysConfig(`sniper_screen_${userId}`, "migration");
      return safeEdit(ctx, "🔀 *Migration Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Auto-snipes tokens at ~68K MCap\n▸ Catches PumpFun → Raydium migrations\n▸ No CA needed — bot catches it live\n▸ Set amount, slippage & auto sell\n━━━━━━━━━━━━━━━━━━━", buildMigrationSniperMenu(db.getActiveSnipes(userId)));
    }

    if (data.startsWith("scfg_")) {
      const parts = data.split("_");
      const action = parts[1];
      const id = parseInt(parts[parts.length - 1]);
      const cfg = db.getSniperConfig(id, userId);
      if (!cfg) {
        await ctx.answerCallbackQuery("Not found.");
        return true;
      }

      const toggles = {
        mev: "mev_protection",
        as: "auto_sell",
        ray: "platform_raydium",
        pump: "platform_pumpfun",
        moon: "platform_moonshot",
        rpc: "use_lightning_rpc",
        mint: "mint_auth_revoked",
        freeze: "freeze_auth_revoked",
        hawkx: "platform_launchlab",
      };

      if (toggles[action]) {
        const field = toggles[action];
        const newVal = cfg[field] ? 0 : 1;
        db.updateSniperConfig(userId, id, { [field]: newVal });
        await ctx.answerCallbackQuery("✅ Updated");
        return safeEdit(
          ctx,
          `🎯 *${cfg.label}*`,
          buildSniperConfigMenu(db.getSniperConfig(id, userId)),
        );
      }

      const prompts = {
        amt: { pending: `scfg_set_amt_${id}`, msg: "Enter snipe amount SOL:" },
        slip: { pending: `scfg_set_slip_${id}`, msg: "Enter slippage % (e.g. 50):" },
        fee: { pending: `scfg_set_fee_${id}`, msg: "Enter priority fee SOL:" },
        tip: { pending: `scfg_set_tip_${id}`, msg: "Enter Jito tip SOL:" },
        max: { pending: `scfg_set_max_${id}`, msg: "Enter max snipes (e.g. 5):" },
        minliq: { pending: `scfg_set_minliq_${id}`, msg: "💧 Min Liquidity SOL (0=off, e.g. 5):" },
        maxmcap: { pending: `scfg_set_maxmcap_${id}`, msg: "🧢 Max MCap USD (0=off, e.g. 500000):" },
        dev: { pending: `scfg_set_dev_${id}`, msg: "👤 Max Dev Holding % (100=off, e.g. 10):" },
      };

      if (prompts[action]) {
        await ctx.answerCallbackQuery();
        const msg = await ctx.reply(prompts[action].msg);
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, prompts[action].pending);
        return true;
      }

      await ctx.answerCallbackQuery();
      return true;
    }


    return false;
}

module.exports = { handleSniperCallbacks };
