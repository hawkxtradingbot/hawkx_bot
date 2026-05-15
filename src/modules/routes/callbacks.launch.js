const db = require("../../../database");
const { safeEdit, buildLaunchMsg, showLaunchScreen } = require("./helpers.routes");
const { mockBuy, mockSell } = require("../executor");

async function handleLaunchCallbacks(ctx, data, userId, user, bot, ks) {
    // ── WATCHLIST ─────────────────────────────────────────────
    if (data === "menu_launch") {
      await ctx.answerCallbackQuery();
      await showLaunchScreen(ctx, userId);
      return true;
    }

    if (data === "launch_my_list") {
      await ctx.answerCallbackQuery();
      // Get all launches for this user
      const launches = [];
      for (let i = 0; i < 10; i++) {
        const ca = db.getSysConfig(`launch_ca_${userId}_${i}`) || "";
        const name = db.getSysConfig(`launch_name_${userId}_${i}`) || "";
        const symbol = db.getSysConfig(`launch_symbol_${userId}_${i}`) || "";
        if (ca) launches.push({ ca, name, symbol });
      }
      // Also check current launch
      const currentCa = db.getSysConfig(`launch_ca_${userId}`) || "";
      if (currentCa) {
        const currentName = db.getSysConfig(`launched_name_${currentCa}`) || "Unknown";
        const currentSymbol = db.getSysConfig(`launched_symbol_${currentCa}`) || "???";
        launches.unshift({ ca: currentCa, name: currentName, symbol: currentSymbol });
      }
      
      if (!launches.length) {
        await ctx.answerCallbackQuery("No launches yet!");
        return true;
      }
      const kb = { inline_keyboard: [
        ...launches.slice(0,10).map(l => ([{ text: `🚀 ${l.name||"?"} (${l.symbol||"?"}) — ${l.ca.slice(0,12)}...`, callback_data: `launch_chart_${l.ca}` }])),
        [{ text: "← Back", callback_data: "menu_launch" }],
      ]};
      const myLaunchMsg = 
        `📋 *My Launches*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🚀 All tokens you launched\n` +
        `💰 Click token to trade\n` +
        `🔄 Refresh to update price\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Total: *${launches.length}* token(s) launched`;
      try { await ctx.editMessageText(myLaunchMsg, { parse_mode: "Markdown", reply_markup: kb }); } catch {
        await ctx.reply(myLaunchMsg, { parse_mode: "Markdown", reply_markup: kb });
      }
      return true;
    }

    if (data === "launch_platform_hawkx") {
      await ctx.answerCallbackQuery("🦅 HawkX Launch — Coming Soon!");
      return true;
    }

    if (data === "launch_platform_pump" || data === "launch_platform_hawkx") {
      await ctx.answerCallbackQuery();
      const platform = data === "launch_platform_pump" ? "pump" : "hawkx";
      db.setSysConfig(`launch_platform_${userId}`, platform);
      const { getLaunchPending, buildLaunchScreen } = require("../launch");
      const { msg: fMsg, kb: fKb } = await buildLaunchMsg(userId, false);
      try { await ctx.editMessageText(fMsg, { parse_mode: "Markdown", reply_markup: fKb }); }
      catch { await ctx.reply(fMsg, { parse_mode: "Markdown", reply_markup: fKb }); }
      return true;
    }

    if (data.startsWith("launch_refresh_")) {
      await ctx.answerCallbackQuery("🔄 Refreshed!");
      const { msg, kb } = await buildLaunchMsg(userId, false);
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
      return true;
    }

    if (data === "launch_wallet_expand") {
      await ctx.answerCallbackQuery();
      const { msg, kb } = await buildLaunchMsg(userId, true);
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
      return true;
    }

    if (data === "launch_wallet_collapse") {
      await ctx.answerCallbackQuery();
      const { msg, kb } = await buildLaunchMsg(userId, false);
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
      return true;
    }

    if (data.startsWith("launch_setwallet_")) {
      const wId = parseInt(data.replace("launch_setwallet_", ""));
      db.setSysConfig(`launch_wallet_${userId}`, String(wId));
      await ctx.answerCallbackQuery("✅ Wallet selected!");
      const { msg, kb } = await buildLaunchMsg(userId, false);
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
      return true;
    }

    if (data === "launch_supply_locked") {
      await ctx.answerCallbackQuery("🔒 Pump.fun fixes supply at 1,000,000,000. Cannot be changed!");
      return true;
    }

    if (data === "launch_set_name" || data === "launch_set_symbol" || data === "launch_set_supply" ||
        data === "launch_set_desc" || data === "launch_set_twitter" || data === "launch_set_telegram" ||
        data === "launch_set_website") {
      await ctx.answerCallbackQuery();
      const fieldMap = {
        launch_set_name: { key: `launch_name_${userId}`, msg: "📝 Enter token name (e.g. My Token):" },
        launch_set_symbol: { key: `launch_symbol_${userId}`, msg: "🔤 Enter token symbol (e.g. MTK):" },
        launch_set_supply: { key: `launch_supply_${userId}`, msg: "🔢 Enter total supply (e.g. 1000000000):" },
        launch_set_desc: { key: `launch_desc_${userId}`, msg: "📄 Enter description:" },
        launch_set_twitter: { key: `launch_twitter_${userId}`, msg: "🐦 Enter Twitter (e.g. @mytoken):" },
        launch_set_telegram: { key: `launch_telegram_${userId}`, msg: "💬 Enter Telegram (e.g. t.me/mytoken):" },
        launch_set_website: { key: `launch_website_${userId}`, msg: "🌍 Enter website URL:" },
        launch_set_initial_buy: { key: `launch_initial_buy_${userId}`, msg: "💰 Enter initial buy in SOL (e.g. 0.5):" },
      };
      const f = fieldMap[data];
      const m = await ctx.reply(f.msg);
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, `launch_field_${data.replace("launch_set_","")}_${userId}`);
      return true;
    }

    if (data.startsWith("launch_buy_amt_")) {
      const amt = data.replace("launch_buy_amt_", "");
      db.setSysConfig(`launch_initial_buy_${userId}`, amt);
      await ctx.answerCallbackQuery(`💰 Initial buy: ${amt} SOL`);
      const { getLaunchPending, buildLaunchScreen } = require("../launch");
      const p = getLaunchPending(userId);
      const launchMsgId = parseInt(db.getSysConfig(`launch_msg_${userId}`) || "0");
      const pName = p.platform === "pump" ? "🌊 Pump.fun" : "🦅 HawkX";
      const launchMsgId2 = parseInt(db.getSysConfig(`launch_msg_${userId}`) || "0");
      const { msg: lMsg3, kb: lKb3 } = await buildLaunchMsg(userId, false);
      try {
        if (launchMsgId2) await ctx.api.editMessageText(ctx.chat.id, launchMsgId2, lMsg3, { parse_mode: "Markdown", reply_markup: lKb3 });
        else { const s = await ctx.reply(lMsg3, { parse_mode: "Markdown", reply_markup: lKb3 }); db.setSysConfig(`launch_msg_${userId}`, String(s.message_id)); }
      } catch { const s = await ctx.reply(lMsg3, { parse_mode: "Markdown", reply_markup: lKb3 }); db.setSysConfig(`launch_msg_${userId}`, String(s.message_id)); }
      return true;
    }

    if (data === "launch_set_image") {
      await ctx.answerCallbackQuery();
      const existingImg = db.getSysConfig(`launch_image_${userId}`) || "";
      const platform = db.getSysConfig(`launch_platform_${userId}`) || "hawkx";
      if (existingImg) {
        const previewMsg = await ctx.api.sendPhoto(ctx.chat.id, existingImg, {
          caption: "🖼 *Current token image*\n\nSend a new photo to replace it, or tap Back.",
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: `launch_platform_${platform}` }]] }
        });
        // Auto delete after 5 seconds
        setTimeout(async () => {
          try { await ctx.api.deleteMessage(ctx.chat.id, previewMsg.message_id); } catch {}
        }, 5000);
        db.setSysConfig(`pending_${userId}`, "launch_image");
        return true;
      }
      const m = await ctx.reply("🖼 Send your token image (JPG or PNG):", {
        reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: `launch_platform_${platform}` }]] }
      });
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "launch_image");
      return true;
    }

    if (data === "launch_confirm") {
      const { getLaunchPending, buildLaunchSuccessScreen } = require("../launch");
      const p = getLaunchPending(userId);
      const missing = [];
      if (!p.name) missing.push("📝 Name");
      if (!p.symbol) missing.push("🔤 Symbol");
      if (!p.image) missing.push("🖼 Image");
      if (missing.length > 0) {
        await ctx.answerCallbackQuery("❌ Missing required fields!");
        await ctx.reply(
          `❌ *Missing Required Fields*\n\n` +
          missing.map(m => `• ${m} is required`).join("\n") +
          `\n\nPlease fill these before launching!`,
          { parse_mode: "Markdown" }
        );
        return true;
      }
      await ctx.answerCallbackQuery("🚀 Launching...");
      // Simulate token launch on devnet
      const ca = `DEVNET_${Date.now()}_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
      db.setSysConfig(`launch_ca_${userId}`, ca);
      // Save launch info by CA for later reference
      db.setSysConfig(`launched_name_${ca}`, p.name || "Unknown");
      db.setSysConfig(`launched_symbol_${ca}`, p.symbol || "???");
      // Clear pending settings for fresh next launch
      db.setSysConfig(`launch_name_${userId}`, "");
      db.setSysConfig(`launch_symbol_${userId}`, "");
      db.setSysConfig(`launch_supply_${userId}`, "");
      db.setSysConfig(`launch_desc_${userId}`, "");
      db.setSysConfig(`launch_twitter_${userId}`, "");
      db.setSysConfig(`launch_telegram_${userId}`, "");
      db.setSysConfig(`launch_website_${userId}`, "");
      db.setSysConfig(`launch_image_${userId}`, "");
      db.setSysConfig(`launch_initial_buy_${userId}`, "0");
      db.setSysConfig(`launch_platform_${userId}`, "");
      const successMsg =
        `✅ *Token Launched!* [DEVNET]\n\n` +
        `📝 *${p.name}* (${p.symbol})\n\n` +
        `📋 *Contract Address:*\n` +
        `${ca}\n\n` +
        `💰 Initial Price: *$0.000001*\n` +
        `📊 MCap: *$1,000*\n` +
        `💧 Liquidity: *$500*`;
      try { await ctx.editMessageText(successMsg, { parse_mode: "Markdown", reply_markup: buildLaunchSuccessScreen(ca, p.name, p.symbol) }); }
      catch { await ctx.reply(successMsg, { parse_mode: "Markdown", reply_markup: buildLaunchSuccessScreen(ca, p.name, p.symbol) }); }
      return true;
    }

    if (data.startsWith("launch_chart_")) {
      await ctx.answerCallbackQuery("📊 Refreshing...");
      const ca = data.replace("launch_chart_", "");
      const { buildLaunchSuccessScreen } = require("../launch");
      // Get saved launch info
      const savedName = db.getSysConfig(`launched_name_${ca}`) || ca.slice(0,8);
      const savedSymbol = db.getSysConfig(`launched_symbol_${ca}`) || "???";
      const price = (Math.random() * 0.00001).toFixed(8);
      const mcap = (Math.random() * 10000).toFixed(0);
      const holders = Math.floor(Math.random() * 200) + 10;
      const vol = (Math.random() * 5000).toFixed(0);
      const successMsg =
        `✅ *Token Live!* [DEVNET]\n\n` +
        `📝 *${savedName}* (${savedSymbol})\n\n` +
        `📋 *CA:* ${ca}\n\n` +
        `💰 Price: *${price}*\n` +
        `📊 MCap: *${mcap}*\n` +
        `💧 Liquidity: *$500*\n` +
        `👥 Holders: *${holders}*\n` +
        `📈 Volume 24h: *${vol}*`;
      try { await ctx.editMessageText(successMsg, { parse_mode: "Markdown", reply_markup: buildLaunchSuccessScreen(ca, savedName, savedSymbol) }); } catch {}
      return true;
    }

    if (data.startsWith("launch_token_buy_") && !data.includes("custom")) {
      const parts = data.replace("launch_token_buy_", "").split("_");
      const ca = parts.slice(0,-1).join("_");
      const amt = parseFloat(parts[parts.length-1]);
      await ctx.answerCallbackQuery("🟢 Buying...");
      await mockBuy(ctx, user, ca, amt, "launch");
      return true;
    }

    if (data.startsWith("launch_token_buy_custom_")) {
      const ca = data.replace("launch_token_buy_custom_", "");
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("💰 Enter buy amount in SOL:");
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, `launch_custom_buy_${ca}`);
      return true;
    }

    if (data.startsWith("launch_token_sell_") && !data.includes("custom")) {
      const parts = data.replace("launch_token_sell_", "").split("_");
      const pct = parseInt(parts[parts.length-1]);
      const ca = parts.slice(0,-1).join("_");
      await ctx.answerCallbackQuery("🔴 Selling...");
      const pos = db.getDb().prepare("SELECT * FROM positions WHERE user_id = ? AND token_ca = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1").get(userId, ca);
      if (!pos) { await ctx.answerCallbackQuery("❌ No position found!"); return true; }
      const { mockSell } = require("../executor");
      await mockSell(ctx, user, pos, pct);
      return true;
    }

    if (data.startsWith("launch_token_sell_custom_")) {
      const ca = data.replace("launch_token_sell_custom_", "");
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("🔴 Enter sell % (e.g. 75):");
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, `launch_custom_sell_${ca}`);
      return true;
    }

    if (data.startsWith("launch_buy_")) {
      const ca = data.replace("launch_buy_", "");
      await ctx.answerCallbackQuery();
      ctx.callbackQuery.data = `trade_ca_${ca}`;
      return true;
    }


    return false;
}

module.exports = { handleLaunchCallbacks };
