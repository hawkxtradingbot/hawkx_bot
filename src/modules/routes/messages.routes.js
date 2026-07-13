const db = require("../../../database");
let _buildCwScreen = null;
function getBuildCwScreen() { if (!_buildCwScreen) { const m = require("./callbacks.copytrade"); _buildCwScreen = m.buildCwScreen; } return _buildCwScreen; }
const { buildLaunchMsg, showCwSetupScreen, safeReply, safeEdit, deleteUserMsg, buildReferralScreen, refreshMsnipeScreen, buildTokenOrdersScreen, showLimitOrdersScreen, stripMd } = require("./helpers.routes");
const { handleTextInput } = require("../settings/index");
const { handleAdminTextInput, isAdmin } = require("../admin");
const { isSolanaAddress } = require("../walletVault");
const { getBalance } = require("../walletSwitcher");
const { buildMainMenu, buildSniperMainMenu, buildSniperConfigMenu, buildRealtimeSnipeMenu, buildMigrationSniperMenu, getGuide, buildCopyChannelSettingsMenu } = require("../keyboards");
const { getTokenInfo, getTokenSafety, formatSafetyCard, formatAge, formatNum, formatPrice } = require("../tokenInfo");
const { handleAutoBuy, executeRealtimeSnipe, mockBuy, mockSell } = require("../executor");

async function deleteMsg(ctx, msgId) {
  if (!msgId) return;
  try {
    await ctx.api.deleteMessage(ctx.chat.id, msgId);
  } catch {}
}


function buildChDetailMsg(ch) {
  const nm = (ch.channel_name || ch.channel_id).replace(/([_*\[\]()~`>#+=|{}.!-])/g, "\\$1");
  return `📡 *${nm}*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Auto-buys any CA posted in channel\n▸ Filters block weak/risky signals\n▸ All settings auto-save instantly\n━━━━━━━━━━━━━━━━━━━\n\nStatus: ${ch.status === "active" ? "🟢 Active" : "⏸ Paused"}\nSignals: *${ch.signals_caught||0}* | Trades: *${ch.trades_executed||0}* | Skipped: *${ch.skipped_signals||0}*\n\n💰 Buy: *${ch.buy_amount||0.1} SOL*\n📊 Slippage: *${ch.slippage||50}%*\n⛽ Gas: *${ch.tip||0.005} SOL*\n🛡 MEV: *${ch.mev_protection ? "ON ✅" : "OFF ❌"}*\n🤖 Auto Sell: *${ch.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*`;
}

function setupMessages(bot) {
    bot.on("message:photo", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const pending = db.getSysConfig(`pending_${userId}`) || "";
    // Admin broadcast with photo
    if (pending === "admin_broadcast" && isAdmin(userId)) {
      await handleAdminTextInput(ctx, "admin_broadcast");
      return;
    }
    if (pending === "launch_image_input") {
      const promptId = parseInt(db.getSysConfig(`prompt_msg_${userId}`) || "0");
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      try { if (promptId) await ctx.api.deleteMessage(ctx.chat.id, promptId); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const fileId = ctx.message.photo[ctx.message.photo.length-1].file_id;
      db.setSysConfig(`launch_f_image_${userId}`, fileId);
      const { buildLaunchForm } = require("./helpers.routes");
      const { msg, kb } = buildLaunchForm(userId);
      const fMsgId = parseInt(db.getSysConfig(`launch_form_msg_${userId}`) || "0");
      try {
        if (fMsgId) await ctx.api.editMessageText(ctx.chat.id, fMsgId, msg, { parse_mode: "Markdown", reply_markup: kb });
        else await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
      } catch { await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb }); }
      return;
    }
    if (pending === "launch_image") {
      const promptId = parseInt(db.getSysConfig(`prompt_msg_${userId}`) || "0");
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      try { if (promptId) await ctx.api.deleteMessage(ctx.chat.id, promptId); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const fileId = ctx.message.photo[ctx.message.photo.length-1].file_id;
      db.setSysConfig(`launch_image_${userId}`, fileId);

      const { getLaunchPending, buildLaunchScreen } = require("../launch");
      const p = getLaunchPending(userId);
      const launchMsgId = parseInt(db.getSysConfig(`launch_msg_${userId}`) || "0");
      const pName = p.platform === "pump" ? "🌊 Pump.fun" : "🦅 HawkX";
      const { msg: imgMsg, kb: imgKb } = await buildLaunchMsg(userId, false);
      try {
        if (launchMsgId) await ctx.api.editMessageText(ctx.chat.id, launchMsgId, imgMsg, { parse_mode: "Markdown", reply_markup: imgKb });
        else { const s = await ctx.reply(imgMsg, { parse_mode: "Markdown", reply_markup: imgKb }); db.setSysConfig(`launch_msg_${userId}`, String(s.message_id)); }
      } catch { const s = await ctx.reply(imgMsg, { parse_mode: "Markdown", reply_markup: imgKb }); db.setSysConfig(`launch_msg_${userId}`, String(s.message_id)); }
    }
  });

  // Admin broadcast with video / gif / document
  bot.on(["message:video", "message:animation", "message:document"], async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const pending = db.getSysConfig(`pending_${userId}`) || "";
    if (pending === "admin_broadcast" && isAdmin(userId)) {
      await handleAdminTextInput(ctx, "admin_broadcast");
      return;
    }
  });

  bot.on("message:text", async (ctx) => {
      
      // Handle forwards
      if (ctx.message?.forward_origin || ctx.message?.forward_from_chat) {
        const pending2 = db.getSysConfig(`pending_${ctx.from.id}`) || "";
        if (pending2 === "copy_channel_forward") {
          const user2 = db.getUser(ctx.from.id);
          if (!user2) return;
          const promptId2 = parseInt(db.getSysConfig(`prompt_msg_${ctx.from.id}`) || "0");
          try { await ctx.api.deleteMessage(ctx.chat.id, promptId2); } catch {}
          try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
          db.setSysConfig(`pending_${ctx.from.id}`, "");
          const fwd = ctx.message.forward_origin || ctx.message.forward_from_chat;
          const channelId   = String(fwd.chat?.id || fwd.id || "");
          const channelName = stripMd(fwd.chat?.title || fwd.title || channelId);
          if (!channelId) { await ctx.reply("❌ Could not detect channel."); return; }
          db.addCopyChannel(ctx.from.id, channelId, channelName, {});
          const channels = db.getCopyChannels(ctx.from.id);
          const newCh = channels.find(c => c.channel_id === channelId) || channels[0];
          await ctx.reply(`✅ *${channelName}* added!`, { parse_mode: "Markdown" });
          if (newCh) { const s = await ctx.reply(buildChDetailMsg(newCh), { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(newCh) }); db.setSysConfig(`ch_view_msg_${ctx.from.id}`, String(s.message_id)); }
        }
        return;
      }
      const userId = ctx.from.id;
    const user = db.getUser(userId);
    if (!user) {
      await ctx.reply("Please /start first.");
      return;
    }
  
    const pending = db.getSysConfig(`pending_${userId}`) || "";
    const text = ctx.message.text.trim();
    
    const ks = require("../killSwitch").isActive();
    const promptId = parseInt(db.getSysConfig(`prompt_msg_${userId}`) || "0");

    // ── Global CA escape hatch ──────────────────────────────────
    // If the user pastes a full valid Solana CA while stuck in some other
    // input flow, treat it as "scan this token" and jump to the scanner.
    // EXCLUDES flows where pasting a CA is the expected input (they handle it themselves).
    const caPasteFlows = ["lo_paste_ca", "dca_paste_ca", "cw_paste_wallet", "cch_paste", "snipe_paste_ca", "watchlist_add_ca", "launch_paste_ca", "referral_enter_code", "referral_customize_code", "admin_track_add"];
    // Prefix-based flows where the expected input is a destination/withdraw address, NOT a token CA -
    // must be excluded too, since withdraw addresses are the same base58 length/format as a token CA.
    const caPastePrefixes = ["withdraw_address_", "withdraw_customamt_"];
    if (
      pending &&
      !caPasteFlows.includes(pending) &&
      !caPastePrefixes.some(p => pending.startsWith(p)) &&
      !pending.startsWith("admin_") &&
      text.length >= 43 && text.length <= 44 &&
      /^[1-9A-HJ-NP-Za-km-z]+$/.test(text) &&
      !ks
    ) {
      // Clear stuck state + clean up the prompt message, then show scanner
      db.setSysConfig(`pending_${userId}`, "");
      if (promptId) { try { await ctx.api.deleteMessage(ctx.chat.id, promptId); } catch {} }
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      const autoBought = await handleAutoBuy(ctx, user, text);
      if (autoBought) return;
      const { showTokenScanner } = require("./helpers.routes");
      await showTokenScanner(ctx, user, text);
      return;
    }

    const settingsPending = [
      "set_slippage",
      "set_sell_slippage",
      "set_stoploss",
      "set_takeprofit",
      "set_maxbuy",
      "set_session",
      "set_jito",
      "set_custom_speed",
      "set_buy_amt_1",
      "set_buy_amt_2",
      "set_buy_amt_3",
      "set_sell_pct_1",
      "set_sell_pct_2",
      "set_sell_pct_3",
      "sap_set_new",
      "sap_confirm",
      "sap_verify_change",
      "ab_set_amount",
        "ab_set_slippage",
        "ab_set_gas",
        "ab_set_max",
        "ast_set_name","ast_set_sl","ast_set_sl_pct","ast_set_tp","ast_set_tp_pct",
        "cw_edit_set_amount_","cw_edit_set_slip_","cw_edit_set_gas_","cw_edit_set_max_","cw_edit_set_min_","cw_edit_set_pct_","cw_edit_set_delay_",
        "cch_autosell_new_","sap_verify_export","sap_verify_remove",
      "alert_add_ca", "alert_add_target", "alert_add_price_val", "alert_add_mcap_val", "tracker_add_address",
      "buy_custom_amount", "set_daily_loss", "set_daily_trades", "set_max_pos",
      ];
    if (pending === "cw_max" || pending === "cw_min" || pending === "cw_pct" || pending === "cw_delay") {
      const val = pending === "cw_pct" ? Math.min(100,Math.max(1,parseFloat(text))) : Math.max(0,parseFloat(text));
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (!isNaN(val)) {
        if (pending === "cw_max") db.setSysConfig(`cw_pending_max_${userId}`, String(val));
        if (pending === "cw_min") db.setSysConfig(`cw_pending_min_${userId}`, String(val));
        if (pending === "cw_pct") db.setSysConfig(`cw_pending_pct_${userId}`, String(val));
        if (pending === "cw_delay") db.setSysConfig(`cw_pending_delay_${userId}`, String(val));
      }
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }

      if (settingsPending.includes(pending)) {
      const freshUser = db.getUser(userId);
      return handleTextInput(ctx, freshUser, pending);
    }

    if (pending === "wallet_rename") {
      await deleteMsg(ctx, promptId);
      const freshUser2 = db.getUser(userId);
      const newName = text.trim().slice(0, 20);
      if (!newName) { await ctx.reply("❌ Name cannot be empty."); return; }
      db.getDb().prepare("UPDATE wallets SET label = ? WHERE wallet_id = ? AND user_id = ?").run(newName, freshUser2.active_wallet_id, userId);
      db.setSysConfig(`pending_${userId}`, "");
      await ctx.reply(`✅ Renamed to *${newName}*`, { parse_mode: "Markdown" });
      // Auto refresh wallet screen
      const { showWalletScreen } = require("./callbacks.wallet");
      const freshUser3 = db.getUser(userId);
      await showWalletScreen(ctx, userId, freshUser3.active_wallet_id);
      return;
    }

    if (pending === "wallet_import_key") {
      db.setSysConfig(`pending_${userId}`, "");
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      const activeChain = db.getActiveChain(userId);
      if (activeChain === "SOL") {
        await addWallet(ctx, user, text);
      } else {
        try {
          const { importEvmWallet } = require("../chains/evm/wallet");
          const chainCfg = db.getChainConfig(activeChain);
          const count = (db.getWallets(userId) || []).filter(w => (w.chain||"SOL") === activeChain).length;
          const result = await importEvmWallet(userId, activeChain, text, `W${count + 1}`);
          await ctx.reply(
            `✅ *Wallet Imported!*\n\n🏷 Label: *W${count + 1}* (${chainCfg?.label})\n📋 Address:\n\`${result.address}\`\n\n💡 Tap the address to copy it.`,
            { parse_mode: "Markdown" }
          );
        } catch (e) {
          await ctx.reply("❌ Invalid private key for this chain. Please send a valid key (0x... hex format for EVM chains).");
        }
      }
      return;
    }

    if (pending === "sap_verify_withdraw") {
      db.setSysConfig(`pending_${userId}`, "");
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      const freshUser = db.getUser(userId);
      const valid = freshUser.sap_hash
        ? await bcrypt.compare(text, freshUser.sap_hash)
        : true;
      if (!valid) {
        await ctx.reply("❌ Incorrect PIN. Cancelled.");
        return;
      }
      const nextAction = db.getSysConfig(`sap_next_${userId}`);
      db.setSysConfig(`sap_next_${userId}`, "");
      if (nextAction) {
        const msg = await ctx.reply(
          `💸 *Withdraw*\n\nPaste destination Solana address:`,
          { parse_mode: "Markdown" },
        );
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, nextAction);
      }
      return;
    }

    if (pending === "buy_custom_amount") {
      const amt = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(amt) || amt <= 0) {
        await ctx.reply("❌ Invalid amount.");
        return;
      }
      db.setSysConfig(`buy_pending_sol_${userId}`, String(amt));
      db.setSysConfig(`pending_${userId}`, "buy_paste_ca");
      const msg = await ctx.reply(`💰 *${amt} SOL*\n\nPaste the token CA:`, {
        parse_mode: "Markdown",
      });
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      return;
    }

    if (pending.startsWith("launch_custom_buy_")) {
      const ca = pending.replace("launch_custom_buy_", "");
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const amt = parseFloat(text);
      if (isNaN(amt) || amt <= 0) { await ctx.reply("❌ Invalid amount."); return; }
      const lNameC = db.getSysConfig(`launch_symbol_${userId}`) || db.getSysConfig(`launch_name_${userId}`) || "";
      await mockBuy(ctx, user, ca, amt, "launch", "", { tokenName: lNameC });
      return;
    }

    if (pending.startsWith("launch_custom_sell_")) {
      const ca = pending.replace("launch_custom_sell_", "");
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const pct = parseInt(text);
      if (isNaN(pct) || pct <= 0 || pct > 100) { await ctx.reply("❌ Enter 1-100%."); return; }
      const pos = db.getDb().prepare("SELECT * FROM positions WHERE user_id = ? AND token_ca = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1").get(userId, ca);
      if (!pos) { await ctx.reply("❌ No position found!"); return; }
      const { mockSell } = require("../executor");
      await mockSell(ctx, user, pos, pct);
      return;
    }

    if (pending === "launch_bundle_amount") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const wId = db.getSysConfig(`launch_bundle_wid_${userId}`) || "";
      const amt = parseFloat(text.replace(/[^0-9.]/g, ""));
      if (isNaN(amt) || amt < 0) { await ctx.reply("❌ Enter a valid SOL amount."); return; }
      let amounts = {}; try { amounts = JSON.parse(db.getSysConfig(`launch_f_bundleamounts_${userId}`) || "{}"); } catch {}
      amounts[wId] = amt;
      db.setSysConfig(`launch_f_bundleamounts_${userId}`, JSON.stringify(amounts));
      const { buildLaunchForm } = require("./helpers.routes");
      const { msg, kb } = buildLaunchForm(userId);
      const fMsgId = parseInt(db.getSysConfig(`launch_form_msg_${userId}`) || "0");
      if (fMsgId) { try { await ctx.api.editMessageText(ctx.chat.id, fMsgId, msg, { parse_mode: "Markdown", reply_markup: kb }); return; } catch {} }
      await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
      return;
    }

    if (pending === "launch_schedule_input") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
const t = text.trim().toLowerCase();
      let schedule = "";
      let whenDate = null;
      if (t === "now" || t === "0") {
        schedule = "";
      } else if (/^\d+[mhd]$/.test(t)) {
        // Relative: 30m, 2h, 7d
        const num = parseInt(t);
        const unit = t.slice(-1);
        const ms = unit === "h" ? num*3600000 : unit === "d" ? num*86400000 : num*60000;
        whenDate = new Date(Date.now() + ms);
      } else {
        // Absolute date: normalize "6am"->"6:00 am", add current year if missing
        let raw = text.trim().replace(/(\d)(am|pm)/i, "$1:00 $2");
        let parsed = new Date(raw);
        // If no year in input, default to current year (or next year if past)
        if (!/\d{4}/.test(raw) && !isNaN(parsed.getTime())) {
          const now = new Date();
          parsed.setFullYear(now.getFullYear());
          if (parsed.getTime() < now.getTime()) parsed.setFullYear(now.getFullYear() + 1);
        }
        if (!isNaN(parsed.getTime())) {
          whenDate = parsed;
        } else {
          await ctx.reply("❌ Couldn't read that time.\n\nTry:\n• 2h or 30m (relative)\n• July 7 6am\n• Dec 25 8:00 PM\n• now"); return;
        }
      }
      if (whenDate) {
        if (whenDate.getTime() < Date.now()) { await ctx.reply("❌ That time is in the past. Pick a future time."); return; }
        schedule = whenDate.toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit", hour12:true });
      }
      db.setSysConfig(`launch_f_schedule_${userId}`, schedule);
      const { buildLaunchForm } = require("./helpers.routes");
      const { msg, kb } = buildLaunchForm(userId);
      const fMsgId = parseInt(db.getSysConfig(`launch_form_msg_${userId}`) || "0");
      if (fMsgId) { try { await ctx.api.editMessageText(ctx.chat.id, fMsgId, msg, { parse_mode: "Markdown", reply_markup: kb }); return; } catch {} }
      await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
      return;
    }

    if (pending === "launch_field_input") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const field = db.getSysConfig(`launch_field_${userId}`) || "";
      let val = text.trim();
      if (field === "symbol") val = val.replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase();
      if (field === "treasury") {
        const tw = text.trim();
        if (tw.toLowerCase() === "skip") val = "";
        else if (tw.length < 32 || tw.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(tw)) { await ctx.reply("❌ Invalid Solana address (or send 'skip')."); return; }
        else val = tw;
      } else if (["supply","grad","devbuy","maxwallet","bundleper","antisnipe","buyback","initprice","vestpct","vestcliff","decimals","teamalloc","creatorfee"].includes(field)) {
        const n = parseFloat(val.replace(/[^0-9.]/g, ""));
        if (isNaN(n) || n < 0) { await ctx.reply("❌ Enter a valid number."); return; }
        if (["supply","antisnipe","vestcliff","decimals"].includes(field)) val = String(Math.floor(n));
        else val = String(n);
        if (field === "decimals" && (parseInt(val) > 18)) { await ctx.reply("❌ Decimals must be 0-18 (9 is standard)."); return; }
      }
      db.setSysConfig(`launch_f_${field}_${userId}`, val);
      const { buildLaunchForm } = require("./helpers.routes");
      const { msg, kb } = buildLaunchForm(userId);
      const fMsgId = parseInt(db.getSysConfig(`launch_form_msg_${userId}`) || "0");
      if (fMsgId) { try { await ctx.api.editMessageText(ctx.chat.id, fMsgId, msg, { parse_mode: "Markdown", reply_markup: kb }); return; } catch {} }
      await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
      return;
    }

    if (pending === "launch_image_input") {
      await deleteMsg(ctx, promptId);
      db.setSysConfig(`pending_${userId}`, "");
      let imgUrl = "";
      if (ctx.message.photo && ctx.message.photo.length) {
        imgUrl = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      } else if (text && text.trim().startsWith("http")) {
        imgUrl = text.trim();
      }
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      if (!imgUrl) { await ctx.reply("❌ Send an image or a valid image URL."); return; }
      db.setSysConfig(`launch_f_image_${userId}`, imgUrl);
      const { buildLaunchForm } = require("./helpers.routes");
      const { msg, kb } = buildLaunchForm(userId);
      const fMsgId = parseInt(db.getSysConfig(`launch_form_msg_${userId}`) || "0");
      if (fMsgId) { try { await ctx.api.editMessageText(ctx.chat.id, fMsgId, msg, { parse_mode: "Markdown", reply_markup: kb }); return; } catch {} }
      await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
      return;
    }

    if (pending === "lo_paste_ca") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      // Validate Solana CA
      if (text.length < 32 || text.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(text)) {
        await ctx.reply("❌ Invalid CA. That's not a valid Solana address!\nSolana addresses are 32-44 characters, base58 only.");
        return;
      }
      const loType = db.getSysConfig(`lo_type_${userId}`) || "buy";
      // Deposit-first guard for BUY limit orders (sell orders need tokens, not SOL)
      if (loType === "buy") {
        const loUser = db.getUser(userId);
        const loAddr = (db.getWallet(loUser.active_wallet_id) || {}).public_key;
        const loBal = await db.getWalletBalance(loAddr);
        if (!loBal || loBal <= 0) {
          return ctx.reply("💰 *Deposit SOL first*\n\nYour wallet is empty. Add SOL in the Wallet menu before setting a buy limit order.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "💼 Go to Wallet", callback_data: "menu_wallets" }]] } });
        }
      }
      const tInfo = await getTokenInfo(text);
      const tName = tInfo?.name || text.slice(0,8);
      db.setSysConfig(`lo_pending_ca_${userId}`, text);
      db.setSysConfig(`lo_pending_name_${userId}`, tName);
      const { getMockPrice: gmp2 } = require("../executor");
      const mockP = gmp2(text);
      const priceStr = tInfo?.price ? formatPrice(tInfo.price) : `${mockP.toFixed(8)} [DEVNET]`;
      const dexUrl = `https://dexscreener.com/solana/${text}`;
      let info = `${loType === "buy" ? "🟢 Limit Buy" : "🔴 Limit Sell"} — <a href="${dexUrl}"><b>${tName}</b></a>\n\n`;
      info += `💲 Price: ${priceStr}\n`;
      if (tInfo?.mcap) info += `🧢 MCap: ${formatNum(tInfo.mcap)}\n`;
      if (tInfo?.liquidity) info += `💧 Liquidity: ${formatNum(tInfo.liquidity)}\n`;
      if (tInfo?.change24h) info += `📈 24h: ${tInfo.change24h > 0 ? "+" : ""}${tInfo.change24h.toFixed(1)}%\n`;
      info += `\nEnter target price or MC (e.g. 0.0005 / 50K / 1M):`;
      const m = await ctx.reply(info, { parse_mode: "HTML", disable_web_page_preview: true });
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "lo_set_price");
      return;
    }


    if (pending === "lo_set_sell_pct_direct") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const pct2 = parseFloat(text);
      if (isNaN(pct2) || pct2 <= 0 || pct2 > 100) { await ctx.reply("❌ Enter 1-100."); return; }
      db.setSysConfig(`lo_sell_pct_direct_${userId}`, String(pct2));
      const ca5 = db.getSysConfig(`lo_pending_ca_${userId}`) || "";
      const { getMockPrice: gmp5 } = require("../executor");
      const mp5 = gmp5(ca5);
      const m5 = await ctx.reply(`🔴 *Limit Sell ${pct2}%*\n\nPrice: ${mp5.toFixed(8)}\n\nEnter target price:`, { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(m5.message_id));
      db.setSysConfig(`pending_${userId}`, "lo_set_price_from_sell");
      return;
    }

    if (pending === "lo_set_price_from_sell") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const clean5 = text.trim().replace(/[$]/,"").toUpperCase();
      let price5 = 0, mcap5 = 0;
      if (clean5.endsWith("K")) { mcap5 = parseFloat(clean5) * 1000; }
      else if (clean5.endsWith("M")) { mcap5 = parseFloat(clean5) * 1000000; }
      else { const n5 = parseFloat(clean5); if (n5 >= 1000) mcap5 = n5; else price5 = n5; }
      if (price5 <= 0 && mcap5 <= 0) { await ctx.reply("Invalid value"); return; }
      const ca6 = db.getSysConfig(`lo_pending_ca_${userId}`) || "";
      const name6 = db.getSysConfig(`lo_pending_name_${userId}`) || "Token";
      const pct6 = parseFloat(db.getSysConfig(`lo_sell_pct_direct_${userId}`) || "100");
      db.addLimitOrder(userId, { tokenCa: ca6, tokenName: name6, orderType: "sell", targetPrice: price5, solAmount: 0, sellPct: pct6, targetMcap: mcap5, walletId: parseInt(db.getSysConfig(`lo_sel_wallet_${userId}`) || db.getUser(userId).active_wallet_id) });
      const savedMsgId6 = parseInt(db.getSysConfig(`lo_msg_${userId}`) || "0");
      return buildTokenOrdersScreen(ctx, userId, ca6, false, savedMsgId6);
    }

    if (pending === "lo_set_price") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");

      // Detect price vs mcap
      // MCap formats: 50000, 0K, 50K, 1M, .5M
      let targetPrice = 0;
      let targetMcap = 0;
      const clean = text.trim().replace(/$/, "").toUpperCase();

      if (clean.endsWith("K")) {
        targetMcap = parseFloat(clean) * 1000;
      } else if (clean.endsWith("M")) {
        targetMcap = parseFloat(clean) * 1000000;
      } else {
        const num = parseFloat(clean);
        if (num >= 1000) {
          targetMcap = num; // Large number = mcap
        } else {
          targetPrice = num; // Small number = price
        }
      }

      if (targetPrice <= 0 && targetMcap <= 0) { await ctx.reply("❌ Invalid value. Enter price (e.g. 0.0005) or mcap (e.g. 50K, 1M, 500000)"); return; }

      db.setSysConfig(`lo_price_${userId}`, String(targetPrice));
      db.setSysConfig(`lo_mcap_${userId}`, String(targetMcap));

      const loType2 = db.getSysConfig(`lo_type_${userId}`) || "buy";
      const label = targetMcap > 0 ? `MCap: ${targetMcap >= 1000000 ? (targetMcap/1000000).toFixed(1)+"M" : (targetMcap/1000).toFixed(0)+"K"}` : `Price: ${targetPrice}`;
      const m3 = await ctx.reply(`✅ Target set: *${label}*\n\n${loType2 === "buy" ? "💰 Enter SOL amount (e.g. 0.5):" : "🔴 Enter sell % (e.g. 50):"}`, { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(m3.message_id));
      db.setSysConfig(`pending_${userId}`, "lo_set_amount");
      return;
    }

    // ── DCA SETUP FLOW ──
    if (pending === "dca_paste_ca") {
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      await deleteMsg(ctx, promptId);
      const ca = text.trim();
      if (!ca || ca.length < 32) { await ctx.reply("❌ Invalid token CA. Try again."); return; }
      db.setSysConfig(`pending_${userId}`, "");
      // Deposit-first guard: block only if zero balance
      const dcaUser = db.getUser(userId);
      const dcaAddr = (db.getWallet(dcaUser.active_wallet_id) || {}).public_key;
      const dcaBal = await db.getWalletBalance(dcaAddr);
      if (!dcaBal || dcaBal <= 0) {
        return ctx.reply("💰 *Deposit SOL first*\n\nYour wallet is empty. Add SOL in the Wallet menu before setting up a DCA order.", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "💼 Go to Wallet", callback_data: "menu_wallets" }]] } });
      }
      db.setSysConfig(`dca_msg_${userId}`, ""); // fresh screen
      const { showTokenDca } = require("./callbacks.dca");
      return showTokenDca(ctx, userId, ca);
    }
    // ── DCA custom inputs (feed back into tap panel) ──
    if (pending === "dca_custom_amt") {
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      await deleteMsg(ctx, promptId);
      const v = parseFloat(text);
      if (isNaN(v) || v <= 0) { await ctx.reply("❌ Invalid amount."); return; }
      db.setSysConfig(`dca_draft_amt_${userId}`, String(v));
      db.setSysConfig(`pending_${userId}`, "");
      const { showTokenDca } = require("./callbacks.dca");
      return showTokenDca(ctx, userId, db.getSysConfig(`dca_setup_ca_${userId}`));
    }
    if (pending === "dca_custom_cnt") {
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      await deleteMsg(ctx, promptId);
      const v = parseInt(text);
      if (isNaN(v) || v < 2) { await ctx.reply("❌ Enter 2 or more."); return; }
      db.setSysConfig(`dca_draft_cnt_${userId}`, String(v));
      db.setSysConfig(`pending_${userId}`, "");
      const { showTokenDca } = require("./callbacks.dca");
      return showTokenDca(ctx, userId, db.getSysConfig(`dca_setup_ca_${userId}`));
    }
    if (pending === "dca_custom_int") {
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      await deleteMsg(ctx, promptId);
      db.setSysConfig(`pending_${userId}`, "");
      // Parse format: 30m / 2h / 1d / or plain number = hours
      const raw = text.trim().toLowerCase();
      let secs = 0;
      if (raw.endsWith("m")) secs = Math.round(parseFloat(raw) * 60);
      else if (raw.endsWith("h")) secs = Math.round(parseFloat(raw) * 3600);
      else if (raw.endsWith("d")) secs = Math.round(parseFloat(raw) * 86400);
      else secs = Math.round(parseFloat(raw) * 3600); // plain number = hours
      if (isNaN(secs) || secs < 60) { await ctx.reply("❌ Invalid interval. Min is 1m. Examples: 30m, 2h, 1d"); return; }
      db.setSysConfig(`dca_draft_int_${userId}`, String(secs));
      const { showTokenDca } = require("./callbacks.dca");
      return showTokenDca(ctx, userId, db.getSysConfig(`dca_setup_ca_${userId}`));
    }
    if (pending === "lo_set_amount") {
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      await deleteMsg(ctx, promptId);
      db.setSysConfig(`pending_${userId}`, "");
      const val = parseFloat(text);
      if (isNaN(val) || val <= 0) { await ctx.reply("❌ Invalid value."); return; }
      const loType3 = db.getSysConfig(`lo_type_${userId}`) || "buy";
      const price3 = parseFloat(db.getSysConfig(`lo_price_${userId}`) || "0");
      const ca3 = db.getSysConfig(`lo_pending_ca_${userId}`) || "";
      const name3 = db.getSysConfig(`lo_pending_name_${userId}`) || "Token";
      const loWalletId = parseInt(db.getSysConfig(`lo_sel_wallet_${userId}`) || db.getUser(userId).active_wallet_id);
      // ── PRE-TRADE VALIDATION ──
      // 1. Buy: check wallet balance
      if (loType3 === "buy") {
        const w = db.getWallets(userId).find(x => x.wallet_id === loWalletId);
        const bal = w ? parseFloat(db.getSysConfig(`mock_balance_${w.public_key}`) || "0") : 0;
        if (val > bal) {
          await ctx.reply(`⚠️ *Low Balance Warning*\n\nOrder amount: *${val} SOL*\nWallet balance: *${bal.toFixed(3)} SOL*\n\nThe order is saved, but it may fail to execute if balance is still low when triggered. Top up your wallet.`, { parse_mode: "Markdown" });
        }
      }
      // 2. Sell %: max 100
      if (loType3 === "sell" && val > 100) { await ctx.reply("❌ Sell % cannot exceed 100."); return; }
      // 3. Duplicate order check
      const existing = db.getLimitOrders(userId).filter(o =>
        o.token_ca === ca3 && o.order_type === loType3 && o.wallet_id === loWalletId &&
        ((price3 > 0 && Math.abs((o.target_price||0) - price3) < price3*0.001) ||
         (parseFloat(db.getSysConfig(`lo_mcap_${userId}`)||"0") > 0 && o.target_mcap === parseFloat(db.getSysConfig(`lo_mcap_${userId}`)||"0")))
      );
      if (existing.length) {
        await ctx.reply("⚠️ You already have a similar order for this token at this target. Order still saved — cancel duplicates if not needed.");
      }
      const tMcap = parseFloat(db.getSysConfig(`lo_mcap_${userId}`) || "0");
      db.addLimitOrder(userId, {
        tokenCa: ca3, tokenName: name3, orderType: loType3,
        targetPrice: price3,
        solAmount: loType3 === "buy" ? val : 0,
        sellPct: loType3 === "sell" ? val : 100,
        targetMcap: tMcap,
        walletId: parseInt(db.getSysConfig(`lo_sel_wallet_${userId}`) || db.getUser(userId).active_wallet_id),
      });
      // Clear stale msg id so the screen does a FRESH reply (not edit a deleted msg)
      db.setSysConfig(`lo_msg_${userId}`, "");
      const { buildTokenOrdersScreen: returnToTokenScreen } = require("./helpers.routes");
      return returnToTokenScreen(ctx, userId, ca3);
    }

    
    if (pending === "buy_paste_ca") {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const sol = parseFloat(
        db.getSysConfig(`buy_pending_sol_${userId}`) || "0.1",
      );
      await mockBuy(ctx, user, text, sol);
      return;
    }

    if (pending === "buy_paste_ca_first") {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (
        text.length < 32 ||
        text.length > 44 ||
        !/^[1-9A-HJ-NP-Za-km-z]+$/.test(text)
      ) {
        await ctx.reply(
          "❌ Invalid CA. Please paste a valid Solana token address.",
        );
        return;
      }
      // Check auto buy first
      const autoBought = await handleAutoBuy(ctx, user, text);
      if (autoBought) return;
      const { showTokenScanner } = require("./helpers.routes");
      await showTokenScanner(ctx, user, text);
      return;
    }

    // FIX #4 — buy_ca_custom_amt with CA expiry check
    if (pending === "buy_ca_custom_amt") {
      const amt = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(amt) || amt <= 0) {
        await ctx.reply("❌ Invalid amount.");
        return;
      }
      const ca = db.getSysConfig(`pending_ca_${userId}`);
      if (!ca) {
        await ctx.reply("❌ Please paste a token CA first.");
        return;
      }
      await mockBuy(ctx, user, ca, amt, "manual", "");
      return;
    }

    if (pending.startsWith("withdraw_customamt_")) {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const rest = pending.replace("withdraw_customamt_", "");
      const li = rest.lastIndexOf("_");
      const token = rest.slice(0, li);
      const walletId = parseInt(rest.slice(li + 1));
      const amt = parseFloat(text);
      if (isNaN(amt) || amt <= 0) {
        await ctx.reply("❌ *Invalid amount.* Enter a number like 0.5", { parse_mode: "Markdown" });
        return;
      }
      const freshUser = db.getUser(userId);
      const hasPIN = freshUser.sap_enabled && freshUser.sap_hash;
      const addr = db.getSysConfig(`withdraw_addr_${userId}`) || "";
      db.setSysConfig(`withdraw_pending_${userId}`, `${amt}SOL_${token}_${walletId}`);
      if (hasPIN) {
        const mm = await ctx.reply(
          `💸 *Confirm Withdraw* [DEVNET]\n\nSending *${amt} ${token}*\nTo:\n\`${addr}\`\n\n⚠️ Verify the address before confirming.\n\n🔐 Enter your Security PIN to confirm:`,
          { parse_mode: "Markdown" }
        );
        db.setSysConfig(`prompt_msg_${userId}`, String(mm.message_id));
        db.setSysConfig(`pending_${userId}`, "withdraw_confirm_pin");
      } else {
        await safeReply(ctx,
          `💸 *Confirm Withdraw* [DEVNET]\n\nSending *${amt} ${token}*\nTo:\n\`${addr}\`\n\n⚠️ Verify the address before confirming.\n\n⚠️ No Security PIN set.`,
          { inline_keyboard: [
            [{ text: "✅ Confirm Withdraw", callback_data: `withdraw_finalsend_${amt}SOL_${token}_${walletId}` }],
            [{ text: "🔐 Set PIN First", callback_data: "set_sap" }],
            [{ text: "← Cancel", callback_data: "wallet_withdraw" }],
          ]}
        );
      }
      return;
    }

    if (pending === "withdraw_confirm_pin") {
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}

      // Lockout check
      const lockUntil = parseInt(db.getSysConfig(`withdraw_lock_${userId}`) || "0");
      if (lockUntil && Date.now() < lockUntil) {
        const mins = Math.ceil((lockUntil - Date.now()) / 60000);
        db.setSysConfig(`pending_${userId}`, "");
        await ctx.reply(`🔒 *Withdrawals locked.*\n\nToo many wrong PIN attempts. Try again in ${mins} min.`, { parse_mode: "Markdown" });
        return;
      }

      const freshUser = db.getUser(userId);
      const bcrypt = require("bcryptjs");
      const valid = freshUser.sap_hash ? await bcrypt.compare(text, freshUser.sap_hash) : true;

      if (!valid) {
        let fails = parseInt(db.getSysConfig(`withdraw_pin_fails_${userId}`) || "0") + 1;
        db.setSysConfig(`withdraw_pin_fails_${userId}`, String(fails));
        if (fails >= 5) {
          // Lock 5 min + reset counter + security alert
          const until = Date.now() + 5 * 60 * 1000;
          db.setSysConfig(`withdraw_lock_${userId}`, String(until));
          db.setSysConfig(`withdraw_pin_fails_${userId}`, "0");
          db.setSysConfig(`pending_${userId}`, "");
          await ctx.reply(
            `🔒 *Security Alert — Withdraw Locked*\n\n5 incorrect PIN attempts on a withdrawal.\nWithdrawals are paused for 5 minutes.\n\nIf this was you — no problem, just wait and re-enter your PIN carefully.\n\nIf this was *NOT* you:\n⚠️ Someone may have access to this chat.\n• Your funds are still safe (they can't withdraw without your PIN)\n• Consider moving funds to a fresh wallet\n• Review who has access to your Telegram\n\nYour keys, your coins. HawkX never has access to your PIN or funds.`,
            { parse_mode: "Markdown" }
          );
          return;
        }
        // Inline retry (Option A) with icon + counter
        db.setSysConfig(`pending_${userId}`, "withdraw_confirm_pin");
        await ctx.reply(`🔑 *Incorrect PIN (${fails}/5).*\n\nTry again — enter your Security PIN:`, { parse_mode: "Markdown" });
        return;
      }

      // Correct PIN — reset counter + show Confirm button (don't auto-send)
      db.setSysConfig(`withdraw_pin_fails_${userId}`, "0");
      db.setSysConfig(`pending_${userId}`, "");
      const wp = db.getSysConfig(`withdraw_pending_${userId}`) || "";
      const parts = wp.split("_");
      const amtLabel = parts[0].endsWith("SOL") ? parts[0].replace("SOL", " SOL") : parts[0] + "%";
      const token = parts[1];
      const walletId = parts[2];
      const addr = db.getSysConfig(`withdraw_addr_${userId}`) || "";
      await ctx.reply(
        `✅ *PIN Verified*\n\n💸 Sending *${amtLabel}* of ${token}\nTo:\n\`${addr}\`\n\n⚠️ Verify the address — transfers can't be reversed.\n\nTap Confirm to send.`,
        { parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [
            [{ text: "✅ Confirm Withdraw", callback_data: `withdraw_finalsend_${parts[0]}_${token}_${walletId}` }],
            [{ text: "← Cancel", callback_data: "wallet_withdraw" }],
          ]}
        }
      );
      return;
    }

    if (pending.startsWith("withdraw_address_")) {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (!isSolanaAddress(text)) {
        await ctx.reply(
          "❌ *Invalid Solana address.*\n\nA Solana address is 32-44 characters.",
          { parse_mode: "Markdown" },
        );
        return;
      }
      const parts = pending.split("_");
      const token = parts[2];
      const walletId = parseInt(parts[3]);
      const wallet = db.getWallet(walletId);
      const balance = await getBalance(wallet?.public_key || "");
      // Store the FULL destination address for the confirm screen
      db.setSysConfig(`withdraw_addr_${userId}`, text);
      await ctx.reply(
        `✅ *Valid Solana Address*\n\n📤 From: *${stripMd(wallet?.label || "")}*\n📥 To:\n\`${text}\`\n\n💰 Balance: ${balance.toFixed(4)} SOL\n\n⚠️ *Double-check the address above.*\nCrypto transfers can't be reversed.\n\nSelect amount:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "25%", callback_data: `withdraw_send_25_${token}_${walletId}` },
                { text: "50%", callback_data: `withdraw_send_50_${token}_${walletId}` },
                { text: "75%", callback_data: `withdraw_send_75_${token}_${walletId}` },
                { text: "100%", callback_data: `withdraw_send_100_${token}_${walletId}` },
              ],
              [{ text: "✏️ Custom Amount", callback_data: `withdraw_custom_${token}_${walletId}` }],
              [{ text: "❌ Cancel", callback_data: "menu_wallets" }],
            ],
          },
        },
      );
      return;
    }
      if (pending.startsWith("cw_edit_set_amount_") || pending.startsWith("cw_edit_set_slip_") || pending.startsWith("cw_edit_set_gas_") || pending.startsWith("cw_edit_set_max_") || pending.startsWith("cw_edit_set_min_") || pending.startsWith("cw_edit_set_pct_") || pending.startsWith("cw_edit_set_delay_")) {
        const cwId2 = parseInt(pending.split("_").pop());
        await deleteMsg(ctx, promptId);
        try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
        db.setSysConfig(`pending_${userId}`, "");
        const val = parseFloat(text);
        if (isNaN(val) || val <= 0) { await ctx.reply("❌ Invalid value."); return; }
        if (pending.startsWith("cw_edit_set_amount_")) db.getDb().prepare("UPDATE copy_wallets SET sol_amount = ? WHERE id = ? AND user_id = ?").run(val, cwId2, userId);
        if (pending.startsWith("cw_edit_set_slip_")) db.getDb().prepare("UPDATE copy_wallets SET slippage = ? WHERE id = ? AND user_id = ?").run(val, cwId2, userId);
        if (pending.startsWith("cw_edit_set_gas_")) db.getDb().prepare("UPDATE copy_wallets SET gas_fee = ? WHERE id = ? AND user_id = ?").run(val, cwId2, userId);
        if (pending.startsWith("cw_edit_set_max_")) db.getDb().prepare("UPDATE copy_wallets SET max_sol = ? WHERE id = ? AND user_id = ?").run(val, cwId2, userId);
        if (pending.startsWith("cw_edit_set_min_")) db.getDb().prepare("UPDATE copy_wallets SET min_sol = ? WHERE id = ? AND user_id = ?").run(val, cwId2, userId);
        if (pending.startsWith("cw_edit_set_pct_")) db.getDb().prepare("UPDATE copy_wallets SET copy_pct = ? WHERE id = ? AND user_id = ?").run(Math.min(100,Math.max(1,val)), cwId2, userId);
        if (pending.startsWith("cw_edit_set_delay_")) db.getDb().prepare("UPDATE copy_wallets SET delay_seconds = ? WHERE id = ? AND user_id = ?").run(Math.max(0,val), cwId2, userId);
        await refreshCwScreen(ctx, userId, cwId2);
        return;
      }
    if (pending === "cw_follow_address") {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      if (!isSolanaAddress(text)) {
        await ctx.reply("❌ Invalid Solana address.");
        return;
      }
      db.setSysConfig(`cw_pending_addr_${userId}`, text);
      db.setSysConfig(`pending_${userId}`, "");
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }

    if (pending === "cw_name") {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`cw_pending_name_${userId}`, text);
      db.setSysConfig(`pending_${userId}`, "");
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }

    if (pending === "cw_amount") {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(val) || val <= 0) {
        await ctx.reply("❌ Invalid amount.");
        return;
      }
      db.setSysConfig(`cw_pending_sol_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }

    if (pending === "cw_slippage") {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(val) || val <= 0) {
        await ctx.reply("❌ Invalid slippage.");
        return;
      }
      db.setSysConfig(`cw_pending_slippage_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }

    if (pending === "cw_gas") {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(val) || val < 0) {
        await ctx.reply("❌ Invalid gas fee.");
        return;
      }
      db.setSysConfig(`cw_pending_gas_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }
    if (pending === "cw_max") {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (!isNaN(val) && val >= 0) db.setSysConfig(`cw_pending_max_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }
    if (pending === "cw_min") {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (!isNaN(val) && val >= 0) db.setSysConfig(`cw_pending_min_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }
    if (pending === "cw_pct") {
      const val = Math.min(100, Math.max(1, parseFloat(text)));
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (!isNaN(val)) db.setSysConfig(`cw_pending_pct_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }
    if (pending === "cw_delay") {
      const val = Math.max(0, parseFloat(text));
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (!isNaN(val)) db.setSysConfig(`cw_pending_delay_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }
    if (pending === "copy_wallet_address") {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      if (!isSolanaAddress(text)) {
        await ctx.reply("❌ Invalid Solana address.");
        return;
      }
      db.setSysConfig(`copy_pending_addr_${userId}`, text);
      db.setSysConfig(`pending_${userId}`, "copy_wallet_sol");
      const msg = await ctx.reply(
        "💰 How much SOL per copy trade? (e.g. 0.1):",
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      return;
    }

    if (pending === "copy_wallet_sol") {
      const sol = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      if (isNaN(sol) || sol <= 0) {
        await ctx.reply("❌ Invalid amount.");
        return;
      }
      db.setSysConfig(`copy_pending_sol_${userId}`, String(sol));
      db.setSysConfig(`pending_${userId}`, "");
      await ctx.reply(
        `👛 Copy amount: *${sol} SOL* per trade\n\nMirror sells too?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Yes, mirror sells",
                  callback_data: "copy_wallet_mirror_yes",
                },
                { text: "❌ No", callback_data: "copy_wallet_mirror_no" },
              ],
            ],
          },
        },
      );
      return;
    }
    if (pending === "copy_channel_forward") {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const fwd = ctx.message.forward_origin || ctx.message.forward_from_chat;
      if (!fwd) {
        await ctx.api.sendMessage(
          ctx.chat.id,
          "❌ Please forward a message from the channel.",
        );
        return;
      }
      const channelId = String(fwd.chat?.id || fwd.id || "");
      const channelName = stripMd(fwd.chat?.title || fwd.title || channelId);
      if (!channelId) {
        await ctx.api.sendMessage(
          ctx.chat.id,
          "❌ Could not detect channel. Try @username instead.",
        );
        return;
      }
      db.addCopyChannel(userId, channelId, channelName, {});
      const channels = db.getCopyChannels(userId);
      const newCh =
        channels.find((c) => c.channel_id === channelId) || channels[0];
      if (newCh) {
        await ctx.api.sendMessage(ctx.chat.id, `✅ *${channelName}* added!`, { parse_mode: "Markdown" });
        const s = await ctx.api.sendMessage(ctx.chat.id, buildChDetailMsg(newCh), { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(newCh) });
        db.setSysConfig(`ch_view_msg_${userId}`, String(s.message_id));
      } else {
        await ctx.api.sendMessage(ctx.chat.id, "❌ Could not add channel. Try again.");
      }
      return;
    }

    if (pending === "copy_channel_numeric_id") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const channelId2 = text.trim();
      if (!channelId2.startsWith("-100")) { await ctx.reply("❌ Invalid channel ID. Must start with -100."); return; }
      db.addCopyChannel(userId, channelId2, channelId2, {});
      const channels2 = db.getCopyChannels(userId);
      const newCh2 = channels2.find(c => c.channel_id === channelId2) || channels2[0];
      if (newCh2) {
        await ctx.reply(`✅ *${channelId2}* added!`, { parse_mode: "Markdown" });
        const s = await ctx.reply(buildChDetailMsg(newCh2), { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(newCh2) });
        db.setSysConfig(`ch_view_msg_${userId}`, String(s.message_id));
      } else { await ctx.reply("❌ Could not add channel."); }
      return;
    }

    if (pending.startsWith("cch_set_minliq_") || pending.startsWith("cch_set_maxmcap_") || pending.startsWith("cch_set_minmcap_") || pending.startsWith("cch_set_minage_") || pending.startsWith("cch_set_blacklist_")) {
      const chId = parseInt(pending.split("_").pop());
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (pending.startsWith("cch_set_blacklist_")) {
        let words = [];
        if (text.toLowerCase() !== "clear") words = text.split(",").map(w => w.trim().toLowerCase()).filter(Boolean);
        db.updateCopyChannel(userId, chId, { blacklist: JSON.stringify(words) });
      } else {
        const val = parseFloat(text);
        if (isNaN(val) || val < 0) { await ctx.reply("❌ Invalid value."); return; }
        if (pending.startsWith("cch_set_minliq_")) db.updateCopyChannel(userId, chId, { min_liquidity: val });
        if (pending.startsWith("cch_set_maxmcap_")) db.updateCopyChannel(userId, chId, { max_mcap: val });
        if (pending.startsWith("cch_set_minmcap_")) db.updateCopyChannel(userId, chId, { min_mcap: val });
        if (pending.startsWith("cch_set_minage_")) db.updateCopyChannel(userId, chId, { min_token_age: Math.floor(val) });
      }
      const ch = db.getCopyChannel(chId, userId);
      const { buildCopyChannelSettingsMenu } = require("../keyboards");
      const nm = (ch.channel_name || ch.channel_id).replace(/([_*\[\]()~`>#+=|{}.!-])/g, "\\$1");
      let bl = []; try { bl = JSON.parse(ch.blacklist || "[]"); } catch {}
      const fMsg = `📡 *${nm}*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Auto-buys any CA posted in channel\n▸ Filters block weak/risky signals\n▸ All settings auto-save instantly\n━━━━━━━━━━━━━━━━━━━\n\nStatus: ${ch.status === "active" ? "🟢 Active" : "⏸ Paused"}\nSignals: *${ch.signals_caught||0}* | Trades: *${ch.trades_executed||0}* | Skipped: *${ch.skipped_signals||0}*\n\n💰 Buy: *${ch.buy_amount||0.1} SOL*\n📊 Slippage: *${ch.slippage||50}%*\n⛽ Gas: *${ch.tip||0.005} SOL*\n🛡 MEV: *${ch.mev_protection ? "ON ✅" : "OFF ❌"}*\n🤖 Auto Sell: *${ch.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*\n\n🔍 *FILTERS:*\n💧 Min Liquidity: *${ch.min_liquidity ? ch.min_liquidity + " SOL" : "OFF"}*\n🧢 Max MCap: *${ch.max_mcap ? "$" + (ch.max_mcap/1000) + "K" : "OFF"}*\n🧢 Min MCap: *${ch.min_mcap ? "$" + (ch.min_mcap/1000) + "K" : "OFF"}*\n⏰ Min Token Age: *${ch.min_token_age ? ch.min_token_age + " min" : "OFF"}*\n🚫 Blacklist: *${bl.length ? bl.join(", ") : "None"}*`;
      const viewMsgId = parseInt(db.getSysConfig(`ch_view_msg_${userId}`) || "0");
      if (viewMsgId) { try { await ctx.api.editMessageText(ctx.chat.id, viewMsgId, fMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch, true) }); return; } catch {} }
      await ctx.reply(fMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch, true) });
      return;
    }

    if (pending.startsWith("cch_set_buy_") || pending.startsWith("cch_set_slip_") || pending.startsWith("cch_set_tip_")) {
      const chId = parseInt(pending.split("_").pop());
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const val = parseFloat(text);
      if (isNaN(val) || val < 0) { await ctx.reply("❌ Invalid value."); return; }
      if (pending.startsWith("cch_set_buy_")) db.updateCopyChannel(userId, chId, { buy_amount: val });
      if (pending.startsWith("cch_set_slip_")) db.updateCopyChannel(userId, chId, { slippage: val });
      if (pending.startsWith("cch_set_tip_")) db.updateCopyChannel(userId, chId, { tip: val });
      const ch = db.getCopyChannel(chId, userId);
      const { buildCopyChannelSettingsMenu } = require("../keyboards");
      const name = (ch.channel_name || ch.channel_id).replace(/([_*\[\]()~`>#+=|{}.!-])/g, "\\$1");
      const chMsg = buildChDetailMsg(ch);
      const viewMsgId = parseInt(db.getSysConfig(`ch_view_msg_${userId}`) || "0");
      if (viewMsgId) { try { await ctx.api.editMessageText(ctx.chat.id, viewMsgId, chMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) }); return; } catch {} }
      await ctx.reply(chMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) });
      return;
    }

    if (pending.startsWith("cch_set_label_")) {
      const chId = parseInt(pending.replace("cch_set_label_", ""));
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const newLabel = text.trim().slice(0,30);
      db.updateCopyChannel(userId, chId, { channel_name: newLabel });
      const ch = db.getCopyChannel(chId, userId);
      const viewMsgId = parseInt(db.getSysConfig(`ch_view_msg_${userId}`) || "0");
      const chMsg = `📡 *${newLabel}*\n\nStatus: ${ch.status === "active" ? "🟢 Active" : "⏸ Paused"}\nSignals: *${ch.signals_caught||0}* | Trades: *${ch.trades_executed||0}*\n\n💰 Buy: *${ch.buy_amount||0.1} SOL*\n📊 Slip: *${ch.slippage||50}%*\n⛽ Gas: *${ch.tip||0.005} SOL*\n🛡 MEV: *${ch.mev_protection ? "ON ✅" : "OFF ❌"}*\n🤖 Auto Sell: *${ch.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*`;
      const { buildCopyChannelSettingsMenu } = require("../keyboards");
      if (viewMsgId) { try { await ctx.api.editMessageText(ctx.chat.id, viewMsgId, chMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) }); return; } catch {} }
      await ctx.reply(chMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) });
      return;
    }

    if (pending === "copy_channel_id") {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      let raw = text.trim();
      // Extract username from t.me link or @username
      if (raw.includes("t.me/")) raw = raw.split("t.me/")[1].split(/[/?]/)[0];
      raw = raw.replace(/^@/, "").replace(/^https?:\/\//, "");
      const channelId = "@" + raw;
      const safeChId = stripMd(channelId);
      db.addCopyChannel(userId, channelId, channelId, {});
      const channels = db.getCopyChannels(userId);
      const newCh =
        channels.find((c) => c.channel_id === channelId) || channels[0];
      await ctx.api.sendMessage(ctx.chat.id, `✅ Channel *${safeChId}* added!`, { parse_mode: "Markdown" });
      if (newCh) {
        const s = await ctx.api.sendMessage(ctx.chat.id, buildChDetailMsg(newCh), { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(newCh) });
        db.setSysConfig(`ch_view_msg_${userId}`, String(s.message_id));
      }
      return;
    }

    if (pending.startsWith("cch_set_")) {
      const parts = pending.split("_");
      const field = parts[2];
      const id = parseInt(parts[3]);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const val = parseFloat(text);
      const fieldMap = { buy: "buy_amount", slip: "slippage", tip: "tip", sl: "stop_loss_pct", tp: "take_profit_pct", maxbuys: "max_buys_per_signal" };
      if (fieldMap[field] && !isNaN(val)) db.updateCopyChannel(userId, id, { [fieldMap[field]]: val });
      const ch = db.getCopyChannel(id, userId);
      if (!ch) return;
      const chMsgId = parseInt(db.getSysConfig(`ch_view_msg_${userId}`) || "0");
      const chMsg = `📡 *${stripMd(ch.channel_name || ch.channel_id)}*\n\nStatus: ${ch.status === "active" ? "🟢 Active" : "⏸ Paused"}\nSignals: *${ch.signals_caught||0}* | Trades: *${ch.trades_executed||0}*\n\n💰 Buy: *${ch.buy_amount||0.1} SOL*\n📊 Slip: *${ch.slippage||50}%*\n⛽ Gas: *${ch.tip||0.005} SOL*\n🛡 MEV: *${ch.mev_protection ? "ON ✅" : "OFF ❌"}*\n🤖 Auto Sell: *${ch.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*`;
      try {
        if (chMsgId) await ctx.api.editMessageText(ctx.chat.id, chMsgId, chMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) });
        else { const s = await ctx.reply(chMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) }); db.setSysConfig(`ch_view_msg_${userId}`, String(s.message_id)); }
      } catch { const s = await ctx.reply(chMsg, { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) }); db.setSysConfig(`ch_view_msg_${userId}`, String(s.message_id)); }
      return;
    }

    if (pending.startsWith("scfg_set_")) {
      const parts = pending.split("_");
      const field = parts[2];
      const id = parseInt(parts[3]);
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const val = parseFloat(text);
      const fieldMap = {
        amt: "snipe_amount",
        slip: "snipe_slippage",
        fee: "snipe_fee",
        tip: "snipe_tip",
        max: "max_snipes",
        minliq: "min_liquidity",
        maxmcap: "market_cap_min",
        dev: "dev_holding_max",
        label: "label",
      };
      if (field === "label") {
        db.updateSniperConfig(userId, id, { label: text.trim().slice(0,20) });
      } else if (fieldMap[field] && !isNaN(val)) {
        db.updateSniperConfig(userId, id, { [fieldMap[field]]: val });
      }
      const cfg = db.getSniperConfig(id, userId);
      if (cfg) {
        const cfgMsgId = parseInt(db.getSysConfig(`scfg_msg_${userId}`) || "0");
        const chatId = ctx.chat?.id || ctx.message?.chat?.id;
        if (cfgMsgId && chatId) {
          try {
            await ctx.api.editMessageText(chatId, cfgMsgId, `🎯 *${cfg.label}*\n\n━━━━━━━━━━━━━━━━━━━\n⚡ *Trade Settings*\n💰 Amount — SOL per snipe\n📉 Slippage — max price move %\n⛽ Fee — priority fee SOL\n🎯 Tip — Jito bundle tip\n🛡 MEV — sandwich protection\n━━━━━━━━━━━━━━━━━━━\n🔍 *Safety Filters*\n💧 Min Liq — min pool SOL\n🧢 Max MCap — max market cap\n👤 Dev% — max dev holdings\n✅ Mint Rev — mint authority off\n✅ Freeze Rev — freeze auth off\n━━━━━━━━━━━━━━━━━━━\n📦 *Platforms*\nRaydium | Pumpfun | Moonshot\n🦅 HawkX Launch\n━━━━━━━━━━━━━━━━━━━\n💾 *Auto-saves instantly* — no save button needed\n✏️ Rename | ✅ Activate | ⏸ Pause`, { parse_mode: "Markdown", reply_markup: buildSniperConfigMenu(cfg) });
            return;
          } catch(e) { console.log("[SCFG EDIT ERR]", e.message); }
        }
        const sent = await ctx.reply(`🎯 *${cfg.label}*\n\n━━━━━━━━━━━━━━━━━━━\n⚡ *Trade Settings*\n💰 Amount — SOL per snipe\n📉 Slippage — max price move %\n⛽ Fee — priority fee SOL\n🎯 Tip — Jito bundle tip\n🛡 MEV — sandwich protection\n━━━━━━━━━━━━━━━━━━━\n🔍 *Safety Filters*\n💧 Min Liq — min pool SOL\n🧢 Max MCap — max market cap\n👤 Dev% — max dev holdings\n✅ Mint Rev — mint authority off\n✅ Freeze Rev — freeze auth off\n━━━━━━━━━━━━━━━━━━━\n📦 *Platforms*\nRaydium | Pumpfun | Moonshot\n🦅 HawkX Launch\n━━━━━━━━━━━━━━━━━━━\n💾 *Auto-saves instantly* — no save button needed\n✏️ Rename | ✅ Activate | ⏸ Pause`, { parse_mode: "Markdown", reply_markup: buildSniperConfigMenu(cfg) });
        db.setSysConfig(`scfg_msg_${userId}`, String(sent.message_id));
      }
      return;
    }
      if (pending.startsWith("snipe_set_label_")) {
        const id = parseInt(pending.replace("snipe_set_label_", ""));
        await deleteMsg(ctx, promptId);
        try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
        db.setSysConfig(`pending_${userId}`, "");
        const newLabel = text.trim().slice(0,20);
        db.getDb().prepare("UPDATE snipes SET label = ? WHERE id = ? AND user_id = ?").run(newLabel, id, userId);
        // answerCallbackQuery not available in message context
        const snipe = db.getDb().prepare("SELECT * FROM snipes WHERE id = ? AND user_id = ?").get(id, userId);
        const asOn = snipe?.auto_sell_template_id ? "ON ✅" : "OFF ❌";
        const snipeMsg = `🔀 *${newLabel}*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Tap Pause to stop this snipe\n▸ Tap Rename to change name\n▸ Tap Cancel to delete permanently\n━━━━━━━━━━━━━━━━━━━\n\n${snipe?.active ? "🟢 Active" : "⏸ Paused"}\n\n💰 Amount: *${snipe?.sol_amount} SOL*\n📉 Slippage: *${snipe?.slippage||50}%*\n⛽ Gas: *${snipe?.gas||0.005} SOL*\n🛡 MEV: *${snipe?.mev ? "ON ✅" : "OFF ❌"}*\n🤖 Auto Sell: *${asOn}*`;
        const snipeKb = { inline_keyboard: [
          [{ text: snipe?.active ? "⏸ Pause" : "▶ Resume", callback_data: `snipe_toggle_${id}` }, { text: "✏️ Rename", callback_data: `snipe_rename_${id}` }],
          [{ text: "✖ Cancel Snipe", callback_data: `snipe_cancel_${id}` }],
          [{ text: "← Back", callback_data: "sniper_migration_menu" }],
        ]};
        const viewMsgId = parseInt(db.getSysConfig(`snipe_view_msg_${userId}`) || "0");
        if (viewMsgId) {
          try { await ctx.api.editMessageText(ctx.chat.id, viewMsgId, snipeMsg, { parse_mode: "Markdown", reply_markup: snipeKb }); return; } catch {}
        }
        await ctx.reply(snipeMsg, { parse_mode: "Markdown", reply_markup: snipeKb });
      }
      if (pending === "msnipe_set_label") {
        await deleteMsg(ctx, promptId);
        try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
        db.setSysConfig(`pending_${userId}`, "");
        db.setSysConfig(`msnipe_label_${userId}`, text.trim().slice(0,20));
        await refreshMsnipeScreen(ctx, userId);
        return;
      }
      if (pending === "msnipe_minliq" || pending === "msnipe_maxmcap") {
        await deleteMsg(ctx, promptId);
        try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
        db.setSysConfig(`pending_${userId}`, "");
        const raw = text.trim().toUpperCase();
        let val = parseFloat(raw);
        if (raw.endsWith("K")) val = parseFloat(raw) * 1000;
        if (raw.endsWith("M")) val = parseFloat(raw) * 1000000;
        if (isNaN(val)) val = 0;
        db.setSysConfig(`msnipe_${pending === "msnipe_minliq" ? "minliq" : "maxmcap"}_${userId}`, String(val));
        await refreshMsnipeScreen(ctx, userId);
        return;
      }
      if (pending === "msnipe_sol" || pending === "msnipe_slip" || pending === "msnipe_gas") {
        await deleteMsg(ctx, promptId);
        try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
        db.setSysConfig(`pending_${userId}`, "");
        const val = parseFloat(text);
        if (isNaN(val) || val <= 0) { await ctx.reply("❌ Invalid value."); return; }
        if (pending === "msnipe_sol")  db.setSysConfig(`msnipe_sol_${userId}`, String(val));
        if (pending === "msnipe_slip") db.setSysConfig(`msnipe_slip_${userId}`, String(val));
        if (pending === "msnipe_gas")  db.setSysConfig(`msnipe_gas_${userId}`, String(val));
        await refreshMsnipeScreen(ctx, userId);
        return;
      }
    if (pending.startsWith("launch_field_")) {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const parts = pending.replace("launch_field_","").split("_");
      const field = parts[0];
      const uid = parts[1] || userId;
      const keyMap = {
        name: `launch_name_${uid}`,
        symbol: `launch_symbol_${uid}`,
        supply: `launch_supply_${uid}`,
        desc: `launch_desc_${uid}`,
        twitter: `launch_twitter_${uid}`,
        telegram: `launch_telegram_${uid}`,
        website: `launch_website_${uid}`,
        initial: `launch_initial_buy_${uid}`,
      };
      if (keyMap[field]) db.setSysConfig(keyMap[field], text.trim());
      // Refresh launch screen
      const { getLaunchPending, buildLaunchScreen } = require("../launch");
      const p = getLaunchPending(userId);
      const platformName = p.platform === "pump" ? "🌊 Pump.fun" : "🦅 HawkX";
      const launchMsgId = parseInt(db.getSysConfig(`launch_msg_${userId}`) || "0");
      const launchMsg =
        `🚀 *Launch Token — ${platformName}*\n\n` +
        `📝 Name: *${p.name||"Not set"}*\n` +
        `🔤 Symbol: *${p.symbol||"Not set"}*\n` +
        `🔢 Supply: *${parseInt(p.supply||1000000000).toLocaleString()}*\n` +
        `📄 Description: *${p.description||"Not set"}*\n\n` +
        `🌐 Socials:\n` +
        `🐦 Twitter: ${p.twitter||"Not set"}\n` +
        `💬 Telegram: ${p.telegram||"Not set"}\n` +
        `🌍 Website: ${p.website||"Not set"}`;
      const { msg: lMsg2b, kb: lKb2 } = await buildLaunchMsg(userId, false);
      try {
        if (launchMsgId) await ctx.api.editMessageText(ctx.chat.id, launchMsgId, launchMsg, { parse_mode: "Markdown", reply_markup: lKb2 });
        else { const s = await ctx.reply(launchMsg, { parse_mode: "Markdown", reply_markup: lKb2 }); db.setSysConfig(`launch_msg_${userId}`, String(s.message_id)); }
      } catch { const s = await ctx.reply(launchMsg, { parse_mode: "Markdown", reply_markup: lKb2 }); db.setSysConfig(`launch_msg_${userId}`, String(s.message_id)); }
      return;
    }

    if (pending === "snipe_ca") {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`snipe_pending_ca_${userId}`, text);
      db.setSysConfig(`pending_${userId}`, "snipe_sol");
      const msg = await ctx.reply("⛽ How much SOL to snipe with? (e.g. 0.5):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      return;
    }

    if (pending === "snipe_sol") {
      const sol = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(sol) || sol <= 0) {
        await ctx.reply("❌ Invalid amount.");
        return;
      }
      const ca = db.getSysConfig(`snipe_pending_ca_${userId}`);
      db.addSnipe(userId, ca, sol, 50, null);
      await ctx.reply(
        `✅ *Snipe Set!*\n\nCA: \`${ca.slice(0, 12)}...\`\nAmount: *${sol} SOL*\n\n_Bot will buy when this token migrates or launches._`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (
      pending === "sniper_rt_amount" ||
      pending === "sniper_rt_slippage" ||
      pending === "sniper_rt_fee" ||
      pending === "sniper_rt_jito"
    ) {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(val) || val <= 0) {
        await ctx.reply("❌ Invalid value.");
        return;
      }
      const patch =
        pending === "sniper_rt_amount" ? { sniper_rt_amount: val } : pending === "sniper_rt_slippage" ? { sniper_rt_slippage: val } : pending === "sniper_rt_jito" ? { sniper_rt_jito: val } : { sniper_rt_fee: val };
      db.updateRealtimeSniperConfig(userId, patch);
      db.setSysConfig(`sniper_screen_${userId}`, "realtime");
      const rtMsgId = parseInt(db.getSysConfig(`rt_msg_${userId}`) || "0");
      const rtMsgText = "⚡ *Real-Time Sniper*\n\n━━━━━━━━━━━━━━━━━━━\n▸ Snipes ANY new Raydium pool instantly\n▸ Fastest entry — catches first block\n▸ No CA needed — fully automatic\n▸ Toggle sources: Raydium, Migrations, HawkX\n▸ All settings auto-save instantly\n━━━━━━━━━━━━━━━━━━━\n\n💰 Amount — SOL per snipe\n📉 Slippage — max price move %\n⛽ Fee — priority fee SOL\n⚡ Jito — bundle priority tip\n🛡 MEV — sandwich protection\n━━━━━━━━━━━━━━━━━━━";
      if (rtMsgId) {
        try { await ctx.api.editMessageText(ctx.chat.id, rtMsgId, rtMsgText, { parse_mode: "Markdown", reply_markup: buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)) }); return; } catch {}
      }
      const s = await ctx.reply(rtMsgText, { parse_mode: "Markdown", reply_markup: buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)) });
      db.setSysConfig(`rt_msg_${userId}`, String(s.message_id));
    }

    if (pending === "lo_set_custom_expiry") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const id = parseInt(db.getSysConfig(`lo_expiry_pending_${userId}`) || "0");
      const t = text.trim().toLowerCase();
      let expiresAt = null;
      if (t !== "never" && t !== "0") {
        const num = parseInt(t);
        const unit = t.slice(-1);
        if (isNaN(num) || num <= 0) { await ctx.reply("❌ Invalid duration. Try 30m, 360h, 14d, or never."); return; }
        let ms = 0;
        if (unit === "h") ms = num * 3600000;
        else if (unit === "d") ms = num * 86400000;
        else if (unit === "m") ms = num * 60000;
        else { await ctx.reply("❌ Use m, h, or d (e.g. 30m, 360h, 14d)."); return; }
        expiresAt = new Date(Date.now() + ms).toISOString();
      }
      db.setLimitOrderExpiry(userId, id, expiresAt);
      const ca = db.getSysConfig(`lo_pending_ca_${userId}`) || "";
      db.setSysConfig(`lo_selected_${userId}`, "");
      const { buildTokenOrdersScreen } = require("./helpers.routes");
      if (ca) return buildTokenOrdersScreen(ctx, userId, ca);
      const { showLimitOrdersScreen } = require("./helpers.routes");
      return showLimitOrdersScreen(ctx, userId);
    }

    if (pending === "cw_setup_cs_value") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const field = db.getSysConfig(`cw_setup_cs_field_${userId}`) || "";
      const val = parseFloat(text);
      if (isNaN(val) || val < 0) { await ctx.reply("❌ Invalid value."); return; }
      const map = { csminprofit: "cw_pending_csminprofit_", csstoploss: "cw_pending_csstoploss_", csdust: "cw_pending_csdust_", csdelay: "cw_pending_csdelay_" };
      if (!map[field]) { await ctx.reply("❌ Error."); return; }
      const finalVal = field === "csdelay" ? String(Math.floor(val)) : String(val);
      db.setSysConfig(map[field] + userId, finalVal);
      const { buildSetupCopySellScreen } = require("./callbacks.copytrade");
      const { msg, kb } = buildSetupCopySellScreen(userId);
      const csMsgId = parseInt(db.getSysConfig(`cw_setup_cs_msg_${userId}`) || "0");
      if (csMsgId) { try { await ctx.api.editMessageText(ctx.chat.id, csMsgId, msg, { parse_mode: "Markdown", reply_markup: kb }); return; } catch {} }
      await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
      return;
    }

    if (pending === "cw_cs_savepreset_name") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const cwId = parseInt(db.getSysConfig(`cs_savepreset_id_${userId}`) || "0");
      const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(cwId, userId);
      if (!cw) { await ctx.reply("❌ Wallet not found."); return; }
      const name = text.trim().slice(0, 30) || "Preset";
      db.saveCopySellPreset(userId, name, {
        minProfit: cw.cs_min_profit || 0,
        stopLoss: cw.cs_stop_loss || 0,
        ignoreDust: cw.cs_ignore_dust || 0,
        sellDelay: cw.cs_sell_delay || 0,
      });
      const { buildCopySellScreen } = require("./callbacks.copytrade");
      const { msg, kb } = buildCopySellScreen(cw);
      const csMsgId = parseInt(db.getSysConfig(`cs_screen_msg_${userId}`) || "0");
      if (csMsgId) { try { await ctx.api.editMessageText(ctx.chat.id, csMsgId, `✅ Preset "${name}" saved!\n\n` + msg, { parse_mode: "Markdown", reply_markup: kb }); return; } catch {} }
      await ctx.reply(`✅ Preset "${name}" saved!`, { parse_mode: "Markdown", reply_markup: kb });
      return;
    }

    if (pending === "cw_cs_setvalue") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      let cfg = {}; try { cfg = JSON.parse(db.getSysConfig(`cs_pending_${userId}`) || "{}"); } catch {}
      const val = parseFloat(text);
      if (isNaN(val) || val < 0) { await ctx.reply("❌ Invalid value. Enter a number."); return; }
      const allowed = ["cs_min_profit", "cs_stop_loss", "cs_ignore_dust", "cs_sell_delay"];
      if (!allowed.includes(cfg.field)) { await ctx.reply("❌ Error."); return; }
      const finalVal = cfg.field === "cs_sell_delay" ? Math.floor(val) : val;
      db.getDb().prepare(`UPDATE copy_wallets SET ${cfg.field} = ? WHERE id = ? AND user_id = ?`).run(finalVal, cfg.id, userId);
      const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(cfg.id, userId);
      const { buildCopySellScreen } = require("./callbacks.copytrade");
      const { msg, kb } = buildCopySellScreen(cw);
      const csMsgId = parseInt(db.getSysConfig(`cs_screen_msg_${userId}`) || "0");
      if (csMsgId) {
        try { await ctx.api.editMessageText(ctx.chat.id, csMsgId, msg, { parse_mode: "Markdown", reply_markup: kb }); return; } catch {}
      }
      await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
      return;
    }

    if (pending === "wl_alert_target") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const ca = db.getSysConfig(`alert_pending_ca_${userId}`) || "";
      const nm = db.getSysConfig(`alert_pending_name_${userId}`) || ca.slice(0,8);
      let tp = 0, dir = "price_above";
      const cl = text.trim().toUpperCase();
      if (cl.endsWith("K")) { tp = parseFloat(cl) * 1000; dir = "mcap_above"; }
      else if (cl.endsWith("M")) { tp = parseFloat(cl) * 1000000; dir = "mcap_above"; }
      else { const n = parseFloat(cl); if (n >= 1000) { tp = n; dir = "mcap_above"; } else { tp = n; dir = "price_above"; } }
      if (tp <= 0) { await ctx.reply("❌ Invalid target."); return; }
      db.addPriceAlert(userId, ca, nm, tp, dir);
      const wlId = parseInt(db.getSysConfig(`alert_pending_wlid_${userId}`) || "0");
      if (wlId) {
        const { showAlertMgmtScreen } = require("./callbacks.watchlist");
        return showAlertMgmtScreen(ctx, userId, wlId);
      }
      const { showWatchlistScreen } = require("./helpers.routes");
      return showWatchlistScreen(ctx, userId);
    }

    if (pending === "watchlist_add_ca") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      // Validate CA
      if (text.length < 32 || text.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(text)) {
        await ctx.reply("❌ Invalid Solana CA. Try again.");
        return;
      }
      // Fetch token name
      let tName = text.slice(0, 8);
      try { const ti = await getTokenInfo(text); if (ti?.name) tName = ti.name; } catch {}
      db.addToWatchlist(userId, text, tName, 0);
      // Refresh watchlist screen
      const { showWatchlistScreen } = require("./helpers.routes");
      return showWatchlistScreen(ctx, userId);
    }

    if (pending.startsWith("set_limit_sell_")) {
      const posId = pending.replace("set_limit_sell_", "");
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) {
        await ctx.reply("❌ Invalid price.");
        return;
      }
      const pos = db.getPosition(parseInt(posId), userId);
      if (pos)
        db.addLimitOrder(userId, {
          tokenCa: pos.token_ca,
          tokenName: pos.token_name,
          orderType: "sell",
          targetPrice: price,
          sellPct: 100,
        });
      await ctx.reply(`✅ Limit sell set at *${price} SOL*`, {
        parse_mode: "Markdown",
      });
      return;
    }

    // Admin text inputs
    if (pending.startsWith("admin_")) {
      if (!isAdmin(userId)) {
        await ctx.reply("❌ Admin only.");
        return;
      }
      return handleAdminTextInput(ctx, pending);
    }

    if (pending === "referral_payout_address") {
      await deleteMsg(ctx, promptId);
      try {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
      } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (!isSolanaAddress(text)) {
        await ctx.reply("❌ Invalid Solana address.");
        return;
      }
      db.setSysConfig(`payout_wallet_${userId}`, text);
      await ctx.reply(`✅ Payout wallet set:\n\`${text}\``, {
        parse_mode: "Markdown",
      });
      return;
    }

    if (pending === "referral_enter_code") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const me = db.getUser(userId);
      if (me.referrer_id) { await ctx.reply("✅ You already have a referrer — it can't be changed."); return; }
      // Accept a referral CODE (HAWKxxxxx or custom) OR a @username
      let refUser = db.getUserByReferralCode(text);
      if (!refUser) refUser = db.getUserByUsername(text);
      if (!refUser) { await ctx.reply("❌ Code or user not found. Check it and try again."); return; }
      if (refUser.user_id === userId) { await ctx.reply("❌ You can't refer yourself."); return; }
      db.updateUser(userId, { referrer_id: refUser.user_id });
      db.buildReferralChain(userId, refUser.user_id);
      await ctx.reply(`✅ *Referral accepted!*\n\nYou were referred by *@${refUser.username || "a HawkX user"}*. They'll now earn from your trades.`, { parse_mode: "Markdown" });
      return;
    }

    if (pending === "referral_customize_code") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const result = db.setCustomCode(userId, text);
      if (!result.ok) {
        await ctx.reply(`❌ ${result.reason}\n\nTap ✏️ Customize My Code to try again.`);
        return;
      }
      const _botUn = ctx.me?.username || "HawkX_Trade_Bot"; await ctx.reply(`✅ <b>Your code is now</b> <code>${result.code}</code>\n\nShare this link:\n<code>https://t.me/${_botUn}?start=${result.code}</code>`, { parse_mode: "HTML", disable_web_page_preview: true });
      return;
    }

    // Auto-detect CA
    if (
      !pending &&
      text.length >= 32 &&
      text.length <= 44 &&
      /^[1-9A-HJ-NP-Za-km-z]+$/.test(text)
    ) {
      if (ks) {
        await ctx.reply("🔴 Trading paused.");
        return;
      }
      // Check auto buy first!
      const autoBought = await handleAutoBuy(ctx, user, text);
      if (autoBought) return;
      const { showTokenScanner } = require("./helpers.routes");
      await showTokenScanner(ctx, user, text);
      return;
    }

    if (!pending) {
      // Check if valid Solana CA
      if (isSolanaAddress(text)) {
          const autoBought = await handleAutoBuy(ctx, user, text);
          if (autoBought) return;
      }
      const rt = db.getRealtimeSniperConfig(userId);
      if ((rt?.sniper_rt_enabled || 0) === 1) {
        const buyDefaults = {
          solAmount: rt.sniper_rt_amount || 0.1,
          slippage: rt.sniper_rt_slippage || 50,
          fee: rt.sniper_rt_fee || 0.003,
        };
        const tokenName = `RT-${text.slice(0, 6)}`;
        db.setSysConfig(`sniper_screen_${userId}`, "realtime");
        await executeRealtimeSnipe(ctx, db.getUser(userId), text, {
          tokenName,
          sourceRef: "realtime",
          entryMcap: 0,
        });
        return safeEdit(
          ctx,
          `⚡ *Real-Time Snipe*\n\n${getGuide("sniper")}\n\n` +
            `Live sniper is armed.\n` +
            `Amount: *${buyDefaults.solAmount} SOL*\n` +
            `Slippage: *${buyDefaults.slippage}%*\n` +
            `Fee: *${buyDefaults.fee} SOL*`,
          buildRealtimeSnipeMenu(rt),
        );
      }
    }
  });

} 
module.exports = { setupMessages };

async function refreshCwScreen(ctx, userId, cwId) {
  const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(cwId, userId);
  if (!cw) return;
  const wallets = db.getWallets(userId) || [];
  const { buildCwScreen } = require("./callbacks.copytrade");
  const { msg, kb } = buildCwScreen(cw, wallets);
  const viewMsgId = parseInt(db.getSysConfig(`cw_view_msg_${userId}`) || "0");
  const chatId = ctx.chat?.id;
  if (viewMsgId && chatId) {
    try { await ctx.api.editMessageText(chatId, viewMsgId, msg, { parse_mode: "Markdown", reply_markup: kb }); return; } catch {}
  }
  const sent = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
  db.setSysConfig(`cw_view_msg_${userId}`, String(sent.message_id));
}

