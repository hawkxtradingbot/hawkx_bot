// M04 — Router V12 — All callbacks wired
const { handleStart }       = require("./onboarding");
const { showSettings, handleSettingCallback, handleTextInput, doExportKey } = require("./settings");
const { getPortfolio, getTokenPosition } = require("./portfolio");
const { mockBuy, mockSell, handleAutoBuy, executeRealtimeSnipe } = require("./executor");
const { addWallet, deleteWallet, decryptWallet, isSolanaAddress } = require("./walletVault");
const { getActiveWallet, setActiveWallet, getBalance } = require("./walletSwitcher");
const { handleFaucet }      = require("./faucet");
const { buildReferralMessage, addPromoter, removePromoter } = require("./referrals");
const { showAdminPanel, handleAdminCallback, handleAdminTextInput, isAdmin } = require("./admin");
const {
  buildMainMenu, buildSettingsMenu, buildWalletMenu,
  buildWalletDeleteSelect, buildWalletExportSelect,
  buildCopyTradeMenu, buildCopyWalletListMenu, buildCopyChannelListMenu,
  buildCopyChannelSettingsMenu, buildSniperMainMenu, buildAutoSniperMenu,
  buildSniperConfigMenu, buildMigrationSniperMenu, buildRealtimeSnipeMenu, buildLimitOrdersMenu,
  buildLimitOrderSetupMenu, buildWatchlistMenu, getModeLabel, getGuide,
} = require("./keyboards");
const db     = require("../../database");
const { InputFile } = require("grammy");
const config = require("../../config");
const bcrypt = require("bcryptjs");
const { getTokenInfo, formatNum, formatPrice } = require("./tokenInfo");

async function handlePnlCard(ctx, user, posId, hideAmounts) {
  const pos = db.getPosition(posId, user.user_id);
  if (!pos) { await ctx.reply("❌ Position not found."); return; }
  const { simulatePriceMovement } = require("./executor");
  const currentPrice = simulatePriceMovement(pos.token_ca);
  const pnlPct = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
  const pnlSol = pos.sol_invested * (pnlPct / 100);
  let exitMcap = 0;
  try {
    const axios = require("axios");
    const dexRes = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${pos.token_ca}`, { timeout: 4000 });
    const pairs = dexRes.data?.pairs;
    if (pairs && pairs.length > 0) exitMcap = pairs[0].fdv || pairs[0].marketCap || 0;
  } catch {}
  const loadMsg = await ctx.reply("⏳ Generating your PnL card...");
  const cardKb = {
    inline_keyboard: [[{ text: "← Back to Portfolio", callback_data: "menu_portfolio" }]],
  };
  try {
    const { generatePnlCard } = require("./cardGenerator");
    const result = await generatePnlCard({
      username: user.username || "Trader", rankNum: user.rank || 1,
      tokenName: pos.token_name || pos.token_ca.slice(0, 8),
      pnlPct, pnlSol, entryMcap: pos.entry_mcap || 0, exitMcap, hideAmounts,
    });
    try { await ctx.api.deleteMessage(ctx.chat.id, loadMsg.message_id); } catch {}
    if (result && result.type === "photo") {
      try {
        await ctx.replyWithPhoto(new InputFile(Buffer.from(result.buffer), "pnl_card.png"), { reply_markup: cardKb });
      } catch {
        await ctx.reply("❌ Could not send card image.", { reply_markup: cardKb });
      }
    } else if (result && result.type === "text") {
      await ctx.reply(result.text, { parse_mode: "Markdown", reply_markup: cardKb });
    } else {
      await ctx.reply("❌ Card not available.", { reply_markup: cardKb });
    }
  } catch (e) {
    try { await ctx.api.deleteMessage(ctx.chat.id, loadMsg.message_id); } catch {}
    await ctx.reply("❌ Could not generate card. " + e.message, { reply_markup: cardKb });
  }
}

async function safeEdit(ctx, text, keyboard) {
  const mdOpts   = { parse_mode: "Markdown", reply_markup: keyboard };
  const plainOpts = { reply_markup: keyboard };
  try {
    await ctx.editMessageText(text, mdOpts);
  } catch (e) {
    if (e?.description?.includes("parse entities") || e?.description?.includes("can't parse")) {
      try { await ctx.editMessageText(text, plainOpts); } catch { await ctx.reply(text, plainOpts); }
    } else {
      try { await ctx.reply(text, mdOpts); }
      catch (e2) {
        if (e2?.description?.includes("parse entities") || e2?.description?.includes("can't parse")) {
          await ctx.reply(text, plainOpts);
        }
      }
    }
  }
}

async function safeReply(ctx, text, extra = {}) {
  try {
    await ctx.reply(text, { parse_mode: "Markdown", ...extra });
  } catch (e) {
    if (e?.description?.includes("parse entities") || e?.description?.includes("can't parse")) {
      const { parse_mode, ...rest } = extra;
      await ctx.reply(text, rest);
    } else { throw e; }
  }
}

function stripMd(str) {
  return String(str || "").replace(/[_*`[\]()~>#+=|{}.!\-]/g, "");
}

async function deleteUserMsg(ctx) {
  try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
}

async function showCwSetupScreen(ctx, userId, chatId = null) {
  const addr     = db.getSysConfig(`cw_pending_addr_${userId}`) || "";
  const name     = db.getSysConfig(`cw_pending_name_${userId}`) || "";
  const freshUser = db.getUser(userId);
  const walletId = parseInt(db.getSysConfig(`cw_pending_wallet_${userId}`)) || freshUser.active_wallet_id;
  const sol      = db.getSysConfig(`cw_pending_sol_${userId}`) || "0.1";
  const copySell = db.getSysConfig(`cw_pending_copysell_${userId}`) !== "0";
  const slippage = db.getSysConfig(`cw_pending_slippage_${userId}`) || "50";
  const gas      = db.getSysConfig(`cw_pending_gas_${userId}`) || "0.005";
  const wallets  = db.getWallets(userId) || [];
  const selWal   = wallets.find(w => w.wallet_id === walletId);
  const walletIdx = selWal ? wallets.indexOf(selWal) + 1 : 1;
  const expanded  = db.getSysConfig(`cw_wallet_expanded_${userId}`) === "1";

  const walletBtns = [];
  for (let i = 0; i < wallets.length; i += 3) {
    walletBtns.push(wallets.slice(i, i + 3).map((w, idx) => {
      const num   = i + idx + 1;
      const isSel = w.wallet_id === walletId;
      return { text: isSel ? `W${num} ✅` : `W${num}`, callback_data: `cw_setwallet_${w.wallet_id}` };
    }));
  }

  const msg =
    `👛 *Add Copy Wallet*\n\n` +
    `📚 *Guide:*\n` +
    `🎯 Paste wallet address to follow\n` +
    `📝 Give it a name (optional)\n` +
    `💼 Select your wallet to use\n` +
    `💰 Set buy amount per trade\n` +
    `🔄 Copy Sell — auto-sell when they sell\n` +
    `📊 Slippage — applies to buy & sell\n` +
    `⛽ Gas Fee — applies to buy & sell\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Follow:* ${addr ? `\`${addr}\`` : "❗ Not set"}\n` +
    `📝 *Name:* ${stripMd(name) || "Not set"}\n` +
    `💼 *Your Wallet:* W${walletIdx}\n` +
    `💰 *Buy Amount:* ${sol} SOL\n` +
    `🔄 *Copy Sell:* ${copySell ? "ON ✅" : "OFF ❌"}\n` +
    `📊 *Slippage:* ${slippage}%\n` +
    `⛽ *Gas Fee:* ${gas} SOL\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `_Tap any button below to change:_`;

  const keyboard = { inline_keyboard: [
    [{ text: "🎯 Paste Follow Address", callback_data: "cw_paste_address" }],
    [{ text: "📝 Set Name",             callback_data: "cw_set_name"      },
     { text: "💰 Buy Amount",           callback_data: "cw_set_amount"    }],
    ...(expanded
      ? [...walletBtns, [{ text: "▲ Hide Wallets", callback_data: "cw_hide_wallets" }]]
      : [[{ text: `💼 W${walletIdx} ✅ ▼ tap to change`, callback_data: "cw_show_wallets" }]]
    ),
    [{ text: `🔄 Copy Sell: ${copySell ? "ON ✅" : "OFF ❌"}`, callback_data: "cw_toggle_copysell" }],
    [{ text: `📊 Slippage: ${slippage}%`, callback_data: "cw_set_slippage" },
     { text: `⛽ Gas: ${gas} SOL`,        callback_data: "cw_set_gas"      }],
    [{ text: `🤖 Auto Sell: ${copySell ? "ON ✅" : "OFF ❌"}`, callback_data: `cw_autosell_${userId}` }],
    [{ text: "✅ Add Copy Wallet",        callback_data: "cw_confirm_add"  }],
    [{ text: "← Back",                   callback_data: "copy_wallet_menu" }],
  ]};

  // If chatId provided (from text handler) — send new message and save its ID
  if (chatId) {
    try {
      const setupMsgId = db.getSysConfig(`cw_setup_msg_${userId}`);
      if (setupMsgId) {
        try {
          await ctx.api.editMessageText(chatId, parseInt(setupMsgId), msg, { parse_mode: "Markdown", reply_markup: keyboard });
          return;
        } catch {}
      }
      const sent = await ctx.api.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
      db.setSysConfig(`cw_setup_msg_${userId}`, String(sent.message_id));
    } catch (e) {
      await ctx.api.sendMessage(chatId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
    }
    return;
  }

  // Normal callback — use safeEdit
  const opts = { parse_mode: "Markdown", reply_markup: keyboard };
  try { await ctx.editMessageText(msg, opts); }
  catch {
    const sent = await ctx.reply(msg, opts);
    db.setSysConfig(`cw_setup_msg_${userId}`, String(sent.message_id));
  }
}

// ── Referral screen builder ───────────────────────────────────
async function buildReferralScreen(ctx, userId, showWallets) {
  const freshUser   = db.getUser(userId);
  const pending2    = db.getPendingEarnings(userId);
  const total       = db.getTotalEarnings(userId);
  const paid        = db.getPaidEarnings(userId);
  const dirCount    = db.getDirectReferralCount(userId);
  const isPromoter  = freshUser.promoter_status === 1;
  const botName     = "hawkx_devnet_fazle_bot"
  const refLink     = `https://t.me/${botName}?start=REF_${userId}_${freshUser.username || "user"}`;
  const wallets     = db.getWallets(userId) || [];

  let payoutAddress = db.getSysConfig(`payout_wallet_${userId}`);
  if (!payoutAddress && wallets.length > 0) {
    payoutAddress = wallets[0].public_key;
    db.setSysConfig(`payout_wallet_${userId}`, payoutAddress);
  }

  const payoutWallet = wallets.find((w) => w.public_key === payoutAddress);
  const payoutIdx    = payoutWallet ? wallets.indexOf(payoutWallet) + 1 : null;
  const payoutLabel  = payoutIdx ? `W${payoutIdx}` : "Custom";

  let msg = `💰 *HawkX Referrals*\n\n`;
  if (isPromoter) msg += `🌟 *Promoter Account* — L1: 35%\n\n`;
  msg += `*Your Rates:*\n`;
  msg += `L1: ${isPromoter ? "35" : "30"}% | L2: 4% | L3: 3% | L4: 2% | L5: 1.5% | L6: 1%\n\n`;
  msg += `👥 Direct referrals: *${dirCount}*\n`;
  msg += `💎 Total earned: *${(total?.total || 0).toFixed(6)} SOL*\n`;
  msg += `✅ Paid: *${(paid?.total || 0).toFixed(6)} SOL*\n`;
  msg += `⏳ Pending: *${(pending2?.total || 0).toFixed(6)} SOL*\n\n`;
  msg += `🔗 *Your Referral Link:*\n\`${refLink}\`\n\n`;
  msg += `💳 *Payout Wallet:* ${payoutLabel} ✅\n`;
  msg += `\`${payoutAddress || "Not set"}\`\n\n`;
  msg += `_Paid every 12 hours._`;

  if (freshUser.joiner_discount && freshUser.rank === 1) {
    msg += `\n\n🎁 *10% fee discount* active! Fee: *0.90%* instead of 1.00%.`;
  }

  let keyboard;
  if (showWallets) {
    const walletRows = [];
    for (let i = 0; i < wallets.length; i += 3) {
      walletRows.push(wallets.slice(i, i + 3).map((w, idx) => {
        const num      = i + idx + 1;
        const isActive = w.public_key === payoutAddress;
        return { text: isActive ? `W${num} ✅` : `W${num}`, callback_data: `payout_wallet_select_${w.wallet_id}` };
      }));
    }
    keyboard = {
      inline_keyboard: [
        ...walletRows,
        [{ text: "✏️ Custom Address", callback_data: "payout_wallet_custom" }],
        [{ text: "← Back",    callback_data: "menu_main" },
         { text: "🔄 Refresh", callback_data: "referral_set_payout" }],
      ],
    };
  } else {
    keyboard = {
      inline_keyboard: [
        [{ text: "💳 Set Payout Wallet", callback_data: "referral_set_payout" }],
        [{ text: "← Back",    callback_data: "menu_main" },
         { text: "🔄 Refresh", callback_data: "menu_referrals" }],
      ],
    };
  }

  try {
    await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: keyboard });
  } catch {
    try { await ctx.deleteMessage(); } catch {}
    await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: keyboard });
  }
}

function setupRouter(bot) {

  bot.command("start", async (ctx) => {
    const param = ctx.match || "";
    if (param.startsWith("pnlcard_")) {
      const posId = parseInt(param.replace("pnlcard_", ""));
      const user  = db.getUser(ctx.from.id);
      if (!user) { await ctx.reply("Please /start first."); return; }
      return handlePnlCard(ctx, user, posId, false);
    }
    return handleStart(ctx, bot);
  });
  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await showAdminPanel(ctx);
  });

  // ── Callback handler ─────────────────────────────────────────
  bot.on("callback_query:data", async (ctx) => {
    const data   = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    let user     = db.getUser(userId);

    if (!user) { await ctx.answerCallbackQuery("Please /start first."); return; }
    db.touchLastActive(userId);

    const ks = require("./killSwitch").isActive();

    // ── NOOP ──────────────────────────────────────────────────
    if (data === "noop") { await ctx.answerCallbackQuery(); return; }

    // ── MAIN MENU ─────────────────────────────────────────────
    if (data === "menu_main" || data === "menu_main_refresh") {
      await ctx.answerCallbackQuery();
      const freshUser  = db.getUser(userId);
      const todayStats = db.getTodayStats(userId, db.getUser(userId).active_wallet_id)
      const mode       = getModeLabel(freshUser);
      return safeEdit(ctx, `🦅 *HawkX* [DEVNET] — ${mode} Mode\n\n${getGuide(freshUser.mode==="pro"?"main_pro":"main_beginner")}`, buildMainMenu(freshUser, todayStats, ks));
    }

    // ── MODE SWITCH ───────────────────────────────────────────
    if (data === "mode_set_pro") {
      db.setUserMode(userId, "pro");
      await ctx.answerCallbackQuery("⚡ Pro Mode activated!");
      const freshUser = db.getUser(userId);
      return safeEdit(ctx, `🦅 *HawkX* [DEVNET] — ⚡ Pro Mode\n\n${getGuide("main_pro")}`, buildMainMenu(freshUser, db.getTodayStats(userId, db.getUser(userId).active_wallet_id), ks));
    }

    if (data === "mode_set_beginner") {
      db.setUserMode(userId, "beginner");
      await ctx.answerCallbackQuery("🌱 Beginner Mode activated!");
      const freshUser = db.getUser(userId);
      return safeEdit(ctx, `🦅 *HawkX* [DEVNET] — 🌱 Beginner Mode\n\n${getGuide("main_beginner")}`, buildMainMenu(freshUser, db.getTodayStats(userId, db.getUser(userId).active_wallet_id), ks));
    }

    // ── RANK INFO ─────────────────────────────────────────────
    if (data === "menu_rank_info") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const { buildRankInfoMessage } = require("./keyboards");
      return ctx.reply(buildRankInfoMessage(freshUser), {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "menu_main" }]] },
      });
    }

    // ── STATS ─────────────────────────────────────────────────
    if (data === "menu_stats") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const today     = db.getTodayStats(userId, freshUser.active_wallet_id);
      const allTime   = db.getUserStats(userId);
      const weekly    = db.getWeeklyPnl(userId);
      const monthly   = db.getMonthlyPnl(userId);
      const vol       = freshUser.cumulative_volume_sol || 0;
      const { RANKS } = require("./keyboards");
      const rank      = RANKS[freshUser.rank] || RANKS[1];

      let msg = `📊 *Your Stats* [DEVNET]\n\n`;
      msg += `🏅 Rank: *${rank.name}* (${freshUser.rank}/7)\n`;
      msg += `💎 Fee: *${rank.fee.toFixed(2)}%*\n`;
      msg += `📈 Total Volume: *${vol.toFixed(4)} SOL*\n\n`;
      const ts = (today.pnl||0) >= 0 ? "+" : "";
      msg += `*Today:* P&L: *${ts}${(today.pnl||0).toFixed(4)} SOL* · ${today.trades||0} trades · ${today.winRate||0}% win\n`;
      const ws = weekly >= 0 ? "+" : "";
      const ms = monthly >= 0 ? "+" : "";
      msg += `*Weekly:* *${ws}${weekly.toFixed(4)} SOL*\n`;
      msg += `*Monthly:* *${ms}${monthly.toFixed(4)} SOL*\n`;
      msg += `*Win Rate:* ${allTime.winRate||0}% · *Loss Rate:* ${allTime.lossRate||0}%\n`;

      return ctx.reply(msg, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏅 My Rank Card", callback_data: "gen_rank_card" }],
            [{ text: "🔄 Refresh", callback_data: "menu_stats" }],
            [{ text: "← Back",    callback_data: "menu_main" }],
          ],
        },
      });
    }

    // ── SETTINGS ──────────────────────────────────────────────
    if (data === "menu_settings") { await ctx.answerCallbackQuery(); return showSettings(ctx, user); }

      if (data.startsWith("set_") || data.startsWith("bset_") || data.startsWith("pset_") || data.startsWith("sap_") || data.startsWith("alert_") || data.startsWith("ast_") || data.startsWith("ab_") || data === "pset_autosell_screen" || data === "pset_autobuy_screen") {
      if (data.startsWith("lang_")) {
        const lang = data.replace("lang_", "");
        db.updateUser(userId, { language: lang });
        await ctx.answerCallbackQuery(`✅ Language updated`);
        return showSettings(ctx, db.getUser(userId));
      }
      return handleSettingCallback(ctx, user, data);
    }

    // ── PORTFOLIO ─────────────────────────────────────────────
    if (data === "menu_portfolio") {
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user, "all", 0, false, null);
    }

    // Filter with expand/collapse — format: pos_filter_FILTER_PAGE_SELPOSID
    if (data.startsWith("pos_filter_")) {
      const parts   = data.split("_");
      const filter  = parts[2];
      const page    = parseInt(parts[3] || "0");
      const selId   = parseInt(parts[4] || "0") || null;
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user, filter, page, false, selId);
    }

    // Expand filter dropdown — format: pos_expand_FILTER_PAGE
    if (data.startsWith("pos_expand_")) {
      const parts  = data.split("_");
      const filter = parts[2];
      const page   = parseInt(parts[3] || "0");
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user, filter, page, true, null);
    }

    // Select token on same screen — format: pos_select_POSID_FILTER_PAGE
    if (data.startsWith("pos_select_")) {
      const parts   = data.split("_");
      const posId   = parseInt(parts[2]);
      const filter  = parts[3] || "all";
      const page    = parseInt(parts[4] || "0");
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user, filter, page, false, posId);
    }

    // Token position detail (from refresh)
    if (data.startsWith("pos_token_")) {
      const posId = parseInt(data.replace("pos_token_", ""));
      await ctx.answerCallbackQuery();
      const pos = db.getPosition(posId, userId);
      if (!pos || pos.status !== "open") {
        const freshUser2 = db.getUser(userId);
        return getPortfolio(ctx, freshUser2, "all", 0, false, null);
      }
      return getTokenPosition(ctx, user, posId);
    }

    // ── TRADE ─────────────────────────────────────────────────
    // FIX #2 — trade_positions (SELL button)
    if (data === "trade_positions") {
      await ctx.answerCallbackQuery();
      return getPortfolio(ctx, user);
    }

    // FIX #3 — trade_cancel (Cancel button)
    if (data === "trade_cancel") {
      await ctx.answerCallbackQuery("Cancelled.");
      db.setSysConfig(`pending_ca_${userId}`, "");
      db.setSysConfig(`pending_${userId}`, "");
      return;
    }

    if (data === "trade_quickbuy") {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return; }
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("▶▶ *Send Token CA*\n\nPaste the contract address of the token you want to buy:", { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "buy_paste_ca_first");
      return;
    }

    if (data.startsWith("buy_ca_amt_")) {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return; }
      const amt    = parseFloat(data.replace("buy_ca_amt_", ""));
      const ca = db.getSysConfig(`pending_ca_${userId}`);
      if (!ca) { await ctx.answerCallbackQuery("❌ Please paste a token CA first."); return; }
      await ctx.answerCallbackQuery();
      await mockBuy(ctx, user, ca, amt, "manual", "");
      return;
    }

    if (data === "buy_ca_custom") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("✏️ Enter custom SOL amount (e.g. 0.25):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "buy_ca_custom_amt");
      return;
    }

    // ── SELL % ────────────────────────────────────────────────
    if (data.startsWith("sell_pct_")) {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return; }
      const parts  = data.split("_");
      const pct    = parseInt(parts[2]);
      const posId  = parseInt(parts[3]);
      await ctx.answerCallbackQuery();
      const position = db.getPosition(posId, userId);
      if (!position) { await ctx.reply("❌ Position not found."); return; }
      await mockSell(ctx, user, position, pct);
      return;
    }

    if (data.startsWith("sell_quick_")) {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return; }
      const pct       = parseInt(data.replace("sell_quick_", ""));
      const positions = db.getOpenPositions(userId);
      if (!positions.length) { await ctx.answerCallbackQuery("No open positions."); return; }
      await ctx.answerCallbackQuery();
      await mockSell(ctx, user, positions[0], pct);
      return;
    }

    if (data === "sell_initial" || data.startsWith("sell_initial_")) {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return; }
      await ctx.answerCallbackQuery();
      const posId     = data.includes("_") && data !== "sell_initial" ? parseInt(data.split("_")[2]) : null;
      const positions = posId ? [db.getPosition(posId, userId)] : db.getOpenPositions(userId);
      const pos       = positions[0];
      if (!pos) { await ctx.reply("No open positions."); return; }
      const { simulatePriceMovement } = require("./executor");
      const currentPrice = simulatePriceMovement(pos.token_ca);
      const pnlPct       = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
      const currentValue = pos.sol_invested * (1 + pnlPct / 100);
      // Exact calculation: sell exactly sol_invested worth at current price
      const initialPct   = currentValue > 0 ? Math.min(100, (pos.sol_invested / currentValue) * 100) : 100;
      await mockSell(ctx, user, pos, initialPct);
      return;
    }

    if (data.startsWith("sell_limit_")) {
      const posId = data.replace("sell_limit_", "");
      db.setSysConfig(`pending_${userId}`, `set_limit_sell_${posId}`);
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("📌 *Set Limit Sell*\n\nEnter target price in SOL:", { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      return;
    }

    // ── WALLETS ───────────────────────────────────────────────
    if (data === "menu_wallets") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const wallets   = db.getWallets(userId) || [];
      const active    = db.getWallet(freshUser.active_wallet_id);
      const address   = active?.public_key || "No wallet";
      const balance   = await getBalance(address);
      // Show positions PnL filtered by active wallet only
      const allPos    = db.getOpenPositions(userId);
      const openPos   = allPos.filter((p) => p.wallet_id === freshUser.active_wallet_id);
      const { simulatePriceMovement } = require("./executor");
      let totalInv = 0, totalCur = 0;
      openPos.forEach((p) => {
        const cp = simulatePriceMovement(p.token_ca);
        const pnlPct = p.buy_price > 0 ? ((cp - p.buy_price) / p.buy_price * 100) : 0;
        totalInv += p.sol_invested;
        totalCur += p.sol_invested * (1 + pnlPct / 100);
      });
      const totalPnlSol = totalCur - totalInv;
      const totalPnlUsd = totalPnlSol * 150;
      const sign    = totalPnlSol >= 0 ? "+" : "";
      const pnlLine = openPos.length > 0
        ? `\n📈 Positions P&L: *${sign}${totalPnlSol.toFixed(4)} SOL* / $${totalPnlUsd.toFixed(2)}`
        : `\n📈 Positions P&L: *0.0000 SOL*`;
      const walletIdx = wallets.findIndex((w) => w.wallet_id === freshUser.active_wallet_id) + 1;
      return safeEdit(
        ctx,
        `💼 *Wallet Management*\n\n` +
        `Active: *W${walletIdx}*\n` +
        `📋 Address:\n\`${address}\`\n` +
        `💰 Balance: *${balance.toFixed(4)} SOL*` +
        pnlLine + `\n\n` +
        `_Tap wallet to switch. ${wallets.length}/${config.WALLET_LIMITS[freshUser.rank]||5} wallets_`,
        buildWalletMenu(wallets, freshUser.active_wallet_id)
      );
    }

    if (data.startsWith("wallet_select_")) {
      const walletId  = parseInt(data.replace("wallet_select_", ""));
      setActiveWallet(userId, walletId);
      await ctx.answerCallbackQuery("✅ Wallet switched!");
      // Refresh same wallet screen
      const freshUser = db.getUser(userId);
      const wallets   = db.getWallets(userId) || [];
      const active    = db.getWallet(walletId);
      const address   = active?.public_key || "No wallet";
      const balance   = await getBalance(address);
      // Filter positions by selected wallet only
      const allPos2   = db.getOpenPositions(userId);
      const openPos2  = allPos2.filter((p) => p.wallet_id === walletId);
      const { simulatePriceMovement: simPrice2 } = require("./executor");
      let totalInv2 = 0, totalCur2 = 0;
      openPos2.forEach((p) => {
        const cp = simPrice2(p.token_ca);
        const pnlPct = p.buy_price > 0 ? ((cp - p.buy_price) / p.buy_price * 100) : 0;
        totalInv2 += p.sol_invested;
        totalCur2 += p.sol_invested * (1 + pnlPct / 100);
      });
      const totalPnlSol2 = totalCur2 - totalInv2;
      const totalPnlUsd2 = totalPnlSol2 * 150;
      const sign2    = totalPnlSol2 >= 0 ? "+" : "";
      const pnlLine2 = openPos2.length > 0
        ? `\n📈 Positions P&L: *${sign2}${totalPnlSol2.toFixed(4)} SOL* / $${totalPnlUsd2.toFixed(2)}`
        : `\n📈 Positions P&L: *0.0000 SOL*`;
      const walletIdx2 = wallets.findIndex((w) => w.wallet_id === walletId) + 1;
      return safeEdit(
        ctx,
        `💼 *Wallet Management*\n\n` +
        `Active: *W${walletIdx2}*\n` +
        `📋 Address:\n\`${address}\`\n` +
        `💰 Balance: *${balance.toFixed(4)} SOL*` +
        pnlLine2 + `\n\n` +
        `_Tap wallet to switch. ${wallets.length}/${config.WALLET_LIMITS[freshUser.rank]||5} wallets_`,
        buildWalletMenu(wallets, walletId)
      );
    }

    if (data === "wallet_delete_select") {
      await ctx.answerCallbackQuery();
      const wallets = db.getWallets(userId) || [];
      if (wallets.length <= 1) { await ctx.answerCallbackQuery("❌ Cannot delete only wallet.", { show_alert: true }); return; }
      const freshUser = db.getUser(userId);
      return safeEdit(ctx, "🗑 *Delete Wallet*\n\nSelect which wallet to delete:", buildWalletDeleteSelect(wallets, freshUser.active_wallet_id));
    }

    if (data.startsWith("wallet_delete_confirm_")) {
      const walletId = parseInt(data.replace("wallet_delete_confirm_", ""));
      const wallet   = db.getWallet(walletId);
      if (!wallet) { await ctx.answerCallbackQuery("Not found."); return; }
      await ctx.answerCallbackQuery();
      return ctx.reply(
        `🗑 *Confirm Delete*\n\n*${stripMd(wallet.label || "")}*\n\`${wallet.public_key.slice(0,12)}...\`\n\n⚠️ Cannot be undone. Back up key first.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Delete", callback_data: `wallet_delete_do_${walletId}` },
                { text: "❌ Cancel", callback_data: "menu_wallets" },
              ],
            ],
          },
        }
      );
    }

    if (data.startsWith("wallet_delete_do_")) {
      const walletId  = parseInt(data.replace("wallet_delete_do_", ""));
      const freshUser = db.getUser(userId);
      await deleteWallet(ctx, freshUser, walletId);
      await ctx.answerCallbackQuery("✅ Deleted.");
      const wallets  = db.getWallets(userId) || [];
      const updated  = db.getUser(userId);
      const active   = db.getWallet(updated.active_wallet_id);
      const address  = active?.public_key || "No wallet";
      const balance  = await getBalance(address);
      const idx      = wallets.findIndex((w) => w.wallet_id === updated.active_wallet_id) + 1;
      const allPos   = db.getOpenPositions(userId);
      const openPos  = allPos.filter((p) => p.wallet_id === updated.active_wallet_id);
      const { simulatePriceMovement } = require("./executor");
      let totalInv = 0, totalCur = 0;
      openPos.forEach((p) => {
        const cp = simulatePriceMovement(p.token_ca);
        const pnlPct = p.buy_price > 0 ? ((cp - p.buy_price) / p.buy_price * 100) : 0;
        totalInv += p.sol_invested;
        totalCur += p.sol_invested * (1 + pnlPct / 100);
      });
      const pnlSol  = totalCur - totalInv;
      const sign    = pnlSol >= 0 ? "+" : "";
      const pnlLine = openPos.length > 0
        ? `\n📈 Positions P&L: *${sign}${pnlSol.toFixed(4)} SOL*`
        : `\n📈 Positions P&L: *0.0000 SOL*`;
      return safeEdit(
        ctx,
        `💼 *Wallet Management*\n\n` +
        `Active: *W${idx}*\n` +
        `📋 Address:\n\`${address}\`\n` +
        `💰 Balance: *${balance.toFixed(4)} SOL*` +
        pnlLine + `\n\n` +
        `_Tap wallet to switch. ${wallets.length}/${config.WALLET_LIMITS[updated.rank]||5} wallets_`,
        buildWalletMenu(wallets, updated.active_wallet_id)
      );
    }

    if (data === "wallet_generate") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const limit     = config.WALLET_LIMITS[freshUser.rank] || 5;
      const count     = db.countWallets(userId);
      if (count >= limit) {
        return ctx.reply(`❌ Wallet limit reached (${limit}). Delete one first to add more.`);
      }
      await addWallet(ctx, freshUser, "generate");
      const wallets = db.getWallets(userId) || [];
      const updated = db.getUser(userId);
      return safeEdit(ctx, `💼 *Wallet Management*`, buildWalletMenu(wallets, updated.active_wallet_id));
    }

    if (data === "wallet_import") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("📥 *Import Wallet*\n\nSend me your Solana wallet private key:", { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "wallet_import_key");
      return;
    }

    if (data === "wallet_export_select") {
      await ctx.answerCallbackQuery();
      const wallets   = db.getWallets(userId) || [];
      const freshUser = db.getUser(userId);
      const walletRows = [];
      for (let i = 0; i < wallets.length; i += 3) {
        walletRows.push(wallets.slice(i, i + 3).map((w, idx) => {
          const num = i + idx + 1;
          const isActive = w.wallet_id === freshUser.active_wallet_id;
          return { text: isActive ? `W${num} ✅` : `W${num}`, callback_data: `wallet_export_prompt_${w.wallet_id}` };
        }));
      }
      const hasPIN = freshUser.sap_enabled && freshUser.sap_hash;
      return safeEdit(ctx,
        `🔑 *Export Private Key*\n\n` +
        `${hasPIN ? "🔐 PIN required to export." : "⚠️ No PIN set — we recommend setting a PIN before exporting."}\n\n` +
        `Select wallet to export:`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
          ...walletRows,
          hasPIN ? [] : [{ text: "🔐 Set PIN First", callback_data: "set_sap" }],
          [{ text: "← Back", callback_data: "menu_wallets" }],
        ].filter(r => r.length > 0)}}
      );
    }

    if (data.startsWith("wallet_export_prompt_")) {
      const walletId  = parseInt(data.replace("wallet_export_prompt_", ""));
      const freshUser = db.getUser(userId);
      await ctx.answerCallbackQuery();
      if (freshUser.sap_enabled && freshUser.sap_hash) {
        db.setSysConfig(`sap_next_wallet_${userId}`, String(walletId));
        const msg = await ctx.reply("🔐 Enter your Security PIN to export key:");
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, "sap_verify_export");
      } else {
        // No PIN — show export anyway option
        const wallets  = db.getWallets(userId) || [];
        const num      = wallets.findIndex((w) => w.wallet_id === walletId) + 1;
        return safeEdit(ctx,
          `🔑 *Export W${num} Private Key*\n\n` +
          `⚠️ *No Security PIN set.*\n\n` +
          `For your safety, set a PIN before exporting. Anyone with your private key can access your funds.\n\n` +
          `Tap Export Anyway to show key for 20 seconds.`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
            [{ text: "🔐 Set PIN First",   callback_data: "set_sap" }],
            [{ text: "⚠️ Export Anyway",   callback_data: `wallet_export_do_${walletId}` }],
            [{ text: "← Cancel",           callback_data: "wallet_export_select" }],
          ]}}
        );
      }
      return;
    }

    if (data.startsWith("wallet_export_do_")) {
      const walletId = parseInt(data.replace("wallet_export_do_", ""));
      await ctx.answerCallbackQuery();
      await doExportKey(ctx, userId, walletId);
      return;
    }

    // ── DEPOSIT ───────────────────────────────────────────────
    if (data === "wallet_deposit") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const wallets   = db.getWallets(userId) || [];
      const activeWallet = db.getWallet(freshUser.active_wallet_id);
      const activeAddr   = activeWallet?.public_key || "No wallet";
      const activeBal    = await getBalance(activeAddr);
      const activeIdx    = wallets.findIndex((w) => w.wallet_id === freshUser.active_wallet_id) + 1;
      const walletRows   = [];
      for (let i = 0; i < wallets.length; i += 3) {
        walletRows.push(wallets.slice(i, i + 3).map((w, idx) => {
          const num = i + idx + 1;
          const isActive = w.wallet_id === freshUser.active_wallet_id;
          return { text: isActive ? `W${num} ✅` : `W${num}`, callback_data: `deposit_select_${w.wallet_id}` };
        }));
      }
      const depMsg =
        `💰 *Deposit*\n\n` +
        `Active: *W${activeIdx}* ✅\n` +
        `📋 Address:\n\`${activeAddr}\`\n\n` +
        `💰 Balance: *${activeBal.toFixed(4)} SOL*\n\n` +
        `_Select the deposit wallet._`;
      try { await ctx.editMessageText(depMsg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [...walletRows, [{ text: "← Back", callback_data: "menu_wallets" }, { text: "🔄 Refresh", callback_data: "wallet_deposit" }]] } }); }
      catch { await ctx.reply(depMsg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [...walletRows, [{ text: "← Back", callback_data: "menu_wallets" }, { text: "🔄 Refresh", callback_data: "wallet_deposit" }]] } }); }
      return;
    }

    if (data.startsWith("deposit_select_")) {
      const walletId  = parseInt(data.replace("deposit_select_", ""));
      const wallet    = db.getWallet(walletId);
      if (!wallet) { await ctx.answerCallbackQuery("Not found."); return; }
      const balance   = await getBalance(wallet.public_key);
      const wallets   = db.getWallets(userId) || [];
      const num       = wallets.findIndex((w) => w.wallet_id === walletId) + 1;
      await ctx.answerCallbackQuery(`W${num} selected`);
      const walletRows = [];
      for (let i = 0; i < wallets.length; i += 3) {
        walletRows.push(wallets.slice(i, i + 3).map((w, idx) => {
          const n2 = i + idx + 1;
          const isActive = w.wallet_id === walletId;
          return { text: isActive ? `W${n2} ✅` : `W${n2}`, callback_data: `deposit_select_${w.wallet_id}` };
        }));
      }
      const depMsg =
        `💰 *Deposit*\n\n` +
        `Active: *W${num}* ✅\n` +
        `📋 Address:\n\`${wallet.public_key}\`\n\n` +
        `💰 Balance: *${balance.toFixed(4)} SOL*\n\n` +
        `_Tap address to copy. Select a different wallet above if needed._`;
      try { await ctx.editMessageText(depMsg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [...walletRows, [{ text: "← Back", callback_data: "menu_wallets" }, { text: "🔄 Refresh", callback_data: "wallet_deposit" }]] } }); }
      catch { await ctx.reply(depMsg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [...walletRows, [{ text: "← Back", callback_data: "menu_wallets" }, { text: "🔄 Refresh", callback_data: `deposit_select_${walletId}` }]] } }); }
      return;
    }

    if (data.startsWith("deposit_show_")) {
      // Legacy — redirect to new deposit
      await ctx.answerCallbackQuery();
      return;
    }

    // ── WITHDRAW ──────────────────────────────────────────────
    if (data === "wallet_withdraw") {
      await ctx.answerCallbackQuery();
      const wallets   = db.getWallets(userId) || [];
      const freshUser = db.getUser(userId);
      const walletRows = [];
      for (let i = 0; i < wallets.length; i += 3) {
        walletRows.push(wallets.slice(i, i + 3).map((w, idx) => {
          const num = i + idx + 1;
          const isActive = w.wallet_id === freshUser.active_wallet_id;
          return { text: isActive ? `W${num} ✅` : `W${num}`, callback_data: `withdraw_from_${w.wallet_id}` };
        }));
      }
    try { await ctx.editMessageText(`💸 *Withdraw*\n\nSelect the wallet you want to withdraw from:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [...walletRows, [{ text: "← Back", callback_data: "menu_wallets" }, { text: "🔄 Refresh", callback_data: "wallet_withdraw" }]] } }); }
    catch { await ctx.reply(`💸 *Withdraw*\n\nSelect the wallet you want to withdraw from:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [...walletRows, [{ text: "← Back", callback_data: "menu_wallets" }, { text: "🔄 Refresh", callback_data: "wallet_withdraw" }]] } }); }
    return;
        }

    if (data.startsWith("withdraw_from_")) {
      const walletId = parseInt(data.replace("withdraw_from_", ""));
      const wallet   = db.getWallet(walletId);
      if (!wallet) { await ctx.answerCallbackQuery("Not found."); return; }
      const balance  = await getBalance(wallet.public_key);
      const wallets  = db.getWallets(userId) || [];
      const num      = wallets.findIndex((w) => w.wallet_id === walletId) + 1;
      await ctx.answerCallbackQuery(`W${num} selected`);

      // Fetch SPL tokens from Helius
      let splTokens = [];
      try {
        const axios  = require("axios");
        const config = require("../../config");
        if (config.HELIUS_API_KEY) {
          const res = await axios.post(
            `https://mainnet.helius-rpc.com/?api-key=${config.HELIUS_API_KEY}`,
            {
              jsonrpc: "2.0", id: 1,
              method: "getTokenAccountsByOwner",
              params: [
                wallet.public_key,
                { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { encoding: "jsonParsed" }
              ]
            },
            { timeout: 5000 }
          );
          const accounts = res.data?.result?.value || [];
          splTokens = accounts
            .map((a) => ({
              mint:    a.account.data.parsed.info.mint,
              amount:  a.account.data.parsed.info.tokenAmount.uiAmount || 0,
              symbol:  a.account.data.parsed.info.mint.slice(0,6),
            }))
            .filter((t) => t.amount > 0);
        }
      } catch {}

      // Build token buttons
      const tokenButtons = [
        [{ text: `💎 SOL (${balance.toFixed(4)})`, callback_data: `withdraw_token_SOL_${walletId}` }],
        ...splTokens.map((t) => ([{
          text: `🪙 ${t.symbol} (${t.amount.toFixed(4)})`,
          callback_data: `withdraw_token_${t.mint}_${walletId}`
        }])),
        [{ text: "← Back", callback_data: "wallet_withdraw" }],
      ];

      const withdrawMsg =
        `💸 *Withdraw from W${num}*\n\n` +
        `📋 \`${wallet.public_key}\`\n` +
        `💰 SOL Balance: *${balance.toFixed(4)} SOL*\n\n` +
        `Select token to withdraw:` +
        (splTokens.length === 0 ? `\n\n_No other tokens found in this wallet._` : "");

      try { await ctx.editMessageText(withdrawMsg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: tokenButtons } }); }
      catch { await ctx.reply(withdrawMsg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: tokenButtons } }); }
      return;
    }

      if (data.startsWith("withdraw_token_")) {
        // Format: withdraw_token_MINTADDRESS_WALLETID
        const withoutPrefix = data.replace("withdraw_token_", "");
        const lastUnderscore = withoutPrefix.lastIndexOf("_");
        const token    = withoutPrefix.slice(0, lastUnderscore);
        const walletId = parseInt(withoutPrefix.slice(lastUnderscore + 1));
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      if (freshUser.sap_enabled && freshUser.sap_hash) {
        db.setSysConfig(`sap_next_${userId}`, `withdraw_address_${token}_${walletId}`);
        const msg = await ctx.reply("🔐 Enter your Security PIN to continue:");
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, "sap_verify_withdraw");
      } else {
        // No PIN — prompt to set one or continue
        return safeEdit(ctx,
          `💸 *Withdraw ${token}*\n\n⚠️ *No Security PIN set.*\n\nFor your safety we recommend setting a PIN before withdrawing.\n\nPaste your destination Solana address to continue:`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
            [{ text: "🔐 Set PIN First", callback_data: "set_sap" }],
            [{ text: "Continue Without PIN", callback_data: `withdraw_nopinsend_${token}_${walletId}` }],
            [{ text: "← Cancel", callback_data: "wallet_withdraw" }],
          ]}}
        );
      }
      return;
    }

    if (data.startsWith("withdraw_nopinsend_")) {
      const parts    = data.split("_");
      const withoutPrefix2 = data.replace("withdraw_nopinsend_", "");
      const lastIdx2 = withoutPrefix2.lastIndexOf("_");
      const token    = withoutPrefix2.slice(0, lastIdx2);
      const walletId = parseInt(withoutPrefix2.slice(lastIdx2 + 1));
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        `💸 *Withdraw ${token}*\n\nPaste destination Solana address:\n\n⚠️ Cannot be reversed.`,
        { parse_mode: "Markdown" }
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, `withdraw_address_${token}_${walletId}`);
      return;
    }

    if (data.startsWith("withdraw_send_")) {
      const parts    = data.split("_");
      const pct      = parseInt(parts[2]);
      const token    = parts[3];
      const walletId = parseInt(parts[4]);
      await ctx.answerCallbackQuery(`Sending ${pct}% ${token}...`);
      await ctx.reply(
        `✅ *Withdraw Initiated* [DEVNET]\n\nSending *${pct}%* of ${token}.\n\n_Devnet simulation — no real funds moved._`,
        { parse_mode: "Markdown" }
      );
      return;
    }

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
      return safeEdit(ctx, `👛 *Copy Wallet*\n\n${guide}`, buildCopyWalletListMenu(cw));
    }

    if (data === "copy_wallet_add") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      db.setSysConfig(`cw_pending_wallet_${userId}`, String(freshUser.active_wallet_id));
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
      db.setSysConfig(`cw_setup_msg_${userId}`, String(ctx.callbackQuery.message.message_id));
      const msg = await ctx.reply("🎯 Paste the Solana wallet address you want to follow:");
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
      db.setSysConfig(`cw_setup_msg_${userId}`, String(ctx.callbackQuery.message.message_id));
      const msg = await ctx.reply("📝 Enter a name for this copy wallet (e.g. Whale Tracker):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "cw_name");
      return;
    }

    if (data === "cw_set_amount") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`cw_setup_msg_${userId}`, String(ctx.callbackQuery.message.message_id));
      const msg = await ctx.reply("💰 Enter buy amount in SOL per trade (e.g. 0.5):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "cw_amount");
      return;
    }

    if (data === "cw_toggle_copysell") {
      const current = db.getSysConfig(`cw_pending_copysell_${userId}`) || "1";
      db.setSysConfig(`cw_pending_copysell_${userId}`, current === "1" ? "0" : "1");
      await ctx.answerCallbackQuery(current === "1" ? "Copy Sell OFF" : "Copy Sell ON");
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
      db.setSysConfig(`cw_setup_msg_${userId}`, String(ctx.callbackQuery.message.message_id));
      const msg = await ctx.reply("📊 Enter slippage % for buy & sell (e.g. 50):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "cw_slippage");
      return;
    }

    if (data === "cw_set_gas") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`cw_setup_msg_${userId}`, String(ctx.callbackQuery.message.message_id));
      const msg = await ctx.reply("⛽ Enter gas fee in SOL for buy & sell (e.g. 0.005):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "cw_gas");
      return;
    }
    
    if (data.startsWith("copy_wallet_view_")) {
      const id = parseInt(data.replace("copy_wallet_view_", ""));
      const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
      if (!cw) { await ctx.answerCallbackQuery("Not found."); return; }
      await ctx.answerCallbackQuery();
      const wallets   = db.getWallets(userId) || [];
      const selWal    = wallets.find(w => w.wallet_id === cw.wallet_id);
      const walletIdx = selWal ? wallets.indexOf(selWal) + 1 : "—";
      const name      = cw.label || cw.wallet_address.slice(0,16) + "...";
      return safeEdit(ctx,
        `👛 *${name}*\n\n` +
        `🎯 Address:\n\`${cw.wallet_address}\`\n\n` +
        `💼 Using: *W${walletIdx}*\n` +
        `💰 Buy Amount: *${cw.sol_amount} SOL*\n` +
        `🔄 Copy Sell: *${cw.copy_sell ? "ON ✅" : "OFF ❌"}*\n` +
        `📊 Slippage: *${cw.slippage || 50}%*\n` +
        `⛽ Gas Fee: *${cw.gas_fee || 0.005} SOL*\n` +
        `Status: *${cw.active ? "🟢 Active" : "⏸ Paused"}*\n` +
        `Trades copied: *${cw.trades_executed || 0}*`,
        { inline_keyboard: [
          [{ text: cw.active ? "⏸ Pause" : "▶ Resume", callback_data: `copy_wallet_toggle_${id}` }],
          [{ text: "🗑 Delete", callback_data: `copy_wallet_delete_${id}` }],
            [{ text: "← Back",   callback_data: "copy_wallet_menu" }],
          ]}
          );
          }

          if (data.startsWith("copy_wallet_toggle_")) {
            const id = parseInt(data.replace("copy_wallet_toggle_", ""));
            const cw = db.getDb().prepare("SELECT active FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
            if (!cw) { await ctx.answerCallbackQuery("Not found."); return; }
            db.getDb().prepare("UPDATE copy_wallets SET active = ? WHERE id = ? AND user_id = ?").run(cw.active ? 0 : 1, id, userId);
            await ctx.answerCallbackQuery(cw.active ? "⏸ Paused" : "▶ Resumed");
            return safeEdit(ctx, `👛 *Copy Wallet*

📚 *Guide:*
➕ Add — add a wallet to copy
🟢 Active — tap to view details
⏸ Pause — stops copying trades
▶ Resume — starts copying again
🗑 Delete — remove permanently
⏸ Pause All — stop all at once
`, buildCopyWalletListMenu(db.getCopyWallets(userId)));
          }
    if (data.startsWith("copy_wallet_delete_")) {
      const id = parseInt(data.replace("copy_wallet_delete_", ""));
      db.getDb().prepare("DELETE FROM copy_wallets WHERE id = ? AND user_id = ?").run(id, userId);
      await ctx.answerCallbackQuery("🗑 Deleted.");
      return safeEdit(ctx, `👛 *Copy Wallet*

📚 *Guide:*
➕ Add — add a wallet to copy
🟢 Active — tap to view details
⏸ Pause — stops copying trades
▶ Resume — starts copying again
🗑 Delete — remove permanently
⏸ Pause All — stop all at once
`, buildCopyWalletListMenu(db.getCopyWallets(userId)));
    }
    if (data.startsWith("cw_autosell_")) {

      // Toggle ON/OFF
      if (data.startsWith("cw_autosell_toggle_")) {
        const id = parseInt(data.replace("cw_autosell_toggle_", ""));
        const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
        if (!cw) { await ctx.answerCallbackQuery("Not found."); return; }
        db.getDb().prepare("UPDATE copy_wallets SET auto_sell_enabled = ? WHERE id = ? AND user_id = ?").run(cw.auto_sell_enabled ? 0 : 1, id, userId);
        await ctx.answerCallbackQuery(cw.auto_sell_enabled ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅");
        const { buildWalletAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(userId);
        const updated = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
        try { await ctx.editMessageReplyMarkup({ reply_markup: buildWalletAutoSellScreen(updated, templates) }); } catch {}
        return;
      }

      // Open auto sell screen
      if (!data.startsWith("cw_autosell_use_") && !data.startsWith("cw_autosell_new_") && !data.startsWith("cw_autosell_toggle_")) {
        const id = parseInt(data.replace("cw_autosell_", ""));
        const cw = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(id, userId);
        if (!cw) { await ctx.answerCallbackQuery("Not found."); return; }
        await ctx.answerCallbackQuery();
        const { buildWalletAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try { await ctx.editMessageText(
          `👛 *${cw.label || cw.wallet_address.slice(0,12)} — Auto Sell*\n\n` +
          `Select a template to use for this wallet.\n` +
          `Each wallet can have its own template.`,
          { parse_mode: "Markdown", reply_markup: buildWalletAutoSellScreen(cw, templates) }
        ); } catch {}
        return;
      }

      // Select template
      if (data.startsWith("cw_autosell_use_")) {
        const withoutPrefix = data.replace("cw_autosell_use_", "");
        const lastIdx = withoutPrefix.lastIndexOf("_");
        const cwId = parseInt(withoutPrefix.slice(0, lastIdx));
        const tId  = parseInt(withoutPrefix.slice(lastIdx + 1));
        db.getDb().prepare("UPDATE copy_wallets SET auto_sell_template_id = ? WHERE id = ? AND user_id = ?").run(tId, cwId, userId);
        await ctx.answerCallbackQuery("✅ Template selected!");
        const { buildWalletAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(userId);
        const updated = db.getDb().prepare("SELECT * FROM copy_wallets WHERE id = ? AND user_id = ?").get(cwId, userId);
        try { await ctx.editMessageReplyMarkup({ reply_markup: buildWalletAutoSellScreen(updated, templates) }); } catch {}
        return;
      }

      // New template from wallet screen
      if (data.startsWith("cw_autosell_new_")) {
        const id = parseInt(data.replace("cw_autosell_new_", ""));
        db.setSysConfig(`ast_return_to_${userId}`, `cw_autosell_${id}`);
        await ctx.answerCallbackQuery();
        const msg = await ctx.reply("✏️ *New Auto Sell Template*\n\nEnter a name (e.g. Scalp 50%):", { parse_mode: "Markdown" });
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, "ast_set_name");
        return;
      }

      await ctx.answerCallbackQuery();
      return;
    }
    if (data === "copy_wallet_pause_all") {
      const cws       = db.getCopyWallets(userId);
      const anyActive = cws.some(w => w.active);
      if (anyActive) {
        db.getDb().prepare("UPDATE copy_wallets SET active = 0 WHERE user_id = ?").run(userId);
        await ctx.answerCallbackQuery("⏸ All paused.");
      } else {
        db.getDb().prepare("UPDATE copy_wallets SET active = 1 WHERE user_id = ?").run(userId);
        await ctx.answerCallbackQuery("▶ All resumed.");
      }
      return safeEdit(ctx, `👛 *Copy Wallet*

📚 *Guide:*
➕ Add — add a wallet to copy
🟢 Active — tap to view details
⏸ Pause — stops copying trades
▶ Resume — starts copying again
🗑 Delete — remove permanently
⏸ Pause All — stop all at once
`, buildCopyWalletListMenu(db.getCopyWallets(userId)));
    }
    if (data === "cw_confirm_add") {
      const addr     = db.getSysConfig(`cw_pending_addr_${userId}`);
      const name     = db.getSysConfig(`cw_pending_name_${userId}`) || null;
      const walletId = parseInt(db.getSysConfig(`cw_pending_wallet_${userId}`));
      const sol      = parseFloat(db.getSysConfig(`cw_pending_sol_${userId}`) || "0.1");
      const copySell = db.getSysConfig(`cw_pending_copysell_${userId}`) === "1";
      const slippage = parseFloat(db.getSysConfig(`cw_pending_slippage_${userId}`) || "50");
      const gas      = parseFloat(db.getSysConfig(`cw_pending_gas_${userId}`) || "0.005");
      if (!addr) { await ctx.answerCallbackQuery("❌ No address set."); return; }
      db.getDb().prepare(
        `INSERT INTO copy_wallets (user_id, wallet_address, label, sol_amount, mirror_sells, active, wallet_id, slippage, gas_fee, copy_sell)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
      ).run(userId, addr, name, sol, copySell ? 1 : 0, walletId || null, slippage, gas, copySell ? 1 : 0);
        
      // Clear pending
      [`cw_pending_addr_`, `cw_pending_name_`, `cw_pending_wallet_`,
       `cw_pending_sol_`, `cw_pending_copysell_`, `cw_pending_slippage_`, `cw_pending_gas_`
      ].forEach(k => db.setSysConfig(k + userId, ""));
      await ctx.answerCallbackQuery("✅ Copy wallet added!");
      return safeEdit(ctx, `👛 *Copy Wallet*

📚 *Guide:*
➕ Add — add a wallet to copy
🟢 Active — tap to view details
⏸ Pause — stops copying trades
▶ Resume — starts copying again
🗑 Delete — remove permanently
⏸ Pause All — stop all at once
`, buildCopyWalletListMenu(db.getCopyWallets(userId)));
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
      return safeEdit(ctx,
        `📡 *Add Copy Channel*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `*How to add your channel:*\n\n` +
        `*Step 1 — Add bot as admin*\n` +
        `Add @hawkx\\_devnet\\_fazle\\_bot as admin to your channel\\.\n` +
        `_Required for private channels_\n\n` +
        `*Step 2 — Link your channel*\n` +
        `Choose one method below:\n` +
        `━━━━━━━━━━━━━━━━━━━`,
        { inline_keyboard: [
          [{ text: "📨 Forward a Message",    callback_data: "cch_add_forward"  }],
          [{ text: "🔤 Send @channelname",    callback_data: "cch_add_username" }],
          [{ text: "🔢 Paste Channel ID",     callback_data: "cch_add_id"       }],
          [{ text: "← Back",                  callback_data: "copy_channel_menu" }],
        ]}
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
        { parse_mode: "Markdown" }
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "copy_channel_forward");
      return;
    }

    if (data === "cch_add_username") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        "🔤 Send the channel username (e.g. @HotTokens):",
        { parse_mode: "Markdown" }
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "copy_channel_id");
      return;
    }

    if (data === "cch_add_id") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        "🔢 Paste the channel ID (e.g. -1001234567890):",
        { parse_mode: "Markdown" }
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
      const sl   = ch.stop_loss_pct   || 0;
      const tp   = ch.take_profit_pct || 0;
      return safeEdit(ctx,
        `📡 *${name}*\n\n` +
        `Status: ${ch.status === "active" ? "🟢 Active" : "⏸ Paused"}\n` +
        `Signals caught: *${ch.signals_caught || 0}*\n` +
        `Trades executed: *${ch.trades_executed || 0}*\n\n` +
        `💰 Buy: *${ch.buy_amount || 0.1} SOL*\n` +
        `📊 Slippage: *${ch.slippage || 50}%*\n` +
        `⛽ Gas: *${ch.tip || 0.005} SOL*\n` +
        `🛑 SL: *${sl === 0 ? "OFF" : sl + "%"}*\n` +
        `🎯 TP: *${tp === 0 ? "OFF" : tp + "%"}*\n` +
        `🤖 Auto Sell: *Coming Soon*\n` +
        `🛡 MEV: *${ch.mev_protection ? "ON ✅" : "OFF ❌"}*\n\n` +
        `_Tap any button to change:_`,
        buildCopyChannelSettingsMenu(ch)
      );
    }

    if (data.startsWith("copy_channel_toggle_")) {
      const id = parseInt(data.replace("copy_channel_toggle_", ""));
      const ch = db.getCopyChannel(id, userId);
      if (!ch) { await ctx.answerCallbackQuery("Not found."); return; }
      const newStatus = ch.status === "active" ? "paused" : "active";
      db.updateCopyChannel(userId, id, { status: newStatus });
      await ctx.answerCallbackQuery(newStatus === "active" ? "▶ Resumed" : "⏸ Paused");
      const updated = db.getCopyChannel(id, userId);
      const name    = stripMd(updated.channel_name || updated.channel_id);
      const sl2     = updated.stop_loss_pct   || 0;
      const tp2     = updated.take_profit_pct || 0;
      return safeEdit(ctx,
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
        buildCopyChannelSettingsMenu(updated)
      );
    }

    if (data.startsWith("copy_channel_activate_")) {
      const id = parseInt(data.replace("copy_channel_activate_", ""));
      db.updateCopyChannel(userId, id, { status: "active" });
      await ctx.answerCallbackQuery("✅ Channel activated!");
      return safeEdit(ctx, "📡 *Copy Channel*", buildCopyChannelListMenu(db.getCopyChannels(userId)));
    }

    if (data.startsWith("copy_channel_delete_")) {
      const id = parseInt(data.replace("copy_channel_delete_", ""));
      db.deleteCopyChannel(userId, id);
      await ctx.answerCallbackQuery("🗑 Deleted.");
      return safeEdit(ctx, "📡 *Copy Channel*", buildCopyChannelListMenu(db.getCopyChannels(userId)));
    }
    if (data.startsWith("cch_autosell_")) {
      const parts = data.split("_");

      // Toggle ON/OFF
      if (data.startsWith("cch_autosell_toggle_")) {
        const id = parseInt(data.replace("cch_autosell_toggle_", ""));
        const ch = db.getCopyChannel(id, userId);
        if (!ch) { await ctx.answerCallbackQuery("Not found."); return; }
        db.updateCopyChannel(userId, id, { auto_sell_enabled: ch.auto_sell_enabled ? 0 : 1 });
        await ctx.answerCallbackQuery(ch.auto_sell_enabled ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅");
        const { buildChannelAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try { await ctx.editMessageReplyMarkup({ reply_markup: buildChannelAutoSellScreen(db.getCopyChannel(id, userId), templates) }); } catch {}
        return;
      }

      // Open auto sell screen
      if (data.startsWith("cch_autosell_") && !data.startsWith("cch_autosell_use_") && !data.startsWith("cch_autosell_new_") && !data.startsWith("cch_autosell_toggle_")) {
        const id = parseInt(data.replace("cch_autosell_", ""));
        const ch = db.getCopyChannel(id, userId);
        if (!ch) { await ctx.answerCallbackQuery("Not found."); return; }
        await ctx.answerCallbackQuery();
        const { buildChannelAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try { await ctx.editMessageText(
          `📡 *${ch.channel_name || ch.channel_id} — Auto Sell*\n\n` +
          `Select a template to use for this channel.\n` +
          `Each channel can have its own template.`,
          { parse_mode: "Markdown", reply_markup: buildChannelAutoSellScreen(ch, templates) }
        ); } catch {}
        return;
      }

      // Select template
      if (data.startsWith("cch_autosell_use_")) {
        const withoutPrefix = data.replace("cch_autosell_use_", "");
        const lastIdx = withoutPrefix.lastIndexOf("_");
        const chId = parseInt(withoutPrefix.slice(0, lastIdx));
        const tId  = parseInt(withoutPrefix.slice(lastIdx + 1));
        db.updateCopyChannel(userId, chId, { auto_sell_template_id: tId });
        await ctx.answerCallbackQuery("✅ Template selected!");
        const { buildChannelAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try { await ctx.editMessageReplyMarkup({ reply_markup: buildChannelAutoSellScreen(db.getCopyChannel(chId, userId), templates) }); } catch {}
        return;
      }

      // New template from channel screen
      if (data.startsWith("cch_autosell_new_")) {
        const id = parseInt(data.replace("cch_autosell_new_", ""));
        db.setSysConfig(`ast_return_to_${userId}`, `cch_autosell_${id}`);
        await ctx.answerCallbackQuery();
        const msg = await ctx.reply("✏️ *New Auto Sell Template*\n\nEnter a name (e.g. Scalp 50%):", { parse_mode: "Markdown" });
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, "ast_set_name");
        return;
      }

      await ctx.answerCallbackQuery();
      return;
    }
    if (data === "copy_channel_pause_all") {
      const ccs       = db.getCopyChannels(userId);
      const anyActive = ccs.some(c => c.status === "active");
      if (anyActive) {
        db.getDb().prepare("UPDATE copy_channels SET status = 'paused' WHERE user_id = ?").run(userId);
        await ctx.answerCallbackQuery("⏸ All paused.");
      } else {
        db.getDb().prepare("UPDATE copy_channels SET status = 'active' WHERE user_id = ?").run(userId);
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
      return safeEdit(ctx, guide, buildCopyChannelListMenu(db.getCopyChannels(userId)));
    }

    if (data.startsWith("cch_")) {
      const parts    = data.split("_");
      const action   = parts[1];
      const id       = parseInt(parts[parts.length - 1]);
      const ch       = db.getCopyChannel(id, userId);
      if (!ch) { await ctx.answerCallbackQuery("Not found."); return; }

      const toggleMap = {
        mev:      "mev_protection",
        autosell: "auto_sell_enabled",
        mint:     "mint_auth_revoked",
        freeze:   "freeze_auth_revoked",
      };

      if (toggleMap[action]) {
        const field  = toggleMap[action];
        const newVal = ch[field] ? 0 : 1;
        db.updateCopyChannel(userId, id, { [field]: newVal });
        await ctx.answerCallbackQuery(`✅ Updated`);
        const updated = db.getCopyChannel(id, userId);
        return safeEdit(ctx, `📡 *${updated.channel_name}*`, buildCopyChannelSettingsMenu(updated));
      }

      const promptMap = {
        buy:     { pending: `cch_set_buy_${id}`,     msg: "Enter buy amount SOL (e.g. 0.1):"             },
        slip:    { pending: `cch_set_slip_${id}`,    msg: "Enter slippage % (e.g. 50):"                  },
        tip:     { pending: `cch_set_tip_${id}`,     msg: "Enter Jito tip SOL (e.g. 0.0075):"            },
        sl:      { pending: `cch_set_sl_${id}`,      msg: "Enter stop loss % (negative, e.g. -30) or 0:" },
        tp:      { pending: `cch_set_tp_${id}`,      msg: "Enter take profit % (e.g. 100) or 0:"         },
        maxbuys: { pending: `cch_set_maxbuys_${id}`, msg: "Enter max buys per signal (e.g. 1):"          },
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

    // ── SNIPER ────────────────────────────────────────────────
    if (data === "menu_sniper") {
      await ctx.answerCallbackQuery();
      return safeEdit(ctx, `🎯 *Sniper*\n\n${getGuide("sniper")}`, buildSniperMainMenu());
    }

    if (data === "sniper_auto_menu") {
      await ctx.answerCallbackQuery();
      const configs = db.getSniperConfigs(userId);
      return safeEdit(ctx, "🎯 *Auto Sniper*\n\nSnipes any new Solana token launch automatically.", buildAutoSniperMenu(configs));
    }

    if (data === "sniper_config_new") {
      await ctx.answerCallbackQuery();
      const id  = db.createSniperConfig(userId, `Setup ${db.getSniperConfigs(userId).length + 1}`, "auto");
      const cfg = db.getSniperConfig(id, userId);
      return safeEdit(ctx, `🎯 *New Auto Sniper Setup*\n\nConfigure your sniper:`, buildSniperConfigMenu(cfg));
    }

    if (data.startsWith("sniper_config_view_")) {
      const id  = parseInt(data.replace("sniper_config_view_", ""));
      const cfg = db.getSniperConfig(id, userId);
      if (!cfg) { await ctx.answerCallbackQuery("Not found."); return; }
      await ctx.answerCallbackQuery();
      return safeEdit(ctx, `🎯 *${cfg.label}*\n\nEdit your sniper setup:`, buildSniperConfigMenu(cfg));
    }

    if (data.startsWith("sniper_config_save_")) {
      const id = parseInt(data.replace("sniper_config_save_", ""));
      db.updateSniperConfig(userId, id, { active: 1 });
      await ctx.answerCallbackQuery("✅ Setup saved & activated!");
      return safeEdit(ctx, "🎯 *Auto Sniper*", buildAutoSniperMenu(db.getSniperConfigs(userId)));
    }

    if (data.startsWith("sniper_config_delete_")) {
      const id = parseInt(data.replace("sniper_config_delete_", ""));
      db.deleteSniperConfig(userId, id);
      await ctx.answerCallbackQuery("🗑 Deleted.");
      return safeEdit(ctx, "🎯 *Auto Sniper*", buildAutoSniperMenu(db.getSniperConfigs(userId)));
    }

    if (data === "sniper_migration_menu") {
      await ctx.answerCallbackQuery();
      const snipes = db.getActiveSnipes(userId);
      db.setSysConfig(`sniper_screen_${userId}`, "migration");
      return safeEdit(ctx, `🔀 *Migration Sniper*\n\n${getGuide("sniper")}\n\nSnipes tokens migrating from PumpFun → Raydium.`, buildMigrationSniperMenu(snipes));
    }

    if (data === "sniper_migration_new") {
      await ctx.answerCallbackQuery();
      const templates = db.getAutoSellTemplates(userId);
      const freshUser = db.getUser(userId);
      const wallets   = db.getWallets(userId) || [];
      const walletIdx = wallets.findIndex(w => w.wallet_id === freshUser.active_wallet_id) + 1;
      const sol       = db.getSysConfig(`msnipe_sol_${userId}`) || "0.1";
      const slippage  = db.getSysConfig(`msnipe_slip_${userId}`) || "50";
      const gas       = db.getSysConfig(`msnipe_gas_${userId}`) || "0.005";
      const mev       = db.getSysConfig(`msnipe_mev_${userId}`) === "1";
      const tplId     = parseInt(db.getSysConfig(`msnipe_tpl_${userId}`) || "0");
      const tpl       = tplId ? templates.find(t => t.id === tplId) : null;
      const asOn      = db.getSysConfig(`msnipe_as_${userId}`) === "1";

      const msg =
        `🔀 *New Migration Snipe*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `📚 *HOW IT WORKS:*\n` +
        `Snipes any token launching on Raydium\n` +
        `migrating from PumpFun or new launch\n` +
        `at ~68K market cap automatically.\n` +
        `No CA needed — bot catches it live.\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 *Amount:* ${sol} SOL\n` +
        `📉 *Slippage:* ${slippage}%\n` +
        `⛽ *Gas:* ${gas} SOL\n` +
        `🛡 *MEV:* ${mev ? "ON ✅" : "OFF ❌"}\n` +
        `💼 *Wallet:* W${walletIdx}\n` +
        `🤖 *Auto Sell:* ${asOn ? `ON ✅ — ${tpl?.name||"No template"}` : "OFF ❌"}\n` +
        `━━━━━━━━━━━━━━━━━━━`;

      const keyboard = { inline_keyboard: [
        [{ text: `💰 Amount: ${sol} SOL`,   callback_data: "msnipe_set_sol"  },
         { text: `📉 Slip: ${slippage}%`,   callback_data: "msnipe_set_slip" }],
        [{ text: `⛽ Gas: ${gas} SOL`,       callback_data: "msnipe_set_gas"  },
         { text: mev ? "🛡 MEV: ON ✅" : "🛡 MEV: OFF ❌", callback_data: "msnipe_toggle_mev" }],
        [{ text: `🤖 Auto Sell: ${asOn ? "ON ✅" : "OFF ❌"}`, callback_data: "msnipe_toggle_as" }],
        ...(asOn ? [
          ...(templates.length ? templates.map(t => ([{
            text: `${tplId === t.id ? "✅" : "◻️"} ${t.name}`,
            callback_data: `msnipe_tpl_${t.id}`
          }])) : [[{ text: "No templates yet", callback_data: "noop" }]]),
          [{ text: "➕ New Template", callback_data: "msnipe_new_tpl" }],
        ] : []),
        [{ text: "✅ Start Sniping", callback_data: "msnipe_confirm" }],
        [{ text: "← Back", callback_data: "sniper_migration_menu" }],
      ]};

      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: keyboard }); }
      catch { await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: keyboard }); }
      return;
    }

    if (data.startsWith("msnipe_")) {
      if (data === "msnipe_set_sol") {
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("💰 Enter snipe amount in SOL (e.g. 0.5):");
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "msnipe_sol");
        return;
      }
      if (data === "msnipe_set_slip") {
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("📉 Enter slippage % (e.g. 50):");
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "msnipe_slip");
        return;
      }
      if (data === "msnipe_set_gas") {
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("⛽ Enter gas fee in SOL (e.g. 0.005):");
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "msnipe_gas");
        return;
      }
      if (data === "msnipe_toggle_mev") {
        const mev = db.getSysConfig(`msnipe_mev_${userId}`) === "1";
        db.setSysConfig(`msnipe_mev_${userId}`, mev ? "0" : "1");
        await ctx.answerCallbackQuery(mev ? "🛡 MEV OFF" : "🛡 MEV ON ✅");
        // Refresh screen
        const fakeData = "sniper_migration_new";
        ctx.callbackQuery.data = fakeData;
        return;
      }
      if (data === "msnipe_toggle_as") {
        const asOn = db.getSysConfig(`msnipe_as_${userId}`) === "1";
        db.setSysConfig(`msnipe_as_${userId}`, asOn ? "0" : "1");
        await ctx.answerCallbackQuery(asOn ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅");
        ctx.callbackQuery.data = "sniper_migration_new";
        return;
      }
      if (data.startsWith("msnipe_tpl_")) {
        const tId = parseInt(data.replace("msnipe_tpl_", ""));
        db.setSysConfig(`msnipe_tpl_${userId}`, String(tId));
        await ctx.answerCallbackQuery("✅ Template selected!");
        ctx.callbackQuery.data = "sniper_migration_new";
        return;
      }
      if (data === "msnipe_new_tpl") {
        db.setSysConfig(`ast_return_to_${userId}`, "sniper_migration_new");
        await ctx.answerCallbackQuery();
        const m = await ctx.reply("✏️ *New Auto Sell Template*\n\nEnter a name:", { parse_mode: "Markdown" });
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "ast_set_name");
        return;
      }
      if (data === "msnipe_confirm") {
        const sol      = parseFloat(db.getSysConfig(`msnipe_sol_${userId}`) || "0.1");
        const slippage = parseFloat(db.getSysConfig(`msnipe_slip_${userId}`) || "50");
        const gas      = parseFloat(db.getSysConfig(`msnipe_gas_${userId}`) || "0.005");
        const mev      = db.getSysConfig(`msnipe_mev_${userId}`) === "1";
        const tplId    = parseInt(db.getSysConfig(`msnipe_tpl_${userId}`) || "0");
        const asOn     = db.getSysConfig(`msnipe_as_${userId}`) === "1";
        db.addSnipe(userId, null, sol, slippage, null, { gas, mev, auto_sell_template_id: asOn ? tplId : null });
        await ctx.answerCallbackQuery("✅ Migration Snipe Armed!");
        const snipes = db.getActiveSnipes(userId);
        return safeEdit(ctx,
          `🔀 *Migration Sniper*\n\n${getGuide("sniper")}\n\nSnipes tokens migrating from PumpFun → Raydium at ~68K mcap.`,
          buildMigrationSniperMenu(snipes)
        );
      }
      await ctx.answerCallbackQuery();
      return;
    }
    if (data.startsWith("sniper_autosell_")) {

      // Open auto sell screen
      if (!data.startsWith("sniper_autosell_toggle_") && !data.startsWith("sniper_autosell_use_") && !data.startsWith("sniper_autosell_new_")) {
        const id = parseInt(data.replace("sniper_autosell_", ""));
        const cfg = db.getSniperConfig(id, userId);
        if (!cfg) { await ctx.answerCallbackQuery("Not found."); return; }
        await ctx.answerCallbackQuery();
        const { buildSniperAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try { await ctx.editMessageText(
          `🎯 *${cfg.label} — Auto Sell*\n\n` +
          `Select a template for this sniper setup.`,
          { parse_mode: "Markdown", reply_markup: buildSniperAutoSellScreen(cfg, templates) }
        ); } catch {}
        return;
      }

      // Toggle ON/OFF
      if (data.startsWith("sniper_autosell_toggle_")) {
        const id = parseInt(data.replace("sniper_autosell_toggle_", ""));
        const cfg = db.getSniperConfig(id, userId);
        if (!cfg) { await ctx.answerCallbackQuery("Not found."); return; }
        db.updateSniperConfig(userId, id, { auto_sell_enabled: cfg.auto_sell_enabled ? 0 : 1 });
        await ctx.answerCallbackQuery(cfg.auto_sell_enabled ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅");
        const { buildSniperAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try { await ctx.editMessageReplyMarkup({ reply_markup: buildSniperAutoSellScreen(db.getSniperConfig(id, userId), templates) }); } catch {}
        return;
      }

      // Select template
      if (data.startsWith("sniper_autosell_use_")) {
        const withoutPrefix = data.replace("sniper_autosell_use_", "");
        const lastIdx = withoutPrefix.lastIndexOf("_");
        const cfgId = parseInt(withoutPrefix.slice(0, lastIdx));
        const tId   = parseInt(withoutPrefix.slice(lastIdx + 1));
        db.updateSniperConfig(userId, cfgId, { auto_sell_template_id: tId });
        await ctx.answerCallbackQuery("✅ Template selected!");
        const { buildSniperAutoSellScreen } = require("./keyboards");
        const templates = db.getAutoSellTemplates(userId);
        try { await ctx.editMessageReplyMarkup({ reply_markup: buildSniperAutoSellScreen(db.getSniperConfig(cfgId, userId), templates) }); } catch {}
        return;
      }

      // New template from sniper screen
      if (data.startsWith("sniper_autosell_new_")) {
        const id = parseInt(data.replace("sniper_autosell_new_", ""));
        db.setSysConfig(`ast_return_to_${userId}`, `sniper_autosell_${id}`);
        await ctx.answerCallbackQuery();
        const msg = await ctx.reply("✏️ *New Auto Sell Template*\n\nEnter a name (e.g. Scalp 50%):", { parse_mode: "Markdown" });
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, "ast_set_name");
        return;
      }

      await ctx.answerCallbackQuery();
      return;
    }
    if (data === "sniper_pause_all") {
      db.pauseAllSnipes(userId);
      await ctx.answerCallbackQuery("⏸ All snipes paused.");
      const screen = db.getSysConfig(`sniper_screen_${userId}`) || "main";
      if (screen === "migration") {
        return safeEdit(ctx, `🔀 *Migration Sniper*\n\n${getGuide("sniper")}\n\nSnipes tokens migrating from PumpFun → Raydium.`, buildMigrationSniperMenu(db.getActiveSnipes(userId)));
      }
      if (screen === "realtime") {
        return safeEdit(ctx, `⚡ *Real-Time Snipe*\n\n${getGuide("sniper")}\n\nSnipe Raydium launches or migrating tokens live without pasting a CA.`, buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)));
      }
      return safeEdit(ctx, `🎯 *Sniper*\n\n${getGuide("sniper")}`, buildSniperMainMenu());
    }

    if (data === "sniper_realtime_menu") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`sniper_screen_${userId}`, "realtime");
      return safeEdit(ctx, `⚡ *Real-Time Snipe*\n\n${getGuide("sniper")}\n\nSnipe Raydium launches or migrating tokens live without pasting a CA.`, buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)));
    }

    if (data === "sniper_rt_toggle") {
      await ctx.answerCallbackQuery();
      const cfg = db.getRealtimeSniperConfig(userId);
      db.updateRealtimeSniperConfig(userId, { sniper_rt_enabled: cfg.enabled ? 0 : 1 });
      db.setSysConfig(`sniper_screen_${userId}`, "realtime");
      return safeEdit(ctx, `⚡ *Real-Time Snipe*\n\n${getGuide("sniper")}\n\nSnipe Raydium launches or migrating tokens live without pasting a CA.`, buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)));
    }
    if (data === "sniper_rt_autosell") {
      await ctx.answerCallbackQuery();
      const rtCfg    = db.getRealtimeSniperConfig(userId);
      const templates = db.getAutoSellTemplates(userId);
      const tplId    = rtCfg?.auto_sell_template_id || 0;
      const asOn     = rtCfg?.auto_sell_enabled || 0;
      const tpl      = templates.find(t => t.id === tplId);

      const msg =
        `⚡ *Real-Time Snipe — Auto Sell*\n\n` +
        `Select a template for real-time snipes.\n` +
        `Each snipe will auto-sell using this template.`;

      const keyboard = { inline_keyboard: [
        [{ text: asOn ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", callback_data: "sniper_rt_as_toggle" }],
        [{ text: "━━━ Select Template ━━━", callback_data: "noop" }],
        ...(templates.length ? templates.map(t => ([{
          text: `${tplId === t.id ? "✅" : "◻️"} ${t.name}`,
          callback_data: `sniper_rt_as_tpl_${t.id}`
        }])) : [[{ text: "No templates yet", callback_data: "noop" }]]),
        [{ text: "➕ New Template", callback_data: "sniper_rt_as_new" }],
        [{ text: "← Back", callback_data: "sniper_realtime_menu" }],
      ]};

      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: keyboard }); }
      catch { await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: keyboard }); }
      return;
    }

    if (data === "sniper_rt_as_toggle") {
      const rtCfg = db.getRealtimeSniperConfig(userId);
      db.updateRealtimeSniperConfig(userId, { auto_sell_enabled: rtCfg?.auto_sell_enabled ? 0 : 1 });
      await ctx.answerCallbackQuery(rtCfg?.auto_sell_enabled ? "🤖 Auto Sell OFF" : "🤖 Auto Sell ON ✅");
      ctx.callbackQuery.data = "sniper_rt_autosell";
      return;
    }

    if (data.startsWith("sniper_rt_as_tpl_")) {
      const tId = parseInt(data.replace("sniper_rt_as_tpl_", ""));
      db.updateRealtimeSniperConfig(userId, { auto_sell_template_id: tId });
      await ctx.answerCallbackQuery("✅ Template selected!");
      ctx.callbackQuery.data = "sniper_rt_autosell";
      return;
    }

    if (data === "sniper_rt_as_new") {
      db.setSysConfig(`ast_return_to_${userId}`, "sniper_rt_autosell");
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("✏️ *New Auto Sell Template*\n\nEnter a name:", { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "ast_set_name");
      return;
    }
    if (data === "sniper_rt_save") {
      await ctx.answerCallbackQuery("✅ Saved.");
      db.setSysConfig(`sniper_screen_${userId}`, "realtime");
      return safeEdit(ctx, `⚡ *Real-Time Snipe*\n\n${getGuide("sniper")}\n\nSnipe Raydium launches or migrating tokens live without pasting a CA.`, buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)));
    }

    if (data.startsWith("snipe_cancel_")) {
      const id = parseInt(data.replace("snipe_cancel_", ""));
      db.cancelSnipe(userId, id);
      await ctx.answerCallbackQuery("✅ Cancelled.");
      db.setSysConfig(`sniper_screen_${userId}`, "migration");
      return safeEdit(ctx, `🔀 *Migration Sniper*\n\n${getGuide("sniper")}\n\nSnipes tokens migrating from PumpFun → Raydium.`, buildMigrationSniperMenu(db.getActiveSnipes(userId)));
    }

    if (data.startsWith("scfg_")) {
      const parts  = data.split("_");
      const action = parts[1];
      const id     = parseInt(parts[parts.length - 1]);
      const cfg    = db.getSniperConfig(id, userId);
      if (!cfg) { await ctx.answerCallbackQuery("Not found."); return; }

      const toggles = {
        mev: "mev_protection", as: "auto_sell",
        ray: "platform_raydium", pump: "platform_pumpfun", moon: "platform_moonshot",
        rpc: "use_lightning_rpc",
      };

      if (toggles[action]) {
        const field  = toggles[action];
        const newVal = cfg[field] ? 0 : 1;
        db.updateSniperConfig(userId, id, { [field]: newVal });
        await ctx.answerCallbackQuery("✅ Updated");
        return safeEdit(ctx, `🎯 *${cfg.label}*`, buildSniperConfigMenu(db.getSniperConfig(id, userId)));
      }

      const prompts = {
        amt:  { pending: `scfg_set_amt_${id}`,  msg: "Enter snipe amount SOL:"     },
        slip: { pending: `scfg_set_slip_${id}`, msg: "Enter slippage % (e.g. 50):" },
        fee:  { pending: `scfg_set_fee_${id}`,  msg: "Enter priority fee SOL:"     },
        tip:  { pending: `scfg_set_tip_${id}`,  msg: "Enter Jito tip SOL:"         },
        max:  { pending: `scfg_set_max_${id}`,  msg: "Enter max snipes (e.g. 5):"  },
      };

      if (prompts[action]) {
        await ctx.answerCallbackQuery();
        const msg = await ctx.reply(prompts[action].msg);
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, prompts[action].pending);
        return;
      }

      await ctx.answerCallbackQuery();
      return;
    }

    // ── LIMIT ORDERS ──────────────────────────────────────────
    if (data === "menu_limit_orders") {
      await ctx.answerCallbackQuery();
      const orders = db.getLimitOrders(userId);
      return safeEdit(ctx, `📋 *Limit Orders*\n\n${getGuide("limit_orders")}`, buildLimitOrdersMenu(orders));
    }

    if (data.startsWith("limit_token_")) {
      const posId  = parseInt(data.replace("limit_token_", ""));
      const pos    = db.getPosition(posId, userId);
      const orders = db.getLimitOrders(userId);
      const hasBuy  = orders.some((o) => o.order_type === "buy"  && pos && o.token_ca === pos.token_ca);
      const hasSell = orders.some((o) => o.order_type === "sell" && pos && o.token_ca === pos.token_ca);
      await ctx.answerCallbackQuery();
      const name = pos?.token_name || pos?.token_ca?.slice(0,8) || "Token";
      return safeEdit(ctx, `📋 *Limit Orders — ${name}*`, buildLimitOrderSetupMenu(pos, hasBuy, hasSell));
    }

    if (data.startsWith("limit_cancel_")) {
      const id = parseInt(data.replace("limit_cancel_", ""));
      db.cancelLimitOrder(userId, id);
      await ctx.answerCallbackQuery("✅ Order cancelled.");
      return safeEdit(ctx, "📋 *Limit Orders*", buildLimitOrdersMenu(db.getLimitOrders(userId)));
    }

    // ── WATCHLIST ─────────────────────────────────────────────
    if (data === "menu_watchlist") {
      await ctx.answerCallbackQuery();
      const items = db.getWatchlist(userId);
      return safeEdit(ctx, `⭐ *Watchlist*\n\nTrack tokens and get alerts.`, buildWatchlistMenu(items));
    }

    if (data === "watchlist_add") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("⭐ Paste token CA to add to watchlist:");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "watchlist_add_ca");
      return;
    }

    if (data.startsWith("watchlist_remove_")) {
      const id = parseInt(data.replace("watchlist_remove_", ""));
      db.removeFromWatchlist(userId, id);
      await ctx.answerCallbackQuery("🗑 Removed.");
      return safeEdit(ctx, "⭐ *Watchlist*", buildWatchlistMenu(db.getWatchlist(userId)));
    }

    // ── REFERRALS ─────────────────────────────────────────────
    if (data === "menu_referrals") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, false);
    }

    if (data === "referral_refresh") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, false);
    }

    if (data === "referral_set_payout") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, true);
    }

    if (data.startsWith("payout_wallet_select_")) {
      const walletId = parseInt(data.replace("payout_wallet_select_", ""));
      const wallet   = db.getWallet(walletId);
      if (!wallet) { await ctx.answerCallbackQuery("Not found."); return; }
      const wallets  = db.getWallets(userId) || [];
      const num      = wallets.findIndex((w) => w.wallet_id === walletId) + 1;
      db.setSysConfig(`payout_wallet_${userId}`, wallet.public_key);
      await ctx.answerCallbackQuery(`✅ Payout set to W${num}`);
      return buildReferralScreen(ctx, userId, true);
    }

    if (data === "payout_wallet_custom") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        "✏️ *Custom Payout Address*\n\nSend any Solana wallet address:\n\n_Does not have to be a HawkX wallet._",
        { parse_mode: "Markdown" }
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "referral_payout_address");
      return;
    }
     if (data.startsWith("pnlcard_toggle_")) {
       const parts    = data.split("_");
       const posId    = parseInt(parts[2]);
       const hideAmts = parts[3] === "1";
       await ctx.answerCallbackQuery("⏳ Regenerating...");
       return handlePnlCard(ctx, user, posId, hideAmts);
     }

     if (data === "gen_rank_card") {
       await ctx.answerCallbackQuery("⏳ Generating rank card...");
       try {
         const { generateRankCard } = require("./cardGenerator");
         const freshUser = db.getUser(userId);
         const result = await generateRankCard({
           username: freshUser.username || "Trader",
           rankNum:  freshUser.rank || 1,
           volume:   freshUser.cumulative_volume_sol || 0,
         });
         if (result && result.type === "photo") {
           await ctx.replyWithPhoto(new InputFile(result.buffer, "rank_card.png"));
         } else if (result && result.type === "text") {
           await ctx.reply(result.text, { parse_mode: "Markdown" });
         } else {
           await ctx.reply("❌ Card not available.");
         }
         } catch (e) {
           await ctx.reply("❌ Could not generate card. " + e.message);
         }
         return;
       }
    // ── DEVNET TOOLS ──────────────────────────────────────────
    if (data === "devnet_faucet") { await ctx.answerCallbackQuery(); return handleFaucet(ctx, user); }

    if (data === "devnet_mock_buy") {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return; }
      await ctx.answerCallbackQuery();
      const ca = `DEVNET_TOKEN_${Date.now()}`;
      await mockBuy(ctx, user, ca, 0.1);
      return;
    }

    if (data === "devnet_mock_sell") {
      if (ks) { await ctx.answerCallbackQuery("🔴 Trading paused.", { show_alert: true }); return; }
      await ctx.answerCallbackQuery();
      const positions = db.getOpenPositions(userId);
      if (!positions.length) { await ctx.reply("No open positions to sell."); return; }
      await mockSell(ctx, user, positions[0], 100);
      return;
    }

    if (data === "devnet_add_volume") {
      db.addVolume(userId, 1);
      await ctx.answerCallbackQuery("✅ +1 SOL volume added");
      return showSettings(ctx, db.getUser(userId));
    }

    // ── HELP ──────────────────────────────────────────────────
    if (data === "menu_help") {
      await ctx.answerCallbackQuery();
      return ctx.reply(
        `❓ *HawkX Help*\n\n` +
        `*Getting Started:*\n` +
        `1. Get test SOL — 🚰 Faucet\n` +
        `2. Paste a token CA to buy\n` +
        `3. Set Stop Loss in Settings\n` +
        `4. Invite friends — Referrals\n\n` +
        `*Modes:*\n` +
        `Beginner — 8 buttons, clean and simple\n` +
        `Pro — Full features access\n\n` +
        `*Security:*\n` +
        `Set SAP PIN in Settings.\n\n` +
        `Support: @HawkXSupport`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "menu_main" }]] },
        }
      );
    }

    // ── ADMIN ─────────────────────────────────────────────────
    if (data.startsWith("admin_")) {
      if (!isAdmin(userId)) { await ctx.answerCallbackQuery("❌ Admin only."); return; }
      return handleAdminCallback(ctx, data);
    }
  // ── DEFAULT ───────────────────────────────────────────────
    await ctx.answerCallbackQuery();
  });
  // ── Forward message handler ───────────────────────────────
    bot.on("message", async (ctx) => {
      if (!ctx.message?.forward_origin && !ctx.message?.forward_from_chat) return;
    const userId  = ctx.from.id;
    const user    = db.getUser(userId);
    if (!user) return;
    const pending  = db.getSysConfig(`pending_${userId}`) || "";
    const promptId = parseInt(db.getSysConfig(`prompt_msg_${userId}`) || "0");
    if (pending !== "copy_channel_forward") return;

    await deleteMsg(ctx, promptId);
    try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
    db.setSysConfig(`pending_${userId}`, "");

    const fwd = ctx.message.forward_origin || ctx.message.forward_from_chat;
    if (!fwd) {
      await ctx.api.sendMessage(ctx.chat.id, "❌ Please forward a message from the channel.");
      return;
    }
    const channelId   = String(fwd.chat?.id || fwd.id || "");
    const channelName = stripMd(fwd.chat?.title || fwd.title || channelId);
    if (!channelId) {
      await ctx.api.sendMessage(ctx.chat.id, "❌ Could not detect channel. Try @username instead.");
      return;
    }
    db.addCopyChannel(userId, channelId, channelName, {});
    const channels = db.getCopyChannels(userId);
    const newCh    = channels.find(c => c.channel_id === channelId) || channels[0];
    const sl = newCh?.stop_loss_pct || 0;
    const tp = newCh?.take_profit_pct || 0;
    await ctx.api.sendMessage(ctx.chat.id, `✅ ${channelName} added!`);
    if (newCh) {
      await ctx.api.sendMessage(ctx.chat.id,
        `📡 ${channelName}\n\n` +
        `Status: ⏸ Paused\n` +
        `Signals caught: *0*\n` +
        `Trades executed: *0*\n\n` +
        `💰 Buy: *${newCh.buy_amount || 0.1} SOL*\n` +
        `📊 Slippage: *${newCh.slippage || 50}%*\n` +
        `⛽ Gas: *${newCh.tip || 0.005} SOL*\n` +
        `🛑 SL: *${sl === 0 ? "OFF" : sl + "%"}*\n` +
        `🎯 TP: *${tp === 0 ? "OFF" : tp + "%"}*\n` +
        `🔄 Copy Sell: *OFF ❌*\n` +
        `🛡 MEV: *OFF ❌*\n\n` +
        `_Tap any button to change:_`,
                                { reply_markup: buildCopyChannelSettingsMenu(newCh) }
      );
    }
  });
  // ── Text message handler ─────────────────────────────────────
  bot.on("message:text", async (ctx) => {
    const userId  = ctx.from.id;
    const user    = db.getUser(userId);
    if (!user) { await ctx.reply("Please /start first."); return; }

    const pending  = db.getSysConfig(`pending_${userId}`) || "";
    const text     = ctx.message.text.trim();
    console.log("[TEXT HANDLER] pending:", pending, "text:", text);
    const ks       = require("./killSwitch").isActive();
    const promptId = parseInt(db.getSysConfig(`prompt_msg_${userId}`) || "0");

    const settingsPending = [
      "set_slippage","set_sell_slippage","set_stoploss","set_takeprofit",
      "set_maxbuy","set_session","set_jito","set_custom_speed",
      "set_buy_amt_1","set_buy_amt_2","set_buy_amt_3",
      "set_sell_pct_1","set_sell_pct_2","set_sell_pct_3",
      "sap_set_new","sap_verify_change",
      "ab_set_amount","ab_set_slippage","ab_set_gas","ab_set_max",
      "ast_set_name","ast_set_sl","ast_set_tp","ast_set_tp_pct",
        "msnipe_sol","msnipe_slip","msnipe_gas",
        "cch_autosell_new_","sap_verify_export","sap_verify_withdraw","sap_verify_remove",
    ];
    console.log("[DEBUG] pending:", pending, "userId:", userId, "text:", text);
    if (settingsPending.includes(pending)) {
      const freshUser = db.getUser(userId);
      return handleTextInput(ctx, freshUser, pending);
    }

    if (pending === "wallet_import_key") {
      db.setSysConfig(`pending_${userId}`, "");
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      await addWallet(ctx, user, text);
      return;
    }

    if (pending === "sap_verify_withdraw") {
      db.setSysConfig(`pending_${userId}`, "");
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      const freshUser = db.getUser(userId);
      const valid = freshUser.sap_hash ? await bcrypt.compare(text, freshUser.sap_hash) : true;
      if (!valid) { await ctx.reply("❌ Incorrect PIN. Cancelled."); return; }
      const nextAction = db.getSysConfig(`sap_next_${userId}`);
      db.setSysConfig(`sap_next_${userId}`, "");
      if (nextAction) {
        const msg = await ctx.reply(`💸 *Withdraw*\n\nPaste destination Solana address:`, { parse_mode: "Markdown" });
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, nextAction);
      }
      return;
    }

    if (pending === "buy_custom_amount") {
      const amt = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(amt) || amt <= 0) { await ctx.reply("❌ Invalid amount."); return; }
      db.setSysConfig(`buy_pending_sol_${userId}`, String(amt));
      db.setSysConfig(`pending_${userId}`, "buy_paste_ca");
      const msg = await ctx.reply(`💰 *${amt} SOL*\n\nPaste the token CA:`, { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      return;
    }

    if (pending === "buy_paste_ca") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const sol = parseFloat(db.getSysConfig(`buy_pending_sol_${userId}`) || "0.1");
      await mockBuy(ctx, user, text, sol);
      return;
    }

    if (pending === "buy_paste_ca_first") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (text.length < 32 || text.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(text)) {
        await ctx.reply("❌ Invalid CA. Please paste a valid Solana token address.");
        return;
      }
      const settings  = db.getSettings(userId) || {};
      const b1 = settings.buy_amt_1 || 0.1;
      const b2 = settings.buy_amt_2 || 0.5;
      const b3 = settings.buy_amt_3 || 1.0;
      db.setSysConfig(`pending_ca_${userId}`, text);
      db.setSysConfig(`pending_ca_time_${userId}`, String(Date.now()));
      const tInfo   = await getTokenInfo(text);
      const dexUrl  = `https://dexscreener.com/solana/${text}`;
      const tName   = tInfo.name ? `<a href="${dexUrl}"><b>${tInfo.name}</b></a>` : `<a href="${dexUrl}"><b>${text.slice(0,8)}...</b></a>`;
      let infoLines = `🔍 ${tName}\n\n<code>${text}</code>\n\n`;
      if (tInfo.price)     infoLines += `💲 Price: ${formatPrice(tInfo.price)}\n`;
      if (tInfo.mcap)      infoLines += `📊 MCap: ${formatNum(tInfo.mcap)}\n`;
      if (tInfo.liquidity) infoLines += `💧 Liq: ${formatNum(tInfo.liquidity)}\n`;
      if (tInfo.volume24h) infoLines += `📈 Vol 24h: ${formatNum(tInfo.volume24h)}\n`;
      if (tInfo.holders)   infoLines += `👥 Holders: ${tInfo.holders.toLocaleString()}\n`;
      infoLines += `🛡 Safety: ✅ Checking...\n\nSelect amount to buy:`;
      await ctx.reply(infoLines, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: `🟢 ${b1} SOL`, callback_data: `buy_ca_amt_${b1}` },
              { text: `🟢 ${b2} SOL`, callback_data: `buy_ca_amt_${b2}` },
              { text: `🟢 ${b3} SOL`, callback_data: `buy_ca_amt_${b3}` },
            ],
            [{ text: "✏️ Custom", callback_data: "buy_ca_custom" }],
            [{ text: "✖ Cancel",  callback_data: "trade_cancel" }],
          ],
        },
      });
      return;
    }

    // FIX #4 — buy_ca_custom_amt with CA expiry check
    if (pending === "buy_ca_custom_amt") {
      const amt = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(amt) || amt <= 0) { await ctx.reply("❌ Invalid amount."); return; }
      const ca = db.getSysConfig(`pending_ca_${userId}`);
      if (!ca) { await ctx.reply("❌ Please paste a token CA first."); return; }
      await mockBuy(ctx, user, ca, amt, "manual", "");
      return;
    }

    if (pending.startsWith("withdraw_address_")) {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (!isSolanaAddress(text)) {
        await ctx.reply("❌ *Invalid Solana address.*\n\nA Solana address is 32-44 characters.", { parse_mode: "Markdown" });
        return;
      }
      const parts    = pending.split("_");
      const token    = parts[2];
      const walletId = parseInt(parts[3]);
      const wallet   = db.getWallet(walletId);
      const balance  = await getBalance(wallet?.public_key || "");
      await ctx.reply(
        `✅ *Valid Solana Address*\n\n📤 From: *${stripMd(wallet?.label || "")}*\n📥 To: \`${text.slice(0,8)}...${text.slice(-4)}\`\n💰 Balance: ${balance.toFixed(4)} SOL\n\nSelect amount:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "25%",  callback_data: `withdraw_send_25_${token}_${walletId}` },
                { text: "50%",  callback_data: `withdraw_send_50_${token}_${walletId}` },
                { text: "75%",  callback_data: `withdraw_send_75_${token}_${walletId}` },
                { text: "100%", callback_data: `withdraw_send_100_${token}_${walletId}` },
              ],
              [{ text: "❌ Cancel", callback_data: "menu_wallets" }],
            ],
          },
        }
      );
      return;
    }
    
    if (pending === "cw_follow_address") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      if (!isSolanaAddress(text)) { await ctx.reply("❌ Invalid Solana address."); return; }
      db.setSysConfig(`cw_pending_addr_${userId}`, text);
      db.setSysConfig(`pending_${userId}`, "");
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }

    if (pending === "cw_name") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`cw_pending_name_${userId}`, text);
      db.setSysConfig(`pending_${userId}`, "");
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }

    if (pending === "cw_amount") {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(val) || val <= 0) { await ctx.reply("❌ Invalid amount."); return; }
      db.setSysConfig(`cw_pending_sol_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }

    if (pending === "cw_slippage") {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(val) || val <= 0) { await ctx.reply("❌ Invalid slippage."); return; }
      db.setSysConfig(`cw_pending_slippage_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }

    if (pending === "cw_gas") {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(val) || val < 0) { await ctx.reply("❌ Invalid gas fee."); return; }
      db.setSysConfig(`cw_pending_gas_${userId}`, String(val));
      return showCwSetupScreen(ctx, userId, ctx.chat.id);
    }
    if (pending === "copy_wallet_address") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      if (!isSolanaAddress(text)) { await ctx.reply("❌ Invalid Solana address."); return; }
      db.setSysConfig(`copy_pending_addr_${userId}`, text);
      db.setSysConfig(`pending_${userId}`, "copy_wallet_sol");
      const msg = await ctx.reply("💰 How much SOL per copy trade? (e.g. 0.1):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      return;
    }

    if (pending === "copy_wallet_sol") {
      const sol = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      if (isNaN(sol) || sol <= 0) { await ctx.reply("❌ Invalid amount."); return; }
      db.setSysConfig(`copy_pending_sol_${userId}`, String(sol));
      db.setSysConfig(`pending_${userId}`, "");
      await ctx.reply(
        `👛 Copy amount: *${sol} SOL* per trade\n\nMirror sells too?`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Yes, mirror sells", callback_data: "copy_wallet_mirror_yes" },
                { text: "❌ No",                callback_data: "copy_wallet_mirror_no"  },
              ],
            ],
          },
        }
      );
      return;
    }
      if (pending === "copy_channel_forward") {
        await deleteMsg(ctx, promptId);
        try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
        db.setSysConfig(`pending_${userId}`, "");
        const fwd = ctx.message.forward_origin || ctx.message.forward_from_chat;
        if (!fwd) { 
          await ctx.api.sendMessage(ctx.chat.id, "❌ Please forward a message from the channel."); 
          return; 
        }
        const channelId   = String(fwd.chat?.id || fwd.id || "");
        const channelName = stripMd(fwd.chat?.title || fwd.title || channelId);
        if (!channelId) { 
          await ctx.api.sendMessage(ctx.chat.id, "❌ Could not detect channel. Try @username instead."); 
          return; 
        }
        db.addCopyChannel(userId, channelId, channelName, {});
        const channels = db.getCopyChannels(userId);
        const newCh    = channels.find(c => c.channel_id === channelId) || channels[0];
        const sl = newCh?.stop_loss_pct || 0;
        const tp = newCh?.take_profit_pct || 0;
    if (newCh) {
      await ctx.api.sendMessage(ctx.chat.id, `✅ *${channelName}* added!`, { parse_mode: "Markdown" });
        await ctx.api.sendMessage(ctx.chat.id,
          `📡 *${channelName}*\n\n` +
          `Status: ⏸ Paused\n` +
          `Signals caught: *0*\n` +
          `Trades executed: *0*\n\n` +
          `💰 Buy: *${newCh.buy_amount || 0.1} SOL*\n` +
          `📊 Slippage: *${newCh.slippage || 50}%*\n` +
          `⛽ Gas: *${newCh.tip || 0.005} SOL*\n` +
          `🛑 SL: *${sl === 0 ? "OFF" : sl + "%"}*\n` +
          `🎯 TP: *${tp === 0 ? "OFF" : tp + "%"}*\n` +
          `🔄 Copy Sell: *OFF ❌*\n` +
          `🛡 MEV: *OFF ❌*\n\n` +
          `_Tap any button to change:_`,
          { reply_markup: buildCopyChannelSettingsMenu(newCh) }
        );
      } else {
        await ctx.api.sendMessage(ctx.chat.id, "❌ Could not add channel. Try again.");
      }
      return;
    }

    if (pending === "copy_channel_numeric_id") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const channelId = text.trim();
      if (!channelId.startsWith("-100")) { await ctx.reply("❌ Invalid channel ID. Must start with -100."); return; }
      db.addCopyChannel(userId, channelId, channelId, {});
      const channels = db.getCopyChannels(userId);
      const newCh    = channels.find(c => c.channel_id === channelId) || channels[0];
      const sl = newCh?.stop_loss_pct || 0;
      const tp = newCh?.take_profit_pct || 0;
      if (newCh) {
        await ctx.reply(`✅ Channel *${channelId}* added!`, { parse_mode: "Markdown" });
        await ctx.reply(
          `📡 *${channelId}*\n\n` +
          `Status: ⏸ Paused\n` +
          `Signals caught: *0*\n` +
          `Trades executed: *0*\n\n` +
          `💰 Buy: *${newCh.buy_amount || 0.1} SOL*\n` +
          `📊 Slippage: *${newCh.slippage || 50}%*\n` +
          `⛽ Gas: *${newCh.tip || 0.005} SOL*\n` +
          `🛑 SL: *${sl === 0 ? "OFF" : sl + "%"}*\n` +
          `🎯 TP: *${tp === 0 ? "OFF" : tp + "%"}*\n` +
          `🔄 Copy Sell: *OFF ❌*\n` +
          `🛡 MEV: *OFF ❌*\n\n` +
          `_Tap any button to change:_`,
          { reply_markup: buildCopyChannelSettingsMenu(newCh) }
        );
      }
      return;
    }
    if (pending === "copy_channel_forward") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const fwd = ctx.message.forward_origin || ctx.message.forward_from_chat;
      if (!fwd) { await ctx.reply("❌ Please forward a message from the channel."); return; }
      const channelId   = String(fwd.chat?.id || fwd.id || "");
      const channelName = stripMd(fwd.chat?.title || fwd.title || channelId);
      if (!channelId) { await ctx.reply("❌ Could not detect channel. Try @username instead."); return; }
      db.addCopyChannel(userId, channelId, channelName, {});
      const channels = db.getCopyChannels(userId);
      const newCh    = channels[0];
      await ctx.reply(`✅ *${channelName}* added!`, { parse_mode: "Markdown" });
      if (newCh) return safeEdit(ctx, `📡 *${channelName}*\n\nConfigure settings:`, buildCopyChannelSettingsMenu(newCh));
      return;
    }

    if (pending === "copy_channel_numeric_id") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const channelId = text.trim();
      if (!channelId.startsWith("-100")) { await ctx.reply("❌ Invalid channel ID. Must start with -100."); return; }
      db.addCopyChannel(userId, channelId, channelId, {});
      const channels = db.getCopyChannels(userId);
      const newCh    = channels[0];
      await ctx.reply(`✅ Channel *${channelId}* added!`, { parse_mode: "Markdown" });
      if (newCh) return safeEdit(ctx, `📡 *${channelId}*\n\nConfigure settings:`, buildCopyChannelSettingsMenu(newCh));
      return;
    }
    if (pending === "copy_channel_id") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const channelId    = text.startsWith("@") ? text : `@${text}`;
      const safeChId     = stripMd(channelId);
      db.addCopyChannel(userId, channelId, channelId, {});
      const channels = db.getCopyChannels(userId);
      const newCh    = channels.find(c => c.channel_id === channelId) || channels[0];
      const sl = newCh?.stop_loss_pct || 0;
      const tp = newCh?.take_profit_pct || 0;
      await ctx.api.sendMessage(ctx.chat.id, `✅ Channel *${safeChId}* added!`, { parse_mode: "Markdown" });
      if (newCh) {
        await ctx.api.sendMessage(ctx.chat.id,
          `📡 *${safeChId}*\n\n` +
          `Status: ⏸ Paused\n` +
          `Signals caught: *0*\n` +
          `Trades executed: *0*\n\n` +
          `💰 Buy: *${newCh.buy_amount || 0.1} SOL*\n` +
          `📊 Slippage: *${newCh.slippage || 50}%*\n` +
          `⛽ Gas: *${newCh.tip || 0.005} SOL*\n` +
          `🛑 SL: *${sl === 0 ? "OFF" : sl + "%"}*\n` +
          `🎯 TP: *${tp === 0 ? "OFF" : tp + "%"}*\n` +
          `🔄 Copy Sell: *OFF ❌*\n` +
          `🛡 MEV: *OFF ❌*\n\n` +
          `_Tap any button to change:_`,
          { reply_markup: buildCopyChannelSettingsMenu(newCh) }
        );
      }
      return;
    }

    if (pending.startsWith("cch_set_")) {
      const parts    = pending.split("_");
      const field    = parts[2];
      const id       = parseInt(parts[3]);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const val      = parseFloat(text);
      const fieldMap = { buy: "buy_amount", slip: "slippage", tip: "tip", sl: "stop_loss_pct", tp: "take_profit_pct", maxbuys: "max_buys_per_signal" };
      if (fieldMap[field] && !isNaN(val)) db.updateCopyChannel(userId, id, { [fieldMap[field]]: val });
      const ch  = db.getCopyChannel(id, userId);
      if (!ch) return;
      const sl2 = ch.stop_loss_pct   || 0;
      const tp2 = ch.take_profit_pct || 0;
      const name = stripMd(ch.channel_name || ch.channel_id);
      await ctx.api.sendMessage(ctx.chat.id,
        `📡 *${name}*\n\n` +
        `Status: ${ch.status === "active" ? "🟢 Active" : "⏸ Paused"}\n` +
        `Signals caught: *${ch.signals_caught || 0}*\n` +
        `Trades executed: *${ch.trades_executed || 0}*\n\n` +
        `💰 Buy: *${ch.buy_amount || 0.1} SOL*\n` +
        `📊 Slippage: *${ch.slippage || 50}%*\n` +
        `⛽ Gas: *${ch.tip || 0.005} SOL*\n` +
        `🛑 SL: *${sl2 === 0 ? "OFF" : sl2 + "%"}*\n` +
        `🎯 TP: *${tp2 === 0 ? "OFF" : tp2 + "%"}*\n` +
        `🤖 Auto Sell: *Coming Soon*\n` +
        `🛡 MEV: *${ch.mev_protection ? "ON ✅" : "OFF ❌"}*\n\n` +
        `_Tap any button to change:_`,
        { parse_mode: "Markdown", reply_markup: buildCopyChannelSettingsMenu(ch) }
      );
      return;
    }

    if (pending.startsWith("scfg_set_")) {
      const parts    = pending.split("_");
      const field    = parts[2];
      const id       = parseInt(parts[3]);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const val      = parseFloat(text);
      const fieldMap = { amt: "snipe_amount", slip: "snipe_slippage", fee: "snipe_fee", tip: "snipe_tip", max: "max_snipes" };
      if (fieldMap[field] && !isNaN(val)) db.updateSniperConfig(userId, id, { [fieldMap[field]]: val });
      const cfg = db.getSniperConfig(id, userId);
      if (cfg) return safeEdit(ctx, `🎯 *${cfg.label}*`, buildSniperConfigMenu(cfg));
      return;
    }

    if (pending === "snipe_ca") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`snipe_pending_ca_${userId}`, text);
      db.setSysConfig(`pending_${userId}`, "snipe_sol");
      const msg = await ctx.reply("⛽ How much SOL to snipe with? (e.g. 0.5):");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      return;
    }

    if (pending === "snipe_sol") {
      const sol = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(sol) || sol <= 0) { await ctx.reply("❌ Invalid amount."); return; }
      const ca = db.getSysConfig(`snipe_pending_ca_${userId}`);
      db.addSnipe(userId, ca, sol, 50, null);
      await ctx.reply(
        `✅ *Snipe Set!*\n\nCA: \`${ca.slice(0,12)}...\`\nAmount: *${sol} SOL*\n\n_Bot will buy when this token migrates or launches._`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (pending === "sniper_rt_amount" || pending === "sniper_rt_slippage" || pending === "sniper_rt_fee") {
      const val = parseFloat(text);
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (isNaN(val) || val <= 0) { await ctx.reply("❌ Invalid value."); return; }
      const patch = pending === "sniper_rt_amount"
        ? { sniper_rt_amount: val }
        : pending === "sniper_rt_slippage"
          ? { sniper_rt_slippage: val }
          : { sniper_rt_fee: val };
      db.updateRealtimeSniperConfig(userId, patch);
      db.setSysConfig(`sniper_screen_${userId}`, "realtime");
      return safeEdit(ctx, `⚡ *Real-Time Snipe*\n\n${getGuide("sniper")}\n\nSnipe Raydium launches or migrating tokens live without pasting a CA.`, buildRealtimeSnipeMenu(db.getRealtimeSniperConfig(userId)));
    }

    if (pending === "watchlist_add_ca") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      db.addToWatchlist(userId, text, "Unknown", 0);
      await ctx.reply(`✅ Added to watchlist: \`${text.slice(0,12)}...\``, { parse_mode: "Markdown" });
      return;
    }

    if (pending.startsWith("set_limit_sell_")) {
      const posId = pending.replace("set_limit_sell_", "");
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) { await ctx.reply("❌ Invalid price."); return; }
      const pos = db.getPosition(parseInt(posId), userId);
      if (pos) db.addLimitOrder(userId, { tokenCa: pos.token_ca, tokenName: pos.token_name, orderType: "sell", targetPrice: price, sellPct: 100 });
      await ctx.reply(`✅ Limit sell set at *${price} SOL*`, { parse_mode: "Markdown" });
      return;
    }

    // Admin text inputs
    if (pending.startsWith("admin_")) {
      if (!isAdmin(userId)) { await ctx.reply("❌ Admin only."); return; }
      return handleAdminTextInput(ctx, pending);
    }

    if (pending === "referral_payout_address") {
      await deleteMsg(ctx, promptId);
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id); } catch {}
      db.setSysConfig(`pending_${userId}`, "");
      if (!isSolanaAddress(text)) { await ctx.reply("❌ Invalid Solana address."); return; }
      db.setSysConfig(`payout_wallet_${userId}`, text);
      await ctx.reply(`✅ Payout wallet set:\n\`${text}\``, { parse_mode: "Markdown" });
      return;
    }

    // Auto-detect CA
    if (!pending && text.length >= 32 && text.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(text)) {
      if (ks) { await ctx.reply("🔴 Trading paused."); return; }
      const settings = db.getSettings(userId) || {};
      const b1 = settings.buy_amt_1 || 0.1;
      const b2 = settings.buy_amt_2 || 0.5;
      const b3 = settings.buy_amt_3 || 1.0;
      db.setSysConfig(`pending_ca_${userId}`, text);
      db.setSysConfig(`pending_ca_time_${userId}`, String(Date.now()));
      const tInfo   = await getTokenInfo(text);
      const dexUrl  = `https://dexscreener.com/solana/${text}`;
      const tName   = tInfo.name ? `<a href="${dexUrl}"><b>${tInfo.name}</b></a>` : `<a href="${dexUrl}"><b>${text.slice(0,8)}...</b></a>`;
      let infoLines = `🔍 ${tName}\n\n<code>${text}</code>\n\n`;
      if (tInfo.price)     infoLines += `💲 Price: ${formatPrice(tInfo.price)}\n`;
      if (tInfo.mcap)      infoLines += `📊 MCap: ${formatNum(tInfo.mcap)}\n`;
      if (tInfo.liquidity) infoLines += `💧 Liq: ${formatNum(tInfo.liquidity)}\n`;
      if (tInfo.volume24h) infoLines += `📈 Vol 24h: ${formatNum(tInfo.volume24h)}\n`;
      if (tInfo.holders)   infoLines += `👥 Holders: ${tInfo.holders.toLocaleString()}\n`;
      infoLines += `🛡 Safety: ✅ Checking...\n\nSelect amount to buy:`;
      await ctx.reply(infoLines, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: `🟢 ${b1} SOL`, callback_data: `buy_ca_amt_${b1}` },
              { text: `🟢 ${b2} SOL`, callback_data: `buy_ca_amt_${b2}` },
              { text: `🟢 ${b3} SOL`, callback_data: `buy_ca_amt_${b3}` },
            ],
            [{ text: "✏️ Custom", callback_data: "buy_ca_custom" }],
            [{ text: "✖ Cancel",  callback_data: "trade_cancel" }],
          ],
        },
      });
      return;
    }

    if (!pending) {
      const rt = db.getRealtimeSniperConfig(userId);
      if ((rt?.sniper_rt_enabled || 0) === 1) {
        const buyDefaults = {
          solAmount: rt.sniper_rt_amount || 0.1,
          slippage: rt.sniper_rt_slippage || 50,
          fee: rt.sniper_rt_fee || 0.003,
        };
        const tokenName = `RT-${text.slice(0, 6)}`;
        db.setSysConfig(`sniper_screen_${userId}`, "realtime");
        await executeRealtimeSnipe(ctx, db.getUser(userId), text, { tokenName, sourceRef: "realtime", entryMcap: 0 });
        return safeEdit(ctx,
          `⚡ *Real-Time Snipe*\n\n${getGuide("sniper")}\n\n` +
          `Live sniper is armed.\n` +
          `Amount: *${buyDefaults.solAmount} SOL*\n` +
          `Slippage: *${buyDefaults.slippage}%*\n` +
          `Fee: *${buyDefaults.fee} SOL*`,
          buildRealtimeSnipeMenu(rt)
        );
      }
    }
  });
}

async function deleteMsg(ctx, msgId) {
  if (!msgId) return;
  try { await ctx.api.deleteMessage(ctx.chat.id, msgId); } catch {}
}

module.exports = { setupRouter };
