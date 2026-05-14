// M04 — Router V12 — All callbacks wired
const { handleStart } = require("../onboarding");
const {
  showSettings,
  handleSettingCallback,
  handleTextInput,
  doExportKey,
} = require("../settings/index");
const { getPortfolio, getTokenPosition } = require("../portfolio");
const {
  mockBuy,
  mockSell,
  handleAutoBuy,
  executeRealtimeSnipe,
} = require("../executor");
const {
  addWallet,
  deleteWallet,
  decryptWallet,
  isSolanaAddress,
} = require("../walletVault");
const {
  getActiveWallet,
  setActiveWallet,
  getBalance,
} = require("../walletSwitcher");
const { handleFaucet } = require("../faucet");
const {
  buildReferralMessage,
  addPromoter,
  removePromoter,
} = require("../referrals");
const {
  showAdminPanel,
  handleAdminCallback,
  handleAdminTextInput,
  isAdmin,
} = require("../admin");
const {
  buildMainMenu,
  buildSettingsMenu,
  buildWalletMenu,
  buildWalletDeleteSelect,
  buildWalletExportSelect,
  buildCopyTradeMenu,
  buildCopyWalletListMenu,
  buildCopyChannelListMenu,
  buildCopyChannelSettingsMenu,
  buildSniperMainMenu,
  buildAutoSniperMenu,
  buildSniperConfigMenu,
  buildMigrationSniperMenu,
  buildRealtimeSnipeMenu,
  buildLimitOrdersMenu,
  buildLimitOrderSetupMenu,
  buildWatchlistMenu,
  getModeLabel,
  getGuide,
} = require("../keyboards");
const db = require("../../../database");
const { InputFile } = require("grammy");
const config = require("../../../config");
const bcrypt = require("bcryptjs");
const { getTokenInfo, formatNum, formatPrice } = require("../tokenInfo");

async function handlePnlCard(ctx, user, posId, hideAmounts) {
  const pos = db.getPosition(posId, user.user_id);
  if (!pos) {
    await ctx.reply("❌ Position not found.");
    return;
  }
  const { simulatePriceMovement } = require("../executor");
  const currentPrice = simulatePriceMovement(pos.token_ca);
  const pnlPct =
    pos.buy_price > 0
      ? ((currentPrice - pos.buy_price) / pos.buy_price) * 100
      : 0;
  const pnlSol = pos.sol_invested * (pnlPct / 100);
  let exitMcap = 0;
  try {
    const axios = require("axios");
    const dexRes = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${pos.token_ca}`,
      { timeout: 4000 },
    );
    const pairs = dexRes.data?.pairs;
    if (pairs && pairs.length > 0)
      exitMcap = pairs[0].fdv || pairs[0].marketCap || 0;
  } catch {}
  const loadMsg = await ctx.reply("⏳ Generating your PnL card...");
  const cardKb = {
    inline_keyboard: [
      [{ text: "← Back to Portfolio", callback_data: "menu_portfolio" }],
    ],
  };
  try {
    const { generatePnlCard } = require("../cardGenerator");
    const result = await generatePnlCard({
      username: user.username || "Trader",
      rankNum: user.rank || 1,
      tokenName: pos.token_name || pos.token_ca.slice(0, 8),
      pnlPct,
      pnlSol,
      entryMcap: pos.entry_mcap || 0,
      exitMcap,
      hideAmounts,
    });
    try {
      await ctx.api.deleteMessage(ctx.chat.id, loadMsg.message_id);
    } catch {}
    const entryMcap = pos.entry_mcap || 0;
    if (result && result.type === "photo") {
      try {
        const caption =
          `🦅 *HAWKX PNL CARD*\n` +
          `👤 @${user.username||"Trader"} · ${pos.token_name||pos.token_ca.slice(0,8)}\n` +
          `${pnlPct >= 0 ? "📈" : "📉"} *${pnlPct >= 0 ? "+" : ""}${Math.abs(pnlPct).toFixed(1)}%*\n` +
          `💰 ${pnlPct >= 0 ? "+" : ""}${Math.abs(pnlSol).toFixed(4)} SOL\n` +
          `📊 Entry: *${entryMcap > 0 ? "$"+(entryMcap/1000).toFixed(1)+"K" : "N/A"}* → Exit: *${exitMcap > 0 ? "$"+(exitMcap/1000).toFixed(1)+"K" : "N/A"}*`;
        await ctx.api.sendPhoto(
          ctx.chat.id,
          new InputFile(Buffer.from(result.buffer), "pnl_card.png"),
        );
        await ctx.api.sendMessage(ctx.chat.id, caption, { parse_mode: "Markdown", reply_markup: cardKb });
        return;
      } catch (e) {
        await ctx.reply("❌ Could not send card image.", {
          reply_markup: cardKb,
        });
      }
    } else if (result && result.type === "text") {
      await ctx.reply(result.text, {
        parse_mode: "Markdown",
        reply_markup: cardKb,
      });
    } else {
      await ctx.reply("❌ Card not available.", { reply_markup: cardKb });
    }
  } catch (e) {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, loadMsg.message_id);
    } catch {}
    await ctx.reply("❌ Could not generate card. " + e.message, {
      reply_markup: cardKb,
    });
  }
}

async function safeEdit(ctx, text, keyboard) {
  const mdOpts = { parse_mode: "Markdown", reply_markup: keyboard };
  const plainOpts = { reply_markup: keyboard };
  try {
    await ctx.editMessageText(text, mdOpts);
  } catch (e) {
    if (
      e?.description?.includes("parse entities") ||
      e?.description?.includes("can't parse")
    ) {
      try {
        await ctx.editMessageText(text, plainOpts);
      } catch {
        await ctx.reply(text, plainOpts);
      }
    } else {
      try {
        await ctx.reply(text, mdOpts);
      } catch (e2) {
        if (
          e2?.description?.includes("parse entities") ||
          e2?.description?.includes("can't parse")
        ) {
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
    if (
      e?.description?.includes("parse entities") ||
      e?.description?.includes("can't parse")
    ) {
      const { parse_mode, ...rest } = extra;
      await ctx.reply(text, rest);
    } else {
      throw e;
    }
  }
}

function stripMd(str) {
  return String(str || "").replace(/[_*`[\]()~>#+=|{}.!\-]/g, "");
}

async function deleteUserMsg(ctx) {
  try {
    await ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id);
  } catch {}
}

async function showCwSetupScreen(ctx, userId, chatId = null) {
  const addr = db.getSysConfig(`cw_pending_addr_${userId}`) || "";
  const name = db.getSysConfig(`cw_pending_name_${userId}`) || "";
  const freshUser = db.getUser(userId);
  const walletId =
    parseInt(db.getSysConfig(`cw_pending_wallet_${userId}`)) ||
    freshUser.active_wallet_id;
  const sol = db.getSysConfig(`cw_pending_sol_${userId}`) || "0.1";
  const copySell = db.getSysConfig(`cw_pending_copysell_${userId}`) !== "0";
  const slippage = db.getSysConfig(`cw_pending_slippage_${userId}`) || "50";
  const gas = db.getSysConfig(`cw_pending_gas_${userId}`) || "0.005";
  const wallets = db.getWallets(userId) || [];
  const selWal = wallets.find((w) => w.wallet_id === walletId);
  const walletIdx = selWal ? wallets.indexOf(selWal) + 1 : 1;
  const expanded = db.getSysConfig(`cw_wallet_expanded_${userId}`) === "1";

  const walletBtns = [];
  for (let i = 0; i < wallets.length; i += 3) {
    walletBtns.push(
      wallets.slice(i, i + 3).map((w, idx) => {
        const num = i + idx + 1;
        const isSel = w.wallet_id === walletId;
        return {
          text: isSel ? `W${num} ✅` : `W${num}`,
          callback_data: `cw_setwallet_${w.wallet_id}`,
        };
      }),
    );
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

  const mev = db.getSysConfig(`cw_pending_mev_${userId}`) !== "0";
  const autoSell = db.getSysConfig(`cw_pending_autosell_${userId}`) === "1";

  const keyboard = {
    inline_keyboard: [
      [{ text: "🎯 Paste Follow Address", callback_data: "cw_paste_address" },
       { text: "📝 Set Name", callback_data: "cw_set_name" }],
      ...(expanded
        ? [...walletBtns, [{ text: "▲ Hide Wallets", callback_data: "cw_hide_wallets" }]]
        : [[{ text: `💼 W${walletIdx} ✅ ▼ tap to change`, callback_data: "cw_show_wallets" }]]
      ),
      [{ text: `💰 ${sol}SOL`, callback_data: "cw_set_amount" },
       { text: `📊 ${slippage}%`, callback_data: "cw_set_slippage" },
       { text: `⛽ ${gas}SOL`, callback_data: "cw_set_gas" }],
      [{ text: mev ? "🛡 MEV: ON ✅" : "🛡 MEV: OFF ❌", callback_data: "cw_toggle_mev" }],
      [{ text: `🔄 Copy Sell: ${copySell ? "ON ✅" : "OFF ❌"}`, callback_data: "cw_toggle_copysell" },
       { text: `🤖 Auto Sell: ${autoSell ? "ON ✅" : "OFF ❌"}`, callback_data: "cw_setup_autosell" }],
      [{ text: "✅ Add Copy Wallet", callback_data: "cw_confirm_add" }],
      [{ text: "← Back", callback_data: "copy_wallet_menu" }],
    ],
  };

  // If chatId provided (from text handler) — send new message and save its ID
  if (chatId) {
    try {
      const setupMsgId = db.getSysConfig(`cw_setup_msg_${userId}`);
      if (setupMsgId) {
        try {
          await ctx.api.editMessageText(chatId, parseInt(setupMsgId), msg, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
          return;
        } catch {}
      }
      const sent = await ctx.api.sendMessage(chatId, msg, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
      db.setSysConfig(`cw_setup_msg_${userId}`, String(sent.message_id));
    } catch (e) {
      await ctx.api.sendMessage(chatId, msg, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });
    }
    return;
  }

  // Normal callback — use safeEdit
  const opts = { parse_mode: "Markdown", reply_markup: keyboard };
  try {
    await ctx.editMessageText(msg, opts);
  } catch {
    const sent = await ctx.reply(msg, opts);
    db.setSysConfig(`cw_setup_msg_${userId}`, String(sent.message_id));
  }
}

// ── Referral screen builder ───────────────────────────────────
async function buildReferralScreen(ctx, userId, showWallets) {
  const freshUser = db.getUser(userId);
  const pending2 = db.getPendingEarnings(userId);
  const total = db.getTotalEarnings(userId);
  const paid = db.getPaidEarnings(userId);
  const dirCount = db.getDirectReferralCount(userId);
  const isPromoter = freshUser.promoter_status === 1;
  const botName = "hawkx_devnet_fazle_bot";
  const refLink = `https://t.me/${botName}?start=REF_${userId}_${freshUser.username || "user"}`;
  const wallets = db.getWallets(userId) || [];

  let payoutAddress = db.getSysConfig(`payout_wallet_${userId}`);
  if (!payoutAddress && wallets.length > 0) {
    payoutAddress = wallets[0].public_key;
    db.setSysConfig(`payout_wallet_${userId}`, payoutAddress);
  }

  const payoutWallet = wallets.find((w) => w.public_key === payoutAddress);
  const payoutIdx = payoutWallet ? wallets.indexOf(payoutWallet) + 1 : null;
  const payoutLabel = payoutIdx ? `W${payoutIdx}` : "Custom";

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
      walletRows.push(
        wallets.slice(i, i + 3).map((w, idx) => {
          const num = i + idx + 1;
          const isActive = w.public_key === payoutAddress;
          return {
            text: isActive ? `W${num} ✅` : `W${num}`,
            callback_data: `payout_wallet_select_${w.wallet_id}`,
          };
        }),
      );
    }
    keyboard = {
      inline_keyboard: [
        ...walletRows,
        [{ text: "✏️ Custom Address", callback_data: "payout_wallet_custom" }],
        [
          { text: "← Back", callback_data: "menu_main" },
          { text: "🔄 Refresh", callback_data: "referral_set_payout" },
        ],
      ],
    };
  } else {
    keyboard = {
      inline_keyboard: [
        [
          {
            text: "💳 Set Payout Wallet",
            callback_data: "referral_set_payout",
          },
        ],
        [
          { text: "← Back", callback_data: "menu_main" },
          { text: "🔄 Refresh", callback_data: "menu_referrals" },
        ],
      ],
    };
  }

  try {
    await ctx.editMessageText(msg, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch {
    try {
      await ctx.deleteMessage();
    } catch {}
    await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: keyboard });
  }
}

async function refreshMsnipeScreen(ctx, userId) {
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
        [{ text: `💰 ${sol}SOL`, callback_data: "msnipe_set_sol" },
         { text: `📉 ${slippage}%`, callback_data: "msnipe_set_slip" },
         { text: `⛽ ${gas}SOL`, callback_data: "msnipe_set_gas" }],
        [{ text: mev ? "🛡 MEV: ON ✅" : "🛡 MEV: OFF ❌", callback_data: "msnipe_toggle_mev" }],
        [{ text: `🤖 Auto Sell: ${asOn ? `ON ✅ — ${tpl?.name||"No template"}` : "OFF ❌"}`, callback_data: "msnipe_open_as" }],
        [{ text: "✅ Start Sniping", callback_data: "msnipe_confirm" }],
        [{ text: "← Back", callback_data: "sniper_migration_menu" }],
      ]};
      const savedMsgId = parseInt(db.getSysConfig(`msnipe_msg_${userId}`) || "0");
      try {
        if (savedMsgId) {
          await ctx.api.editMessageText(ctx.chat.id, savedMsgId, msg, { parse_mode: "Markdown", reply_markup: keyboard });
        } else {
          await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: keyboard });
          const msgId = ctx.callbackQuery?.message?.message_id;
          if (msgId) db.setSysConfig(`msnipe_msg_${userId}`, String(msgId));
        }
      } catch {
        const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: keyboard });
        db.setSysConfig(`msnipe_msg_${userId}`, String(s.message_id));
      }
    }

async function buildLaunchMsg(userId, expanded) {
  const { getLaunchPending, buildLaunchScreen } = require("../launch");
  const p = getLaunchPending(userId);
  const wallets = db.getWallets(userId) || [];
  const selWal = wallets.find(w => String(w.wallet_id) === String(p.wallet_id)) || wallets[0];
  const walletNum = selWal ? wallets.indexOf(selWal)+1 : 1;
  const balance = selWal ? (selWal.balance || 0) : 0;
  const platformName = p.platform === "pump" ? "🌊 Pump.fun" : "🦅 HawkX";
  const msg =
    `🚀 *Launch Token — ${platformName}*\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📚 *HOW IT WORKS:*\n` +
    `💰 Initial buy → bonding curve (you own tokens)\n` +
    `🔒 Supply fixed 1B by Pump.fun\n` +
    `📈 Graduates to Raydium at ~$69K mcap\n` +
    `🌊 Creation fee: ~0.02 SOL\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `📝 Name: *${p.name||"Not set"}*\n` +
    `🔤 Symbol: *${p.symbol||"Not set"}*\n` +
    `📄 Desc: ${p.description ? "✅" : "Not set"} | 🖼 Image: ${p.image ? "✅" : "Not set"}\n` +
    `🐦 ${p.twitter||"Not set"} | 💬 ${p.telegram||"Not set"}\n` +
    `🌍 ${p.website||"Not set"}\n\n` +
    `💼 W${walletNum} — ${balance.toFixed(3)} SOL`;
  const kb = buildLaunchScreen(p, wallets, balance, walletNum, expanded || false);
  return { msg, kb };
}

async function buildTokenOrdersScreen(ctx, userId, ca, walletExpanded, forceMsgId) {
  const { getMockPrice } = require("../executor");
  const tokenOrders = db.getLimitOrders(userId, ca);
  const pos2 = db.getAllOpenPositions().find(p => p.user_id === userId && p.token_ca === ca);
  const name = pos2?.token_name || tokenOrders[0]?.token_name || ca.slice(0,8);
  db.setSysConfig(`lo_pending_ca_${userId}`, ca);
  db.setSysConfig(`lo_pending_name_${userId}`, name);
  const user2 = db.getUser(userId);
  const wallets2 = db.getWallets(userId) || [];
  const loWalletId = parseInt(db.getSysConfig(`lo_token_wallet_${userId}_${ca}`) || user2.active_wallet_id);
  const selWal2 = wallets2.find(w => w.wallet_id === loWalletId) || wallets2[0];
  const walletNum2 = wallets2.indexOf(selWal2) + 1;
  let priceInfo = "";
  try { const mp = getMockPrice(ca); priceInfo = `💰 *${mp.toFixed(8)}* [DEVNET]`; } catch {}
  const msg = `📋 *${name} — Limit Orders*\n\n━━━ 📚 GUIDE ━━━\n🟢 Buy triggers at or below target\n🔴 Sell triggers at or above target
Tap order → Pause or Delete\n━━━━━━━━━━━━━━━━━━━\n\n🪙 *${name}*\n${priceInfo}\n\n${tokenOrders.length ? `*Orders: ${tokenOrders.length}*` : "*No orders yet*"}`;
  const kb = { inline_keyboard: [] };
  tokenOrders.forEach(o => {
    const status = o.paused ? "⏸" : "🟢";
    const mcapLabel = o.target_mcap > 0
      ? `MC:${o.target_mcap >= 1000000 ? (o.target_mcap/1000000).toFixed(1)+"M" : (o.target_mcap/1000).toFixed(0)+"K"}`
      : `${parseFloat(o.target_price||0).toFixed(4)}`;
    const det = o.order_type === "buy"
      ? `${status} Buy ${o.sol_amount||0.1}◎ @${mcapLabel}`
      : `${status} Sell ${o.sell_pct||100}% @${mcapLabel}`;
    const isSelected = db.getSysConfig(`lo_selected_${userId}`) === String(o.id);
    kb.inline_keyboard.push([
      { text: det, callback_data: `lo_select_${o.id}` },
    ]);
    if (isSelected) {
      kb.inline_keyboard.push([
        { text: o.paused ? "▶ Resume" : "⏸ Pause", callback_data: `lo_pause_${o.id}` },
        { text: "🗑 Delete", callback_data: `lo_del_${o.id}` },
      ]);
    }
  });
  if (walletExpanded) {
    for (let i = 0; i < wallets2.length; i += 4) {
      kb.inline_keyboard.push(wallets2.slice(i, i+4).map((w, idx) => {
        const num = i+idx+1;
        const isSel = w.wallet_id === loWalletId;
        const caKey = ca.slice(0,8);
        db.setSysConfig(`lo_ca_map_${userId}_${caKey}`, ca);
        return { text: isSel ? `W${num} ✅` : `W${num}`, callback_data: `lo_tok_wallet_${caKey}_${w.wallet_id}` };
      }));
    }
    const caKeyClose = ca.slice(0,8);
    db.setSysConfig(`lo_ca_map_${userId}_${caKeyClose}`, ca);
    kb.inline_keyboard.push([{ text: "▲ Close", callback_data: `lo_token_ca_${caKeyClose}` }]);
  } else {
    const caKeyExp = ca.slice(0,8);
    db.setSysConfig(`lo_ca_map_${userId}_${caKeyExp}`, ca);
    kb.inline_keyboard.push([{ text: `💼 W${walletNum2} ▼`, callback_data: `lo_tok_wallet_expand_${caKeyExp}` }]);
  }
  kb.inline_keyboard.push([
    { text: "➕ Add Buy", callback_data: "lo_add_buy" },
    { text: "➕ Add Sell", callback_data: "lo_add_sell" },
  ]);
  kb.inline_keyboard.push([
    { text: "← Back", callback_data: "limit_orders_refresh" },
    { text: "🔄 Refresh", callback_data: `lo_token_ca_${ca.slice(0,8)}` },
  ]);
  const curMsgId = forceMsgId || ctx.callbackQuery?.message?.message_id;
  if (curMsgId) db.setSysConfig(`lo_msg_${userId}`, String(curMsgId));
  const loMsgId = parseInt(db.getSysConfig(`lo_msg_${userId}`) || "0");
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id || ctx.message?.chat?.id;
  try {
    if (loMsgId && chatId) await ctx.api.editMessageText(chatId, loMsgId, msg, { parse_mode: "Markdown", reply_markup: kb });
    else throw new Error("no msg");
  } catch(e) {
    if (e?.description?.includes("not modified")) return;
    const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
    db.setSysConfig(`lo_msg_${userId}`, String(s.message_id));
  }
}
async function showLimitOrdersScreen(ctx, userId) {
  const orders = db.getLimitOrders(userId);
  const wallets = db.getWallets(userId) || [];
  const user = db.getUser(userId);
  // Use lo_selected_wallet if set, otherwise use active wallet
  const selWalletId = parseInt(db.getSysConfig(`lo_sel_wallet_${userId}`) || user.active_wallet_id);
  const activeWallet = wallets.find(w => w.wallet_id === selWalletId) || wallets[0];
  const walletNum = wallets.indexOf(activeWallet) + 1;
  const balance = activeWallet ? (activeWallet.balance || 0) : 0;
  // Filter positions by SELECTED wallet
  const allPos = db.getAllOpenPositions().filter(p => p.user_id === userId && p.wallet_id === selWalletId);
  // Filter orders by selected wallet
  const walletOrders = orders.filter(o => o.wallet_id === selWalletId || (!o.wallet_id && selWalletId === parseInt(db.getUser(userId).active_wallet_id)));
  const msg = `📋 *Limit Orders*\n\n━━━━━━━━━━━━━━━━━━━\n🟢 Buy — triggers when price/MC drops to target\n🔴 Sell — triggers when price/MC rises to target\n💡 Switch wallet to see its tokens & orders
💼 Each wallet executes its own orders\n━━━━━━━━━━━━━━━━━━━\n\n*Tokens: ${Object.keys({...Object.fromEntries(allPos.map(p=>[p.token_ca,1])), ...Object.fromEntries(walletOrders.map(o=>[o.token_ca,1]))}).length}*`;
  const kb = { inline_keyboard: [] };
  const loWalletExpanded = db.getSysConfig(`lo_wallet_expanded_${userId}`) === "1";
  if (loWalletExpanded) {
    for (let i = 0; i < wallets.length; i += 4) {
      kb.inline_keyboard.push(wallets.slice(i, i+4).map((w, idx) => {
        const num = i+idx+1;
        const isSel = w.wallet_id === selWalletId;
        return { text: isSel ? `W${num} ✅` : `W${num}`, callback_data: `lo_switch_wallet_${w.wallet_id}` };
      }));
    }
    kb.inline_keyboard.push([{ text: "▲ Close", callback_data: "lo_wallet_collapse" }]);
  } else {
    kb.inline_keyboard.push([{ text: `💼 W${walletNum} ✅ — ${balance.toFixed(3)} SOL ▼`, callback_data: "lo_wallet_expand" }]);
  }
  const byToken = {};
  walletOrders.forEach(o => { if (!byToken[o.token_ca]) byToken[o.token_ca] = []; byToken[o.token_ca].push(o); });
  const tokenMap = {};
  allPos.forEach(p => { tokenMap[p.token_ca] = p; });
  walletOrders.forEach(o => { if (!tokenMap[o.token_ca]) tokenMap[o.token_ca] = { token_ca: o.token_ca, token_name: o.token_name }; });
  const tokenList = Object.values(tokenMap);
  for (let i = 0; i < tokenList.length; i += 3) {
    kb.inline_keyboard.push(tokenList.slice(i, i+3).map(p => {
      const tOrders = byToken[p.token_ca] || [];
      const allPaused = tOrders.length > 0 && tOrders.every(o => o.paused);
      const icon = tOrders.length === 0 ? "" : allPaused ? " ⏸" : " 🟢";
      const name = p.token_name || p.token_ca?.slice(0,8) || "Token";
      const caKey2 = p.token_ca.slice(0,8);
      db.setSysConfig(`lo_ca_map_${userId}_${caKey2}`, p.token_ca);
      return { text: `📊 ${name}${icon}`, callback_data: `lo_token_ca_${caKey2}` };
    }));
  }
  kb.inline_keyboard.push([
    { text: "➕ New Buy", callback_data: "lo_new_buy" }
  ]);
  kb.inline_keyboard.push([
    { text: "← Back", callback_data: "menu_main" },
    { text: "🔄 Refresh", callback_data: "limit_orders_refresh" }
  ]);
  const curMsgId = ctx.callbackQuery?.message?.message_id;
  if (curMsgId) db.setSysConfig(`lo_msg_${userId}`, String(curMsgId));
  const loMsgId = parseInt(db.getSysConfig(`lo_msg_${userId}`) || "0");
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id || ctx.message?.chat?.id;
  try {
    if (loMsgId && chatId) await ctx.api.editMessageText(chatId, loMsgId, msg, { parse_mode: "Markdown", reply_markup: kb });
    else throw new Error("no msg");
  } catch(e) {
    if (e?.description?.includes("not modified")) return;
    const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
    db.setSysConfig(`lo_msg_${userId}`, String(s.message_id));
  }
}
async function showLaunchScreen(ctx, userId) {
  const { buildLaunchPlatformScreen } = require("../launch");
  const launchGuideMsg2 = 
    `🚀 *Launch Token*\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📚 *HOW IT WORKS:*\n` +
    `🌊 *Pump.fun* — No liquidity needed\n` +
    `Pay ~0.02 SOL + optional initial buy\n` +
    `Token graduates to Raydium at ~$69K mcap\n\n` +
    `🦅 *HawkX* — Internal DEX launch\n` +
    `Full control over your token\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `Select platform:`;
  try { await ctx.editMessageText(launchGuideMsg2, { parse_mode: "Markdown", reply_markup: buildLaunchPlatformScreen() }); }
  catch { await ctx.reply(launchGuideMsg2, { parse_mode: "Markdown", reply_markup: buildLaunchPlatformScreen() }); }
}


module.exports = {
  handlePnlCard,
  safeEdit,
  safeReply,
  stripMd,
  deleteUserMsg,
  showCwSetupScreen,
  buildReferralScreen,
  refreshMsnipeScreen,
  buildLaunchMsg,
  buildTokenOrdersScreen,
  showLimitOrdersScreen,
  showLaunchScreen,
};
