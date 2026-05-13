const db = require("../../../database");
const { safeEdit, showCwSetupScreen, stripMd, buildReferralScreen } = require("./helpers.routes");
const { buildCopyTradeMenu, buildCopyWalletListMenu, buildCopyChannelListMenu, buildCopyChannelSettingsMenu, getGuide } = require("../keyboards");

async function handleCopyTradeCallbacks(ctx, data, userId, user, bot, ks) {
    // ── COPY TRADE ────────────────────────────────────────────
    if (data === "menu_copy_trade") {
      await ctx.answerCallbackQuery();
      const copyGuide =
        `👥 *Copy Trade*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📚 *GUIDE:*\n\n` +
        `💼 *Copy Wallet*\n` +
        `   Follow a specific whale wallet.\n` +
        `   Bot auto-buys when they buy.\n` +
        `   Bot auto-sells when they sell.\n` +
        `   Best for: trusted whale wallets.\n\n` +
        `📡 *Copy Channel*\n` +
        `   Follow a Telegram signal channel.\n` +
        `   Bot auto-buys any CA posted there.\n` +
        `   Best for: hot token alert channels.\n` +
        `━━━━━━━━━━━━━━━━━━━`;
      return safeEdit(ctx, copyGuide, buildCopyTradeMenu());
    }

    if (data === "copy_wallet_menu") {
      await ctx.answerCallbackQuery();
      const cw = db.getCopyWallets(userId);
      const guide =
        `📚 *Guide:*\n` +
        `➕ Add — add a wallet to copy\n` +
        `🟢 Active — tap to view details\n` +
        `⏸ Pause — stops copying trades\n` +
        `▶ Resume — starts copying again\n` +
        `🗑 Delete — remove permanently\n` +
        `⏸ Pause All — stop all at once\n\n`;
      return safeEdit(
        ctx,
        `👛 *Copy Wallet*\n\n${guide}`,
        buildCopyWalletListMenu(cw),
      );
    }

    if (data === "copy_wallet_add") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      db.setSysConfig(
        `cw_pending_wallet_${userId}`,
        String(freshUser.active_wallet_id),
      );
      db.setSysConfig(`cw_pending_slippage_${userId}`, "50");
      db.setSysConfig(`cw_pending_gas_${userId}`, "0.005");
      db.setSysConfig(`cw_pending_copysell_${userId}`, "1");
      db.setSysConfig(`cw_pending_addr_${userId}`, "");
      db.setSysConfig(`cw_pending_name_${userId}`, "");
      db.setSysConfig(`cw_pending_sol_${userId}`, "0.1");
      return showCwSetupScreen(ctx, userId);
    }

    if (data === "cw_paste_address") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(
        `cw_setup_msg_${userId}`,
        String(ctx.callbackQuery.message.message_id),
      );
      const msg = await ctx.reply(
        "🎯 Paste the Solana wallet address you want to follow:",
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "cw_follow_address");
      return;
    }

    if (data.startsWith("cw_setwallet_")) {
      const walletId = parseInt(data.replace("cw_setwallet_", ""));
      db.setSysConfig(`cw_pending_wallet_${userId}`, String(walletId));
      db.setSysConfig(`cw_wallet_expanded_${userId}`, "0");
      await ctx.answerCallbackQuery("✅ Wallet selected!");
      return showCwSetupScreen(ctx, userId);
    }

    if (data === "cw_set_name") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(
        `cw_setup_msg_${userId}`,
        String(ctx.callbackQuery.message.message_id),
      );
      const msg = await ctx.reply(
        "📝 Enter a name for this copy wallet (e.g. Whale Tracker):",
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "cw_name");
      return;
    }

    if (data === "cw_set_amount") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(
        `cw_setup_msg_${userId}`,
        String(ctx.callbackQuery.message.message_id),
      );
      const msg = await ctx.reply(
        "💰 Enter buy amount in SOL per trade (e.g. 0.5):",
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "cw_amount");
      return;
    }

    if (data === "cw_toggle_copysell") {
      const current = db.getSysConfig(`cw_pending_copysell_${userId}`) || "1";
      const newVal = current === "1" ? "0" : "1";
      db.setSysConfig(`cw_pending_copysell_${userId}`, newVal);
      // If copy sell ON → auto sell OFF
      if (newVal === "1") db.setSysConfig(`cw_pending_autosell_${userId}`, "0");
      await ctx.answerCallbackQuery(newVal === "1" ? "🔄 Copy Sell ON ✅" : "🔄 Copy Sell OFF");
      return showCwSetupScreen(ctx, userId);
    }

    if (data === "cw_toggle_mev") {
      const current = db.getSysConfig(`cw_pending_mev_${userId}`) || "1";
      db.setSysConfig(`cw_pending_mev_${userId}`, current === "1" ? "0" : "1");
      await ctx.answerCallbackQuery(current === "1" ? "🛡 MEV OFF" : "🛡 MEV ON ✅");
      return showCwSetupScreen(ctx, userId);
    }
    if (data === "cw_show_wallets") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`cw_wallet_expanded_${userId}`, "1");
      return showCwSetupScreen(ctx, userId);
    }

    if (data === "cw_hide_wallets") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`cw_wallet_expanded_${userId}`, "0");
      return showCwSetupScreen(ctx, userId);
    }

    if (data === "cw_back_to_setup") {
      await ctx.answerCallbackQuery();
      return showCwSetupScreen(ctx, userId);
    }
    if (data === "cw_set_slippage") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(
        `cw_setup_msg_${userId}`,
        String(ctx.callbackQuery.message.message_id),
      );
      const msg = await ctx.reply(
        "📊 Enter slippage % for buy & sell (e.g. 50):",
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "cw_slippage");
      return;
    }

    if (data === "cw_set_gas") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(
        `cw_setup_msg_${userId}`,
        String(ctx.callbackQuery.message.message_id),
      );
      const msg = await ctx.reply(
        "⛽ Enter gas fee in SOL for buy & sell (e.g. 0.005):",
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "cw_gas");
      return;
    }

    if (data.startsWith("copy_wallet_view_")) {
      const id = parseInt(data.replace("copy_wallet_view_", ""));
      const cw = db
        .getDb()
        .prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?")
        .get(id, userId);
      if (!cw) {
        await ctx.answerCallbackQuery("Not found.");
        return;
      }
      await ctx.answerCallbackQuery();
      const wallets = db.getWallets(userId) || [];
      const selWal = wallets.find((w) => w.wallet_id === cw.wallet_id);
      const walletIdx = selWal ? wallets.indexOf(selWal) + 1 : "—";
      const name = cw.label || cw.wallet_address.slice(0, 16) + "...";
      const wallets2 = db.getWallets(userId) || [];
      const walletBtns = [];
      for (let i = 0; i < wallets2.length; i += 4) {
        walletBtns.push(wallets2.slice(i, i + 4).map((w, idx) => {
          const num = i + idx + 1;
          const isSel = w.wallet_id === cw.wallet_id;
          return { text: isSel ? `W${num} ✅` : `W${num}`, callback_data: `cw_setwallet_edit_${id}_${w.wallet_id}` };
        }));
      }

      const cwMsg =
        `👛 *${name}*\n\n` +
        `🎯 Address:\n\`${cw.wallet_address}\`\n\n` +
        `💼 Using: *W${walletIdx}*\n` +
        `💰 Buy: *${cw.sol_amount} SOL* | 📊 Slip: *${cw.slippage||50}%* | ⛽ Gas: *${cw.gas_fee||0.005} SOL*\n` +
        `🛡 MEV: *${cw.mev_protection ? "ON ✅" : "OFF ❌"}*\n` +
        `🔄 Copy Sell: *${cw.copy_sell ? "ON ✅" : "OFF ❌"}* | 🤖 Auto Sell: *${cw.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*\n` +
        `Status: *${cw.active ? "🟢 Active" : "⏸ Paused"}* | Trades: *${cw.trades_executed || 0}*`;

      const cwKeyboard = { inline_keyboard: [
        ...walletBtns,
        [{ text: `💰 ${cw.sol_amount}SOL`, callback_data: `cw_edit_amount_${id}` },
         { text: `📊 ${cw.slippage||50}%`, callback_data: `cw_edit_slip_${id}` },
         { text: `⛽ ${cw.gas_fee||0.005}SOL`, callback_data: `cw_edit_gas_${id}` }],
        [{ text: cw.mev_protection ? "🛡 MEV: ON ✅" : "🛡 MEV: OFF ❌", callback_data: `cw_edit_mev_${id}` }],
        [{ text: cw.copy_sell ? "🔄 Copy Sell: ON ✅" : "🔄 Copy Sell: OFF ❌", callback_data: `cw_edit_copysell_${id}` },
         { text: cw.auto_sell_enabled ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: `cw_autosell_${id}` }],
        [{ text: cw.active ? "⏸ Pause" : "▶ Resume", callback_data: `copy_wallet_toggle_${id}` },
         { text: "🗑 Delete", callback_data: `copy_wallet_delete_${id}` }],
        [{ text: "← Back", callback_data: "copy_wallet_menu" }],
      ]}

      try {
        await ctx.editMessageText(cwMsg, { parse_mode: "Markdown", reply_markup: cwKeyboard });
        db.setSysConfig(`cw_view_msg_${userId}`, String(ctx.callbackQuery.message.message_id));
      } catch {
        const sent = await ctx.reply(cwMsg, { parse_mode: "Markdown", reply_markup: cwKeyboard });
        db.setSysConfig(`cw_view_msg_${userId}`, String(sent.message_id));
      }
      return;
    }

    if (data.startsWith("copy_wallet_toggle_")) {
      const id = parseInt(data.replace("copy_wallet_toggle_", ""));
      const cw = db
        .getDb()
        .prepare("SELECT active FROM copy_wallets WHERE id = ? AND user_id = ?")
        .get(id, userId);
      if (!cw) {
        await ctx.answerCallbackQuery("Not found.");
        return;
      }
      db.getDb()
        .prepare(
          "UPDATE copy_wallets SET active = ? WHERE id = ? AND user_id = ?",
        )
        .run(cw.active ? 0 : 1, id, userId);
      await ctx.answerCallbackQuery(cw.active ? "⏸ Paused" : "▶ Resumed");
      return safeEdit(
        ctx,
        `👛 *Copy Wallet*

📚 *Guide:*
➕ Add — add a wallet to copy
🟢 Active — tap to view details
⏸ Pause — stops copying trades
▶ Resume — starts copying again
🗑 Delete — remove permanently
⏸ Pause All — stop all at once
`,
        buildCopyWalletListMenu(db.getCopyWallets(userId)),
      );
    }
    if (data.startsWith("copy_wallet_delete_")) {
      const id = parseInt(data.replace("copy_wallet_delete_", ""));
      db.getDb()
        .prepare("DELETE FROM copy_wallets WHERE id = ? AND user_id = ?")
        .run(id, userId);
      await ctx.answerCallbackQuery("🗑 Deleted.");
      return safeEdit(
        ctx,
        `👛 *Copy Wallet*

📚 *Guide:*
➕ Add — add a wallet to copy
🟢 Active — tap to view details
⏸ Pause — stops copying trades
▶ Resume — starts copying again
🗑 Delete — remove permanently
⏸ Pause All — stop all at once
`,
        buildCopyWalletListMenu(db.getCopyWallets(userId)),
      );
    }
    if (data === "cw_setup_autosell") {
      await ctx.answerCallbackQuery();
      const templates = db.getAutoSellTemplates(userId);
      const tplId = parseInt(db.getSysConfig(`cw_pending_autosell_tpl_${userId}`) || "0");
      const asOn = db.getSysConfig(`cw_pending_autosell_${userId}`) === "1";
      db.setSysConfig(`ast_return_to_${userId}`, "cw_setup_autosell_back");
      const { buildChannelAutoSellScreen } = require("../keyboards");
      const fakeChannel = { 
        id: "setup",
        auto_sell_enabled: asOn ? 1 : 0, 
        auto_sell_template_id: tplId,
        channel_name: "Copy Wallet Setup"
      };
      try { await ctx.editMessageText(
        `🤖 *Auto Sell — Copy Wallet Setup*\n\nSelect a template to use for this wallet.`,
        { parse_mode: "Markdown", reply_markup: buildChannelAutoSellScreen(fakeChannel, templates) }
      ); } catch { await ctx.reply(
        `🤖 *Auto Sell — Copy Wallet Setup*\n\nSelect a template to use for this wallet.`,
        { parse_mode: "Markdown", reply_markup: buildChannelAutoSellScreen(fakeChannel, templates) }
      ); }
      return;
    }

      if (data === "cw_autosell_setup") {
      await ctx.answerCallbackQuery();
      const { buildWalletAutoSellScreen } = require("../keyboards");
      const templates = db.getAutoSellTemplates(userId);
      const freshUser = db.getUser(userId);
      const fakeId = { id: 0, auto_sell_enabled: freshUser.auto_sell_enabled || 0, auto_sell_template_id: freshUser.auto_sell_template_id || 0 };
      try { await ctx.editMessageText(
        `👛 *Copy Wallet Setup — Auto Sell*\n\nSelect a template for new copy wallet trades.`,
        { parse_mode: "Markdown", reply_markup: buildWalletAutoSellScreen(fakeId, templates) }
      ); } catch {}
      return;
    }
    if (data.startsWith("cw_autosell_")) {
      // Toggle ON/OFF
      if (data.startsWith("cw_autosell_toggle_")) {
        const id = parseInt(data.replace("cw_autosell_toggle_", ""));
        const cw = db
          .getDb()
          .prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?")
          .get(id, userId);
        if (!cw) {
          await ctx.answerCallbackQuery("Not found.");
          return;
        }
        db.getDb()
          .prepare(
            "UPDATE copy_wallets SET auto_sell_enabled = ? WHERE id = ? AND user_id = ?",
          )
          .run(cw.auto_sell_enabled ? 0 : 1, id, userId);
        await ctx.answerCallbackQuery(
          cw.auto_sell_enabled ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅",
        );
        const { buildWalletAutoSellScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(userId);
        const updated = db
          .getDb()
          .prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?")
          .get(id, userId);
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: buildWalletAutoSellScreen(updated, templates),
          });
        } catch {}
        return;
      }

      // Open auto sell screen
      if (
        !data.startsWith("cw_autosell_use_") &&
        !data.startsWith("cw_autosell_new_") &&
        !data.startsWith("cw_autosell_toggle_")
      ) {
        const id = parseInt(data.replace("cw_autosell_", ""));
        const cw = db
          .getDb()
          .prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?")
          .get(id, userId);
        if (!cw) {
          await ctx.answerCallbackQuery("Not found.");
          return;
        }
        await ctx.answerCallbackQuery();
        const { buildWalletAutoSellScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try {
          await ctx.editMessageText(
            `👛 *${cw.label || cw.wallet_address.slice(0, 12)} — Auto Sell*\n\n` +
              `Select a template to use for this wallet.\n` +
              `Each wallet can have its own template.`,
            {
              parse_mode: "Markdown",
              reply_markup: buildWalletAutoSellScreen(cw, templates),
            },
          );
        } catch {}
        return;
      }

      // Select template
      if (data.startsWith("cw_autosell_use_")) {
        const withoutPrefix = data.replace("cw_autosell_use_", "");
        const lastIdx = withoutPrefix.lastIndexOf("_");
        const cwId = parseInt(withoutPrefix.slice(0, lastIdx));
        const tId  = parseInt(withoutPrefix.slice(lastIdx + 1));
        // Toggle — deselect if already selected
        const cwCurrent = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(cwId, userId);
        const newTplId = cwCurrent?.auto_sell_template_id === tId ? null : tId;
        db.getDb().prepare("UPDATE copy_wallets SET auto_sell_template_id = ? WHERE id = ? AND user_id = ?").run(newTplId, cwId, userId);
        await ctx.answerCallbackQuery(newTplId ? "✅ Selected!" : "◻️ Deselected!");
        const { buildWalletAutoSellScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(userId);
        const updated = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(cwId, userId);
        try { await ctx.editMessageText(
          `👛 *${updated.label || updated.wallet_address.slice(0,12)} — Auto Sell*\n\nSelect a template for this wallet.`,
          { parse_mode: "Markdown", reply_markup: buildWalletAutoSellScreen(updated, templates) }
        ); } catch (e) {
          if (!e?.description?.includes("not modified")) {
            await ctx.reply(
              `👛 *Auto Sell*\n\nSelect a template:`,
              { parse_mode: "Markdown", reply_markup: buildWalletAutoSellScreen(updated, templates) }
            );
          }
        }
        return;
      }

      // New template from wallet screen
      if (data.startsWith("cw_autosell_new_")) {
        const id = parseInt(data.replace("cw_autosell_new_", ""));
        db.setSysConfig(`ast_return_to_${userId}`, `cw_autosell_${id}`);
        await ctx.answerCallbackQuery();
        const newId2 = db.createAutoSellTemplate(userId, "New Template");
        db.setSysConfig(`ast_unsaved_${userId}`, String(newId2));
        const t2 = db.getAutoSellTemplate(userId, newId2);
        const { buildAutoSellTemplateScreen: bats } = require("../keyboards");
        const msg2 =
          `🤖 *${t2.name}*\n\n` +
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
        const sent2 = await ctx.reply(msg2, { parse_mode: "Markdown", reply_markup: bats(t2) });
        db.setSysConfig(`ast_msg_${userId}`, String(sent2.message_id));
        return;
      }

      await ctx.answerCallbackQuery();
      return;
    }
    if (data.startsWith("cw_setwallet_edit_")) {
      const parts = data.replace("cw_setwallet_edit_", "").split("_");
      const cwId = parseInt(parts[0]);
      const walletId = parseInt(parts[1]);
      db.getDb().prepare("UPDATE copy_wallets SET wallet_id = ? WHERE id = ? AND user_id = ?").run(walletId, cwId, userId);
      await ctx.answerCallbackQuery("✅ Wallet updated!");
      ctx.callbackQuery.data = `copy_wallet_view_${cwId}`;
    }

    if (data.startsWith("cw_edit_mev_")) {
      const id = parseInt(data.replace("cw_edit_mev_", ""));
      const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
      if (!cw) { await ctx.answerCallbackQuery("Not found."); return; }
      db.getDb().prepare("UPDATE copy_wallets SET mev_protection = ? WHERE id = ? AND user_id = ?").run(cw.mev_protection ? 0 : 1, id, userId);
      await ctx.answerCallbackQuery(cw.mev_protection ? "🛡 MEV OFF" : "🛡 MEV ON ✅");
      // Instant refresh
      const updated = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
      const wallets3 = db.getWallets(userId) || [];
      const selWal3  = wallets3.find(w => w.wallet_id === updated.wallet_id);
      const wIdx3    = selWal3 ? wallets3.indexOf(selWal3) + 1 : "—";
      const wBtns3   = [];
      for (let i = 0; i < wallets3.length; i += 4) {
        wBtns3.push(wallets3.slice(i, i + 4).map((w, idx) => {
          const num = i + idx + 1;
          return { text: w.wallet_id === updated.wallet_id ? `W${num} ✅` : `W${num}`, callback_data: `cw_setwallet_edit_${id}_${w.wallet_id}` };
        }));
      }
      const msg3 =
        `👛 *${updated.label || updated.wallet_address.slice(0,16)}*\n\n` +
        `🎯 Address:\n\`${updated.wallet_address}\`\n\n` +
        `💼 Using: *W${wIdx3}*\n` +
        `💰 Buy: *${updated.sol_amount} SOL* | 📊 Slip: *${updated.slippage||50}%* | ⛽ Gas: *${updated.gas_fee||0.005} SOL*\n` +
        `🛡 MEV: *${updated.mev_protection ? "ON ✅" : "OFF ❌"}*\n` +
        `🔄 Copy Sell: *${updated.copy_sell ? "ON ✅" : "OFF ❌"}* | 🤖 Auto Sell: *${updated.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*\n` +
        `Status: *${updated.active ? "🟢 Active" : "⏸ Paused"}* | Trades: *${updated.trades_executed || 0}*`;
      const kb3 = { inline_keyboard: [
        ...wBtns3,
        [{ text: `💰 ${updated.sol_amount}SOL`, callback_data: `cw_edit_amount_${id}` },
         { text: `📊 ${updated.slippage||50}%`, callback_data: `cw_edit_slip_${id}` },
         { text: `⛽ ${updated.gas_fee||0.005}SOL`, callback_data: `cw_edit_gas_${id}` }],
        [{ text: updated.mev_protection ? "🛡 MEV: ON ✅" : "🛡 MEV: OFF ❌", callback_data: `cw_edit_mev_${id}` }],
        [{ text: updated.copy_sell ? "🔄 Copy Sell: ON ✅" : "🔄 Copy Sell: OFF ❌", callback_data: `cw_edit_copysell_${id}` },
         { text: updated.auto_sell_enabled ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: `cw_autosell_${id}` }],
        [{ text: updated.active ? "⏸ Pause" : "▶ Resume", callback_data: `copy_wallet_toggle_${id}` },
         { text: "🗑 Delete", callback_data: `copy_wallet_delete_${id}` }],
        [{ text: "← Back", callback_data: "copy_wallet_menu" }],
      ]};
      try { await ctx.editMessageText(msg3, { parse_mode: "Markdown", reply_markup: kb3 }); } catch {}
      return;
    }

    if (data.startsWith("cw_edit_copysell_")) {
      const id = parseInt(data.replace("cw_edit_copysell_", ""));
      const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
      if (!cw) { await ctx.answerCallbackQuery("Not found."); return; }
      db.getDb().prepare("UPDATE copy_wallets SET copy_sell = ? WHERE id = ? AND user_id = ?").run(cw.copy_sell ? 0 : 1, id, userId);
      await ctx.answerCallbackQuery(cw.copy_sell ? "🔄 Copy Sell OFF" : "🔄 Copy Sell ON ✅");
      // Refresh instantly
        const updatedCS = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
        const wallets5 = db.getWallets(userId) || [];
        const wBtns5 = [];
        for (let i = 0; i < wallets5.length; i += 4) {
          wBtns5.push(wallets5.slice(i, i + 4).map((w, idx) => {
            const num = i + idx + 1;
            return { text: w.wallet_id === updatedCS.wallet_id ? `W${num} ✅` : `W${num}`, callback_data: `cw_setwallet_edit_${id}_${w.wallet_id}` };
          }));
        }
        const selWal5 = wallets5.find(w => w.wallet_id === updatedCS.wallet_id);
        const wIdx5 = selWal5 ? wallets5.indexOf(selWal5) + 1 : "—";
        const msgCS =
          `👛 *${updatedCS.label || updatedCS.wallet_address.slice(0,16)}*\n\n` +
          `🎯 Address:\n\`${updatedCS.wallet_address}\`\n\n` +
          `💼 Using: *W${wIdx5}*\n` +
          `💰 Buy: *${updatedCS.sol_amount} SOL* | 📊 Slip: *${updatedCS.slippage||50}%* | ⛽ Gas: *${updatedCS.gas_fee||0.005} SOL*\n` +
          `🛡 MEV: *${updatedCS.mev_protection ? "ON ✅" : "OFF ❌"}*\n` +
          `🔄 Copy Sell: *${updatedCS.copy_sell ? "ON ✅" : "OFF ❌"}* | 🤖 Auto Sell: *${updatedCS.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*\n` +
          `Status: *${updatedCS.active ? "🟢 Active" : "⏸ Paused"}* | Trades: *${updatedCS.trades_executed || 0}*`;
        const kbCS = { inline_keyboard: [
          ...wBtns5,
          [{ text: `💰 ${updatedCS.sol_amount}SOL`, callback_data: `cw_edit_amount_${id}` },
           { text: `📊 ${updatedCS.slippage||50}%`, callback_data: `cw_edit_slip_${id}` },
           { text: `⛽ ${updatedCS.gas_fee||0.005}SOL`, callback_data: `cw_edit_gas_${id}` }],
          [{ text: updatedCS.mev_protection ? "🛡 MEV: ON ✅" : "🛡 MEV: OFF ❌", callback_data: `cw_edit_mev_${id}` }],
          [{ text: updatedCS.copy_sell ? "🔄 Copy Sell: ON ✅" : "🔄 Copy Sell: OFF ❌", callback_data: `cw_edit_copysell_${id}` },
           { text: updatedCS.auto_sell_enabled ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: `cw_autosell_${id}` }],
          [{ text: updatedCS.active ? "⏸ Pause" : "▶ Resume", callback_data: `copy_wallet_toggle_${id}` },
           { text: "🗑 Delete", callback_data: `copy_wallet_delete_${id}` }],
          [{ text: "← Back", callback_data: "copy_wallet_menu" }],
        ]};
        try { await ctx.editMessageText(msgCS, { parse_mode: "Markdown", reply_markup: kbCS }); } catch {}
        return;
      }

      if (data.startsWith("cw_edit_amount_")) {
      const id = parseInt(data.replace("cw_edit_amount_", ""));
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("💰 Enter buy amount in SOL (e.g. 0.1):")
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, `cw_edit_set_amount_${id}`);
      return;
    }

    if (data.startsWith("cw_edit_slip_")) {
      const id = parseInt(data.replace("cw_edit_slip_", ""));
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("📊 Enter slippage % (e.g. 50):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, `cw_edit_set_slip_${id}`);
      return;
    }

    if (data.startsWith("cw_edit_gas_")) {
      const id = parseInt(data.replace("cw_edit_gas_", ""));
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("⛽ Enter gas fee in SOL (e.g. 0.005):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, `cw_edit_set_gas_${id}`);
      return;
    }
    if (data === "copy_wallet_pause_all") {
      const cws = db.getCopyWallets(userId);
      const anyActive = cws.some((w) => w.active);
      if (anyActive) {
        db.getDb()
          .prepare("UPDATE copy_wallets SET active = 0 WHERE user_id = ?")
          .run(userId);
        await ctx.answerCallbackQuery("⏸ All paused.");
      } else {
        db.getDb()
          .prepare("UPDATE copy_wallets SET active = 1 WHERE user_id = ?")
          .run(userId);
        await ctx.answerCallbackQuery("▶ All resumed.");
      }
      return safeEdit(
        ctx,
        `👛 *Copy Wallet*

📚 *Guide:*
➕ Add — add a wallet to copy
🟢 Active — tap to view details
⏸ Pause — stops copying trades
▶ Resume — starts copying again
🗑 Delete — remove permanently
⏸ Pause All — stop all at once
`,
        buildCopyWalletListMenu(db.getCopyWallets(userId)),
      );
    }
    if (data === "cw_confirm_add") {
      const addr = db.getSysConfig(`cw_pending_addr_${userId}`);
      const name = db.getSysConfig(`cw_pending_name_${userId}`) || null;
      const walletId = parseInt(db.getSysConfig(`cw_pending_wallet_${userId}`));
      const sol = parseFloat(
        db.getSysConfig(`cw_pending_sol_${userId}`) || "0.1",
      );
      const copySell = db.getSysConfig(`cw_pending_copysell_${userId}`) === "1";
      const slippage = parseFloat(
        db.getSysConfig(`cw_pending_slippage_${userId}`) || "50",
      );
      const gas = parseFloat(
        db.getSysConfig(`cw_pending_gas_${userId}`) || "0.005",
      );
      if (!addr) {
        await ctx.answerCallbackQuery("❌ No address set.");
        return;
      }
      db.getDb()
        .prepare(
          `INSERT INTO copy_wallets (user_id, wallet_address, label, sol_amount, mirror_sells, active, wallet_id, slippage, gas_fee, copy_sell)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          addr,
          name,
          sol,
          copySell ? 1 : 0,
          walletId || null,
          slippage,
          gas,
          copySell ? 1 : 0,
        );

      // Clear pending
      [
        `cw_pending_addr_`,
        `cw_pending_name_`,
        `cw_pending_wallet_`,
        `cw_pending_sol_`,
        `cw_pending_copysell_`,
        `cw_pending_slippage_`,
        `cw_pending_gas_`,
      ].forEach((k) => db.setSysConfig(k + userId, ""));
      await ctx.answerCallbackQuery("✅ Copy wallet added!");
      return safeEdit(
        ctx,
        `👛 *Copy Wallet*

📚 *Guide:*
➕ Add — add a wallet to copy
🟢 Active — tap to view details
⏸ Pause — stops copying trades
▶ Resume — starts copying again
🗑 Delete — remove permanently
⏸ Pause All — stop all at once
`,
        buildCopyWalletListMenu(db.getCopyWallets(userId)),
      );
    }
    // ── COPY CHANNEL ──────────────────────────────────────────
    if (data === "copy_channel_menu") {
      await ctx.answerCallbackQuery();
      const cc = db.getCopyChannels(userId);
      const guide =
        `📡 *Copy Channel*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📚 *GUIDE:*\n\n` +
        `➕ *Add* — add a channel to follow\n` +
        `🟢 *Active* — tap to view/edit settings\n` +
        `⏸ *Pause* — stop copying from channel\n` +
        `▶ *Resume* — start copying again\n` +
        `🗑 *Delete* — remove permanently\n\n` +
        `💡 *HOW IT WORKS:*\n` +
        `Add any Telegram channel.\n` +
        `When a token CA is posted there,\n` +
        `bot auto-buys using your settings.\n` +
        `━━━━━━━━━━━━━━━━━━━`;
      return safeEdit(ctx, guide, buildCopyChannelListMenu(cc));
    }

    if (data === "copy_channel_add") {
      await ctx.answerCallbackQuery();
      return safeEdit(
        ctx,
        `📡 *Add Copy Channel*\n\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `*How to add your channel:*\n\n` +
          `*Step 1 — Add bot as admin*\n` +
          `Add @hawkx\\_devnet\\_fazle\\_bot as admin to your channel\\.\n` +
          `_Required for private channels_\n\n` +
          `*Step 2 — Link your channel*\n` +
          `Choose one method below:\n` +
          `━━━━━━━━━━━━━━━━━━━`,
        {
          inline_keyboard: [
            [
              {
                text: "📨 Forward a Message",
                callback_data: "cch_add_forward",
              },
            ],
            [
              {
                text: "🔤 Send @channelname",
                callback_data: "cch_add_username",
              },
            ],
            [{ text: "🔢 Paste Channel ID", callback_data: "cch_add_id" }],
            [{ text: "← Back", callback_data: "copy_channel_menu" }],
          ],
        },
      );
    }

    if (data === "cch_add_forward") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        `📨 *Forward a Message*\n\n` +
          `📢 *Public channel:*\n` +
          `Just forward any message — no setup needed.\n\n` +
          `🔒 *Private channel:*\n` +
          `First add \`@hawkx_devnet_fazle_bot\` as admin, then forward a message.\n\n` +
          `Forward a message now:`,
        { parse_mode: "Markdown" },
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "copy_channel_forward");
      return;
    }

    if (data === "cch_add_username") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        "🔤 Send the channel username (e.g. @HotTokens):",
        { parse_mode: "Markdown" },
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "copy_channel_id");
      return;
    }

    if (data === "cch_add_id") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        "🔢 Paste the channel ID (e.g. -1001234567890):",
        { parse_mode: "Markdown" },
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "copy_channel_numeric_id");
      return;
    }



    if (data.startsWith("copy_channel_view_")) {
      const id = parseInt(data.replace("copy_channel_view_", ""));
      const ch = db.getCopyChannel(id, userId);
      if (!ch) { await ctx.answerCallbackQuery("Not found."); return; }
      await ctx.answerCallbackQuery();
      const name = stripMd(ch.channel_name || ch.channel_id);
      const chMsg = `📡 *${name}*\n\nStatus: ${ch.status === "active" ? "🟢 Active" : "⏸ Paused"}\nSignals: *${ch.signals_caught||0}* | Trades: *${ch.trades_executed||0}*\n\n💰 Buy: *${ch.buy_amount||0.1} SOL*\n📊 Slip: *${ch.slippage||50}%*\n⛽ Gas: *${ch.tip||0.005} SOL*\n🛡 MEV: *${ch.mev_protection ? "ON ✅" : "OFF ❌"}*\n🤖 Auto Sell: *${ch.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*`;
      try {
        await ctx.editMessageText(chMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) });
        const msgId = ctx.callbackQuery?.message?.message_id;
        if (msgId) db.setSysConfig(`ch_view_msg_${userId}`, String(msgId));
      } catch {
        const s = await ctx.reply(chMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) });
        db.setSysConfig(`ch_view_msg_${userId}`, String(s.message_id));
      }
      return;
    }

    if (data.startsWith("copy_channel_toggle_")) {
      const id = parseInt(data.replace("copy_channel_toggle_", ""));
      const ch = db.getCopyChannel(id, userId);
      if (!ch) {
        await ctx.answerCallbackQuery("Not found.");
        return;
      }
      const newStatus = ch.status === "active" ? "paused" : "active";
      db.updateCopyChannel(userId, id, { status: newStatus });
      await ctx.answerCallbackQuery(
        newStatus === "active" ? "▶ Resumed" : "⏸ Paused",
      );
      const updated = db.getCopyChannel(id, userId);
      const name = stripMd(updated.channel_name || updated.channel_id);
      const sl2 = updated.stop_loss_pct || 0;
      const tp2 = updated.take_profit_pct || 0;
      return safeEdit(
        ctx,
        `📡 *${name}*\n\n` +
          `Status: ${updated.status === "active" ? "🟢 Active" : "⏸ Paused"}\n` +
          `Signals caught: *${updated.signals_caught || 0}*\n` +
          `Trades executed: *${updated.trades_executed || 0}*\n\n` +
          `💰 Buy: *${updated.buy_amount || 0.1} SOL*\n` +
          `📊 Slippage: *${updated.slippage || 50}%*\n` +
          `⛽ Gas: *${updated.tip || 0.005} SOL*\n` +
          `🛑 SL: *${sl2 === 0 ? "OFF" : sl2 + "%"}*\n` +
          `🎯 TP: *${tp2 === 0 ? "OFF" : tp2 + "%"}*\n` +
          `🤖 Auto Sell: *Coming Soon*\n` +
          `🛡 MEV: *${updated.mev_protection ? "ON ✅" : "OFF ❌"}*\n\n` +
          `_Tap any button to change:_`,
        buildCopyChannelSettingsMenu(updated),
      );
    }

    if (data.startsWith("copy_channel_activate_")) {
      const id = parseInt(data.replace("copy_channel_activate_", ""));
      db.updateCopyChannel(userId, id, { status: "active" });
      await ctx.answerCallbackQuery("✅ Channel activated!");
      return safeEdit(
        ctx,
        `📡 *Copy Channel*\n\n${getGuide("copy_channel")}`,
        buildCopyChannelListMenu(db.getCopyChannels(userId)),
      );
    }

    if (data.startsWith("copy_channel_delete_")) {
      const id = parseInt(data.replace("copy_channel_delete_", ""));
      db.deleteCopyChannel(userId, id);
      await ctx.answerCallbackQuery("🗑 Deleted.");
      const guideMsg = `📡 *Copy Channel*

${getGuide("copy_channel")}`;
      try { await ctx.editMessageText(guideMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelListMenu(db.getCopyChannels(userId)) }); }
      catch { await ctx.reply(guideMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelListMenu(db.getCopyChannels(userId)) }); }
    }
    if (data === "cch_autosell_toggle_setup") {
      const asOn = db.getSysConfig(`cw_pending_autosell_${userId}`) === "1";
      db.setSysConfig(`cw_pending_autosell_${userId}`, asOn ? "0" : "1");
      if (!asOn) db.setSysConfig(`cw_pending_copysell_${userId}`, "0");
      await ctx.answerCallbackQuery(asOn ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅");
      const templates = db.getAutoSellTemplates(userId);
      const tplId = parseInt(db.getSysConfig(`cw_pending_autosell_tpl_${userId}`) || "0");
      const newAsOn = !asOn;
      const { buildChannelAutoSellScreen } = require("../keyboards");
      const fakeChannel = { id: "setup", auto_sell_enabled: newAsOn ? 1 : 0, auto_sell_template_id: tplId, channel_name: "Copy Wallet Setup" };
      try { await ctx.editMessageReplyMarkup({ reply_markup: buildChannelAutoSellScreen(fakeChannel, templates) }); } catch {}
      return;
    }

    if (data.startsWith("cch_autosell_use_setup_")) {
      const tId = parseInt(data.replace("cch_autosell_use_setup_", ""));
      const current = parseInt(db.getSysConfig(`cw_pending_autosell_tpl_${userId}`) || "0");
      const newId = current === tId ? 0 : tId;
      db.setSysConfig(`cw_pending_autosell_tpl_${userId}`, String(newId));
      await ctx.answerCallbackQuery(newId ? "✅ Selected!" : "◻️ Deselected!");
      const templates = db.getAutoSellTemplates(userId);
      const asOn = db.getSysConfig(`cw_pending_autosell_${userId}`) === "1";
      const { buildChannelAutoSellScreen } = require("../keyboards");
      const fakeChannel = { id: "setup", auto_sell_enabled: asOn ? 1 : 0, auto_sell_template_id: newId, channel_name: "Copy Wallet Setup" };
      try { await ctx.editMessageText(
        `🤖 *Auto Sell — Copy Wallet Setup*\n\nSelect a template to use for this wallet.`,
        { parse_mode: "Markdown", reply_markup: buildChannelAutoSellScreen(fakeChannel, templates) }
      ); } catch {}
      return;
    }

    if (data === "cch_autosell_setup" || data === "cch_autosell_new_setup") {
      if (data === "cch_autosell_new_setup") {
        db.setSysConfig(`ast_return_to_${userId}`, "cw_setup_autosell_back");
        await ctx.answerCallbackQuery();
        const newId = db.createAutoSellTemplate(userId, "New Template");
        db.setSysConfig(`ast_unsaved_${userId}`, String(newId));
        const t = db.getAutoSellTemplate(userId, newId);
        const { buildAutoSellTemplateScreen } = require("../keyboards");
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
        db.setSysConfig(`ast_msg_${userId}`, String(sent.message_id));
        return;
      }
      await ctx.answerCallbackQuery();
      return showCwSetupScreen(ctx, userId);
    }
    if (data.startsWith("cch_autosell_")) {
      const parts = data.split("_");

      // Toggle ON/OFF
      if (data.startsWith("cch_autosell_toggle_")) {
        const id = parseInt(data.replace("cch_autosell_toggle_", ""));
        const ch = db.getCopyChannel(id, userId);
        if (!ch) {
          await ctx.answerCallbackQuery("Not found.");
          return;
        }
        db.updateCopyChannel(userId, id, {
          auto_sell_enabled: ch.auto_sell_enabled ? 0 : 1,
        });
        await ctx.answerCallbackQuery(
          ch.auto_sell_enabled ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅",
        );
        const { buildChannelAutoSellScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: buildChannelAutoSellScreen(
              db.getCopyChannel(id, userId),
              templates,
            ),
          });
        } catch {}
        return;
      }

      // Open auto sell screen
      if (
        data.startsWith("cch_autosell_") &&
        !data.startsWith("cch_autosell_use_") &&
        !data.startsWith("cch_autosell_new_") &&
        !data.startsWith("cch_autosell_toggle_")
      ) {
        const id = parseInt(data.replace("cch_autosell_", ""));
        const ch = db.getCopyChannel(id, userId);
        if (!ch) {
          await ctx.answerCallbackQuery("Not found.");
          return;
        }
        await ctx.answerCallbackQuery();
        const { buildChannelAutoSellScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try {
          await ctx.editMessageText(
            `📡 *${ch.channel_name || ch.channel_id} — Auto Sell*\n\n` +
              `Select a template to use for this channel.\n` +
              `Each channel can have its own template.`,
            {
              parse_mode: "Markdown",
              reply_markup: buildChannelAutoSellScreen(ch, templates),
            },
          );
        } catch {}
        return;
      }

      // Select template
      if (data.startsWith("cch_autosell_use_")) {
        const withoutPrefix = data.replace("cch_autosell_use_", "");
        const lastIdx = withoutPrefix.lastIndexOf("_");
        const chId = parseInt(withoutPrefix.slice(0, lastIdx));
        const tId = parseInt(withoutPrefix.slice(lastIdx + 1));
        db.updateCopyChannel(userId, chId, { auto_sell_template_id: tId });
        await ctx.answerCallbackQuery("✅ Template selected!");
        const { buildChannelAutoSellScreen } = require("../keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try {
          await ctx.editMessageReplyMarkup({
            reply_markup: buildChannelAutoSellScreen(
              db.getCopyChannel(chId, userId),
              templates,
            ),
          });
        } catch {}
        return;
      }

      // New template from channel screen
      if (data.startsWith("cch_autosell_new_")) {
        const id = parseInt(data.replace("cch_autosell_new_", ""));
        db.setSysConfig(`ast_return_to_${userId}`, `cch_autosell_${id}`);
        await ctx.answerCallbackQuery();
        const newId = db.createAutoSellTemplate(userId, "New Template");
        db.setSysConfig(`ast_unsaved_${userId}`, String(newId));
        const t = db.getAutoSellTemplate(userId, newId);
        const { buildAutoSellTemplateScreen } = require("../keyboards");
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
        db.setSysConfig(`ast_msg_${userId}`, String(sent.message_id));
        return;
      }

      await ctx.answerCallbackQuery();
      return;
    }
    if (data === "copy_channel_pause_all") {
      const ccs = db.getCopyChannels(userId);
      const anyActive = ccs.some((c) => c.status === "active");
      if (anyActive) {
        db.getDb()
          .prepare(
            "UPDATE copy_channels SET status = 'paused' WHERE user_id = ?",
          )
          .run(userId);
        await ctx.answerCallbackQuery("⏸ All paused.");
      } else {
        db.getDb()
          .prepare(
            "UPDATE copy_channels SET status = 'active' WHERE user_id = ?",
          )
          .run(userId);
        await ctx.answerCallbackQuery("▶ All resumed.");
      }
      const guide =
        `📡 *Copy Channel*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📚 *GUIDE:*\n\n` +
        `➕ *Add* — add a channel to follow\n` +
        `🟢 *Active* — tap to view/edit settings\n` +
        `⏸ *Pause* — stop copying from channel\n` +
        `▶ *Resume* — start copying again\n` +
        `🗑 *Delete* — remove permanently\n\n` +
        `💡 *HOW IT WORKS:*\n` +
        `Add any Telegram channel.\n` +
        `When a token CA is posted there,\n` +
        `bot auto-buys using your settings.\n` +
        `━━━━━━━━━━━━━━━━━━━`;
      return safeEdit(
        ctx,
        guide,
        buildCopyChannelListMenu(db.getCopyChannels(userId)),
      );
    }

    if (data.startsWith("cch_")) {
      const parts = data.split("_");
      const action = parts[1];
      const id = parseInt(parts[parts.length - 1]);
      const ch = db.getCopyChannel(id, userId);
      if (!ch) {
        await ctx.answerCallbackQuery("Not found.");
        return;
      }

      const toggleMap = {
        mev: "mev_protection",
        autosell: "auto_sell_enabled",
        mint: "mint_auth_revoked",
        freeze: "freeze_auth_revoked",
      };

      if (toggleMap[action]) {
        const field = toggleMap[action];
        const newVal = ch[field] ? 0 : 1;
        db.updateCopyChannel(userId, id, { [field]: newVal });
        await ctx.answerCallbackQuery(`✅ Updated`);
        const updated = db.getCopyChannel(id, userId);
        const updName = stripMd(updated.channel_name || updated.channel_id);
        const updMsg = `📡 *${updName}*\n\nStatus: ${updated.status==="active"?"🟢 Active":"⏸ Paused"}\nSignals: *${updated.signals_caught||0}* | Trades: *${updated.trades_executed||0}*\n\n💰 Buy: *${updated.buy_amount||0.1} SOL*\n📊 Slip: *${updated.slippage||50}%*\n⛽ Gas: *${updated.tip||0.005} SOL*\n🛡 MEV: *${updated.mev_protection?"ON ✅":"OFF ❌"}*\n🤖 Auto Sell: *${updated.auto_sell_enabled?"ON ✅":"OFF ❌"}*`;
        const chMsgId2 = parseInt(db.getSysConfig(`ch_view_msg_${userId}`) || "0");
        try {
          if (chMsgId2) await ctx.api.editMessageText(ctx.chat.id, chMsgId2, updMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(updated) });
          else { await ctx.editMessageText(updMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(updated) }); }
        } catch { await ctx.reply(updMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(updated) }); }
        return;
      }

      const promptMap = {
        buy: {
          pending: `cch_set_buy_${id}`,
          msg: "Enter buy amount SOL (e.g. 0.1):",
        },
        slip: {
          pending: `cch_set_slip_${id}`,
          msg: "Enter slippage % (e.g. 50):",
        },
        tip: {
          pending: `cch_set_tip_${id}`,
          msg: "Enter Jito tip SOL (e.g. 0.0075):",
        },
        sl: {
          pending: `cch_set_sl_${id}`,
          msg: "Enter stop loss % (negative, e.g. -30) or 0:",
        },
        tp: {
          pending: `cch_set_tp_${id}`,
          msg: "Enter take profit % (e.g. 100) or 0:",
        },
        maxbuys: {
          pending: `cch_set_maxbuys_${id}`,
          msg: "Enter max buys per signal (e.g. 1):",
        },
      };

      if (promptMap[action]) {
        await ctx.answerCallbackQuery();
        const msg = await ctx.reply(promptMap[action].msg);
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, promptMap[action].pending);
        return;
      }

      await ctx.answerCallbackQuery();
      return;
    }


    return false;
}

module.exports = { handleCopyTradeCallbacks };
