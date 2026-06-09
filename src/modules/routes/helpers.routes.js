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
      tokenName: pos.token_name || pos.token_ca.slice(0,12),
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
          `👤 @${user.username||"Trader"} · ${pos.token_name||pos.token_ca.slice(0,12)}\n` +
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
  const walletId = parseInt(db.getSysConfig(`cw_pending_wallet_${userId}`)) || freshUser.active_wallet_id;
  const sol = db.getSysConfig(`cw_pending_sol_${userId}`) || "0.1";
  const slippage = db.getSysConfig(`cw_pending_slippage_${userId}`) || "50";
  const gas = db.getSysConfig(`cw_pending_gas_${userId}`) || "0.005";
  const mev = db.getSysConfig(`cw_pending_mev_${userId}`) !== "0";
  let copySell = db.getSysConfig(`cw_pending_copysell_${userId}`) !== "0";
  let autoSell = db.getSysConfig(`cw_pending_autosell_${userId}`) === "1";
  const notifyOnly = db.getSysConfig(`cw_pending_notify_${userId}`) === "1";
  if (autoSell && copySell) { copySell = false; db.setSysConfig(`cw_pending_copysell_${userId}`, "0"); }
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
          text: (() => { const l=(w.label&&!w.label.match(/^W\d+$/))?` ${w.label}`:""; return isSel?`W${num}${l} ✅`.slice(0,20):`W${num}${l}`.slice(0,20); })(),
          callback_data: `cw_setwallet_${w.wallet_id}`,
        };
      }),
    );
  }

  const msg =
    `👛 *Add Copy Wallet*\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `▸ Paste whale wallet address to follow\n` +
    `▸ Bot auto-buys when they buy\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🔄 *Copy Sell* — bot sells when whale sells\n` +
    `🤖 *Auto Sell* — uses your TP/SL template\n` +
    `⚠️ Only one can be ON at a time\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Max* — max SOL per copied trade\n` +
    `📊 *Min* — skip trades below X SOL\n` +
    `*% Copy* — copy X% of whale amount\n` +
    `⏱ *Delay* — wait X sec before copying\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 *Current Settings:*\n` +
    `🎮 Mode: ${notifyOnly ? "🔔 Notify Only" : "🤖 Auto Copy"}\n` +
    `🎯 Follow: ${addr ? `\`${addr}\`` : "❗ Not set"}\n` +
    `📝 Name: ${stripMd(name) || "Not set"}\n` +
    `💼 Wallet: W${walletIdx} ✅\n` +
    `💰 Amount: ${sol} SOL\n` +
    `🔄 Copy Sell: ${copySell ? "ON ✅" : "OFF ❌"}\n` +
    `📉 Slippage: ${slippage}%\n` +
    `⛽ Gas: ${gas} SOL\n` +
    `🛡 MEV: ${mev ? "ON ✅" : "OFF ❌"}\n` +
    `🤖 Auto Sell: ${autoSell ? "ON ✅" : "OFF ❌"}\n` +
    `📊 Max: ${db.getSysConfig(`cw_pending_max_${userId}`) || 1} SOL | Min: ${db.getSysConfig(`cw_pending_min_${userId}`) || 0} SOL\n` +
    `% Copy: ${db.getSysConfig(`cw_pending_pct_${userId}`) || 100}% | ⏱ Delay: ${db.getSysConfig(`cw_pending_delay_${userId}`) || 0}s\n` +
    `━━━━━━━━━━━━━━━━━━━`;

  // Mutual exclusion — if auto sell ON, copy sell must be OFF
  if (autoSell && copySell) { copySell = false; db.setSysConfig(`cw_pending_copysell_${userId}`, "0"); }

  const keyboard = {
    inline_keyboard: [
      [{ text: notifyOnly ? "🔔 Notify Only ✅" : "🔔 Notify Only", callback_data: "cw_setup_mode_notify" },
       { text: !notifyOnly ? "🤖 Auto Copy ✅" : "🤖 Auto Copy", callback_data: "cw_setup_mode_copy" }],
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
      [{ text: `🔄 Copy Sell: ${copySell ? "ON ✅" : "OFF ❌"}`, callback_data: "cw_setup_copysell_screen" },
       { text: `🤖 Auto Sell: ${autoSell ? "ON ✅" : "OFF ❌"}`, callback_data: "cw_setup_autosell" }],
      [{ text: `📊 Max: ${db.getSysConfig(`cw_pending_max_${userId}`) || 1} SOL`, callback_data: "cw_set_max" }, { text: `📊 Min: ${db.getSysConfig(`cw_pending_min_${userId}`) || 0} SOL`, callback_data: "cw_set_min" }],
      [{ text: `% Copy: ${db.getSysConfig(`cw_pending_pct_${userId}`) || 100}%`, callback_data: "cw_set_pct" }, { text: `⏱ Delay: ${db.getSysConfig(`cw_pending_delay_${userId}`) || 0}s`, callback_data: "cw_set_delay" }],
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
            text: (() => { const l=(w.label&&!w.label.match(/^W\d+$/))?` ${w.label}`:""; return isActive?`W${num}${l} ✅`.slice(0,20):`W${num}${l}`.slice(0,20); })(),
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
      const msnipeLabel = db.getSysConfig(`msnipe_label_${userId}`) || "New Migration Snipe";
      const slippage  = db.getSysConfig(`msnipe_slip_${userId}`) || "50";
      const gas       = db.getSysConfig(`msnipe_gas_${userId}`) || "0.005";
      const mev       = db.getSysConfig(`msnipe_mev_${userId}`) === "1";
      const tplId     = parseInt(db.getSysConfig(`msnipe_tpl_${userId}`) || "0");
      const tpl       = tplId ? templates.find(t => t.id === tplId) : null;
      const asOn      = db.getSysConfig(`msnipe_as_${userId}`) === "1";
      const minliq = db.getSysConfig(`msnipe_minliq_${userId}`) || "0";
      const maxmcap = db.getSysConfig(`msnipe_maxmcap_${userId}`) || "0";
      const mcapDisplay = parseFloat(maxmcap) >= 1000000 ? "$"+(parseFloat(maxmcap)/1000000).toFixed(1)+"M" : parseFloat(maxmcap) >= 1000 ? "$"+(parseFloat(maxmcap)/1000).toFixed(0)+"K" : parseFloat(maxmcap) > 0 ? "$"+maxmcap : "No limit";
      const msg =
        `🔀 *${msnipeLabel}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 *How it works:*\n` +
        `Catches PumpFun → Raydium migrations\n` +
        `at ~68K MCap automatically.\n` +
        `No CA needed — fully automatic.\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `💰 *Amount:* ${sol} SOL\n` +
        `📉 *Slippage:* ${slippage}%\n` +
        `⛽ *Gas:* ${gas} SOL\n` +
        `🛡 *MEV:* ${mev ? "ON ✅" : "OFF ❌"}\n` +
        `💧 *Min Liq:* ${parseFloat(minliq) > 0 ? minliq+" SOL" : "No filter"}\n` +
        `📊 *Max MCap:* ${mcapDisplay}\n` +
        `💼 *Wallet:* W${walletIdx}\n` +
        `🤖 *Auto Sell:* ${asOn ? `ON ✅ — ${tpl?.name||"No template"}` : "OFF ❌"}\n` +
        `━━━━━━━━━━━━━━━━━━━`;
      const keyboard = { inline_keyboard: [
        [{ text: `💰 ${sol}SOL`, callback_data: "msnipe_set_sol" },
         { text: `📉 ${slippage}%`, callback_data: "msnipe_set_slip" },
         { text: `⛽ ${gas}SOL`, callback_data: "msnipe_set_gas" }],
        [{ text: mev ? "🛡 MEV: ON ✅" : "🛡 MEV: OFF ❌", callback_data: "msnipe_toggle_mev" }],
        [{ text: `🤖 Auto Sell: ${asOn ? `ON ✅ — ${tpl?.name||"No template"}` : "OFF ❌"}`, callback_data: "msnipe_open_as" }],
        [{ text: `💧 Min Liq: ${db.getSysConfig("msnipe_minliq_" + userId) || 0} SOL`, callback_data: "msnipe_set_minliq" }, { text: `📊 Max MCap: ${db.getSysConfig("msnipe_maxmcap_" + userId) || 0}`, callback_data: "msnipe_set_maxmcap" }],
        [{ text: "✏️ Rename Setup", callback_data: "msnipe_rename" }, { text: "✅ Start Sniping", callback_data: "msnipe_confirm" }],
        [{ text: "← Back", callback_data: "sniper_migration_menu" }],
      ]};
      const savedMsgId = parseInt(db.getSysConfig(`msnipe_msg_${userId}`) || "0");
      console.log("[MSNIPE] savedMsgId:", savedMsgId, "chatId:", ctx.chat?.id || ctx.message?.chat?.id || userId);
      try {
        if (savedMsgId) {
          await ctx.api.editMessageText(ctx.chat?.id || ctx.message?.chat?.id || userId, savedMsgId, msg, { parse_mode: "Markdown", reply_markup: keyboard }).catch(e => console.log("[MSNIPE EDIT ERR]:", e.message));
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
  const balance = selWal ? parseFloat(db.getSysConfig(`mock_balance_${selWal.public_key}`) || "0") : 0;
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

function fmtExpiry(expiresAt) {
  if (!expiresAt) return "♾ Never";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "⏰ Expired";
  const d = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `⏰ ${d}d ${hrs}h`;
  if (hrs > 0) return `⏰ ${hrs}h ${mins}m`;
  return `⏰ ${mins}m`;
}

async function buildTokenOrdersScreen(ctx, userId, ca, walletExpanded, forceMsgId) {
  const { getMockPrice } = require("../executor");
  const tokenOrders = db.getLimitOrders(userId, ca);
  const pos2 = db.getAllOpenPositions().find(p => p.user_id === userId && p.token_ca === ca);
  const name = pos2?.token_name || tokenOrders[0]?.token_name || ca.slice(0,12);
  db.setSysConfig(`lo_pending_ca_${userId}`, ca);
  db.setSysConfig(`lo_pending_name_${userId}`, name);
  const user2 = db.getUser(userId);
  const wallets2 = db.getWallets(userId) || [];
  const loWalletId = parseInt(db.getSysConfig(`lo_sel_wallet_${userId}`) || user2.active_wallet_id);
  const selWal2 = wallets2.find(w => w.wallet_id === loWalletId) || wallets2[0];
  const walletNum2 = wallets2.indexOf(selWal2) + 1;
  let priceInfo = "";
  try { const mp = getMockPrice(ca); priceInfo = `💰 *${mp.toFixed(8)}* [DEVNET]`; } catch {}
  const loBal = selWal2 ? parseFloat(db.getSysConfig(`mock_balance_${selWal2.public_key}`) || "0") : 0;
  const walletLabel = selWal2 ? (selWal2.label && !selWal2.label.match(/^W\d+$/) ? selWal2.label : `W${walletNum2}`) : "—";
  const msg = `📋 *${name} — Limit Orders*\n\n━━━━━━━━━━━━━━━━━━━\n🟢 Buy executes at or below target price\n🔴 Sell executes at or above target price\n⏰ Orders expire in 48h (adjustable)\n\nTap any order to manage it.\n━━━━━━━━━━━━━━━━━━━\n\n🪙 *${name}*\n${priceInfo}\n💼 ${walletLabel}: *${loBal.toFixed(3)} SOL*\n\n${tokenOrders.length ? `*Orders: ${tokenOrders.length}*` : "*No orders yet*"}`;
  const kb = { inline_keyboard: [] };
  tokenOrders.forEach(o => {
    const status = o.paused ? "⏸" : "🟢";
    const mcapLabel = o.target_mcap > 0
      ? `MC:${o.target_mcap >= 1000000 ? (o.target_mcap/1000000).toFixed(1)+"M" : (o.target_mcap/1000).toFixed(0)+"K"}`
      : `${parseFloat(o.target_price||0).toFixed(4)}`;
    const exp = fmtExpiry(o.expires_at);
    const det = o.order_type === "buy"
      ? `${status} Buy ${o.sol_amount||0.1}◎ @${mcapLabel} · ${exp}`
      : `${status} Sell ${o.sell_pct||100}% @${mcapLabel} · ${exp}`;
    const isSelected = db.getSysConfig(`lo_selected_${userId}`) === String(o.id);
    kb.inline_keyboard.push([
      { text: det, callback_data: `lo_select_${o.id}` },
    ]);
    const expiryExpanded = db.getSysConfig(`lo_expiry_expand_${userId}`) === String(o.id);
    if (isSelected) {
      if (expiryExpanded) {
        // Inline expiry buttons under this order
        kb.inline_keyboard.push([
          { text: "12h", callback_data: `lo_setexp_${o.id}_12h` },
          { text: "24h", callback_data: `lo_setexp_${o.id}_24h` },
          { text: "7d", callback_data: `lo_setexp_${o.id}_7d` },
          { text: "30d", callback_data: `lo_setexp_${o.id}_30d` },
        ]);
        kb.inline_keyboard.push([
          { text: "♾ Never", callback_data: `lo_setexp_${o.id}_never` },
          { text: "✏️ Custom", callback_data: `lo_setexp_${o.id}_custom` },
        ]);
        kb.inline_keyboard.push([
          { text: "▲ Close Expiry", callback_data: `lo_expiry_close_${o.id}` },
        ]);
        kb.inline_keyboard.push([
          { text: o.paused ? "▶ Resume" : "⏸ Pause", callback_data: `lo_pause_${o.id}` },
          { text: "🗑 Delete", callback_data: `lo_del_${o.id}` },
        ]);
      } else {
        kb.inline_keyboard.push([
          { text: "⏰ Set Expiry", callback_data: `lo_expiry_${o.id}` },
          { text: o.paused ? "▶ Resume" : "⏸ Pause", callback_data: `lo_pause_${o.id}` },
          { text: "🗑 Delete", callback_data: `lo_del_${o.id}` },
        ]);
      }
    }
  });
  kb.inline_keyboard.push([
    { text: "➕ Add Buy", callback_data: "lo_add_buy" },
    { text: "➕ Add Sell", callback_data: "lo_add_sell" },
  ]);
  kb.inline_keyboard.push([
    { text: "← Back", callback_data: "limit_orders_refresh" },
    { text: "🔄 Refresh", callback_data: `lo_token_ca_${ca.slice(0,12)}` },
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
  const balance = activeWallet ? parseFloat(db.getSysConfig(`mock_balance_${activeWallet.public_key}`) || "0") : 0;
  // Filter positions by SELECTED wallet
  const allPos = db.getAllOpenPositions().filter(p => p.user_id === userId && p.wallet_id === selWalletId);
  // Filter orders by selected wallet
  const walletOrders = orders.filter(o => o.wallet_id === selWalletId || (!o.wallet_id && selWalletId === parseInt(db.getUser(userId).active_wallet_id)));
  const msg = `📋 *Limit Orders*\n\n━━━━━━━━━━━━━━━━━━━\nAutomate your entries and exits — set a\ntarget price and HawkX executes for you.\n\n🟢 Buy when price drops to your target\n🔴 Sell when price rises to your target\n\n💼 = in your wallet   🟢 = active order\n\nSelect a wallet, then choose a token.\n━━━━━━━━━━━━━━━━━━━\n\n*Tokens: ${Object.keys({...Object.fromEntries(allPos.map(p=>[p.token_ca,1])), ...Object.fromEntries(walletOrders.map(o=>[o.token_ca,1]))}).length}*`;
  const kb = { inline_keyboard: [] };
  const loWalletExpanded = db.getSysConfig(`lo_wallet_expanded_${userId}`) === "1";
  if (loWalletExpanded) {
    for (let i = 0; i < wallets.length; i += 4) {
      kb.inline_keyboard.push(wallets.slice(i, i+4).map((w, idx) => {
        const num = i+idx+1;
        const isSel = w.wallet_id === selWalletId;
        return { text: (() => { const l=(w.label&&!w.label.match(/^W\d+$/))?` ${w.label}`:""; return isSel?`W${num}${l} ✅`.slice(0,20):`W${num}${l}`.slice(0,20); })(), callback_data: `lo_switch_wallet_${w.wallet_id}` };
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
  const heldCas = new Set(allPos.map(p => p.token_ca));
  const tokenList = Object.values(tokenMap);
  for (let i = 0; i < tokenList.length; i += 3) {
    kb.inline_keyboard.push(tokenList.slice(i, i+3).map(p => {
      const tOrders = byToken[p.token_ca] || [];
      const held = heldCas.has(p.token_ca);
      const allPaused = tOrders.length > 0 && tOrders.every(o => o.paused);
      const orderIcon = tOrders.length === 0 ? "" : allPaused ? "⏸" : "🟢";
      const heldIcon = held ? "💼" : "";
      const icon = (heldIcon || orderIcon) ? ` ${heldIcon}${orderIcon}` : "";
      const name = p.token_name || p.token_ca?.slice(0,8) || "Token";
      const caKey2 = p.token_ca.slice(0,12);
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

// Launch metadata form — adapts per launchpad
// SOL price for graduation $ estimates. At mainnet, fetch live.
const SOL_PRICE_USD = 63;
// SOL price for graduation $ estimates. At mainnet, fetch live.
const LAUNCHPAD_INFO = {
  pump:      { name: "pump.fun", icon: "🌊", advanced: false, fee: "Free mint · 0.015 SOL grad", gradSol: 85, cta: "🚀 Launch on pump.fun", success: "is LIVE on pump.fun!", tagline: "Fastest meme launch on Solana", caps: [] },
  launchlab: { name: "Raydium LaunchLab", icon: "🔵", advanced: true, fee: "Free mint · 1% trade fee", gradSol: 85, cta: "🚀 Launch on LaunchLab", success: "is LIVE on Raydium LaunchLab!", tagline: "Full control over your launch", caps: ["supply","decimals","curve","grad","mintfreeze","burnlp","maxwallet","vesting","teamalloc","creatorfee"] },
  meteora:   { name: "Meteora DBC", icon: "🟣", advanced: true, fee: "Dynamic fee", gradSol: 0, cta: "🚀 Launch on Meteora", success: "is LIVE on Meteora!", tagline: "Dynamic bonding curve", caps: ["supply","decimals","curve","migthreshold","mintfreeze","burnlp","maxwallet","vesting","teamalloc","creatorfee"] },
  letsbonk:  { name: "letsBONK 🐶", icon: "🐶", advanced: false, fee: "Free mint · BONK launchpad", gradSol: 85, cta: "🚀 Launch on letsBONK", success: "is LIVE — welcome to the BONK community! 🐶", tagline: "Community-driven BONK launchpad", caps: [] },
  moonshot:  { name: "Moonshot", icon: "🌙", advanced: false, fee: "Free mint · simple", gradSol: 0, cta: "🚀 Launch on Moonshot", success: "is LIVE on Moonshot! 🌙", tagline: "Mobile-first simple launch", caps: [] },
};

function lpHas(info, cap) { return info.caps && info.caps.includes(cap); }
function buildLaunchForm(userId) {
  const lp = db.getSysConfig(`launch_lp_${userId}`) || "pump";
  const info = LAUNCHPAD_INFO[lp] || LAUNCHPAD_INFO.pump;
  const name = db.getSysConfig(`launch_f_name_${userId}`) || "";
  const symbol = db.getSysConfig(`launch_f_symbol_${userId}`) || "";
  const desc = db.getSysConfig(`launch_f_desc_${userId}`) || "";
  const image = db.getSysConfig(`launch_f_image_${userId}`) || "";
  const xUrl = db.getSysConfig(`launch_f_x_${userId}`) || "";
  const tg = db.getSysConfig(`launch_f_tg_${userId}`) || "";
  const web = db.getSysConfig(`launch_f_web_${userId}`) || "";
  const devBuy = db.getSysConfig(`launch_f_devbuy_${userId}`) || "0";
  // advanced
  const supply = db.getSysConfig(`launch_f_supply_${userId}`) || "1000000000";
  const curve = db.getSysConfig(`launch_f_curve_${userId}`) || "justsendit";
  const grad = db.getSysConfig(`launch_f_grad_${userId}`) || "85";
  const vesting = db.getSysConfig(`launch_f_vesting_${userId}`) === "1";
  const revokeMint = db.getSysConfig(`launch_f_revokemint_${userId}`) !== "0";
  const revokeFreeze = db.getSysConfig(`launch_f_revokefreeze_${userId}`) !== "0";
  const burnLp = db.getSysConfig(`launch_f_burnlp_${userId}`) === "1";
  const maxWallet = db.getSysConfig(`launch_f_maxwallet_${userId}`) || "0";
  const bundleWallets = db.getSysConfig(`launch_f_bundlewallets_${userId}`) || "0";
  const bundlePer = db.getSysConfig(`launch_f_bundleper_${userId}`) || "0";
  const discord = db.getSysConfig(`launch_f_discord_${userId}`) || "";
  const vestingDays = db.getSysConfig(`launch_f_vestingdays_${userId}`) || "30";
  const bundleIds = (db.getSysConfig(`launch_f_bundleids_${userId}`) || "").split(",").filter(Boolean);
  const bundleExpanded = db.getSysConfig(`launch_f_bundle_exp_${userId}`) === "1";
  const bundleMode = db.getSysConfig(`launch_f_bundlemode_${userId}`) || "same";
  const advExpanded = db.getSysConfig(`launch_f_adv_exp_${userId}`) === "1";
  const decimals = db.getSysConfig(`launch_f_decimals_${userId}`) || "9";
  const teamAlloc = db.getSysConfig(`launch_f_teamalloc_${userId}`) || "0";
  const treasuryW = db.getSysConfig(`launch_f_treasury_${userId}`) || "";
  const creatorFee = db.getSysConfig(`launch_f_creatorfee_${userId}`) || "0";
  const startMc = db.getSysConfig(`launch_f_startmc_${userId}`) || "0";
  const antisnipe = db.getSysConfig(`launch_f_antisnipe_${userId}`) || "0";
  const buyback = db.getSysConfig(`launch_f_buyback_${userId}`) || "0";
  const initPrice = db.getSysConfig(`launch_f_initprice_${userId}`) || "0";
  const vestPct = db.getSysConfig(`launch_f_vestpct_${userId}`) || "0";
  const vestCliff = db.getSysConfig(`launch_f_vestcliff_${userId}`) || "0";
  let bundleAmounts = {};
  try { bundleAmounts = JSON.parse(db.getSysConfig(`launch_f_bundleamounts_${userId}`) || "{}"); } catch {}

  const ck = (v) => v ? "✅" : "⬜";
  const bundleIds2 = (db.getSysConfig(`launch_f_bundleids_${userId}`) || "").split(",").filter(Boolean);
  const sched2 = db.getSysConfig(`launch_f_schedule_${userId}`) || "";
  const gradStr = info.gradSol > 0 ? `graduates at ${info.gradSol} SOL (~${Math.round(info.gradSol * SOL_PRICE_USD / 1000)}K @ ${SOL_PRICE_USD}/SOL)` : "dynamic bonding curve";
  const fixedNote = !info.advanced ? "\n🔒 Supply, decimals & curve are FIXED by this\nlaunchpad. Token details CANNOT be changed\nafter launch — set them carefully." : "\n⚠️ Token details CANNOT be changed after launch.";
  const initBuyNum = parseFloat(devBuy) || 0;
  const needNum = (initBuyNum + 0.04).toFixed(2);
  let msg = `${info.icon} *${info.name}*\n_${info.tagline}_\n\n💸 ${info.fee}  ·  🎓 ${gradStr}\n\n💰 *Cost to you:* ~${needNum} SOL (initial buy ${initBuyNum} + ~0.04 fees/Jito tip). The graduation target is raised by ALL buyers — not your money.\n\n_Tap fields to set them. Name & Symbol required.\nTap 📖 Guide for help. Details can't change after launch._\n`;
  if (desc) msg += `\n📄 ${stripMd(desc).slice(0,150)}\n`;
  if (bundleIds2.length) msg += `🎁 Bundle: ${bundleIds2.length} wallet(s) buy at launch\n`;
  if (sched2) msg += `🕐 Scheduled: ${sched2}\n`;
  // (advanced values are shown on the buttons themselves — no need to repeat in text)
  // Wallet selector
  const wallets = db.getWallets(userId) || [];
  const freshUser = db.getUser(userId);
  const launchWalletId = parseInt(db.getSysConfig(`launch_f_wallet_${userId}`)) || freshUser.active_wallet_id;
  const selWal = wallets.find(w => w.wallet_id === launchWalletId) || wallets[0];
  const walletNum = selWal ? wallets.indexOf(selWal) + 1 : 1;
  const balance = selWal ? parseFloat(db.getSysConfig(`mock_balance_${selWal.public_key}`) || "0") : 0;
  const walletExpanded = db.getSysConfig(`launch_wallet_exp_${userId}`) === "1";
  let totalBundle = 0;
  if (bundleMode === "custom") {
    bundleIds.forEach(id => { totalBundle += parseFloat(bundleAmounts[id] || 0); });
  } else {
    totalBundle = bundleIds.length * (parseFloat(bundlePer)||0);
  }
  const schedule = db.getSysConfig(`launch_f_schedule_${userId}`) || "";
  msg += `\n💰 Dev Buy: *${devBuy} SOL*\n`;
  msg += `🎁 Bundle (${bundleMode}): *${bundleIds.length} wallets = ${totalBundle.toFixed(2)} SOL*\n`;
  msg += `🕐 Schedule: *${schedule ? schedule : "Launch now"}*\n`;
  msg += `🛡 Anti-Snipe: *${antisnipe > 0 ? antisnipe+"s" : "OFF"}* · 🔁 Buyback: *${buyback > 0 ? buyback+"%" : "OFF"}*\n`;
  msg += `\n💼 Wallet: *W${walletNum}* — ${balance.toFixed(3)} SOL`;

  const kb = { inline_keyboard: [] };
  // Wallet selector row
  if (walletExpanded) {
    for (let i = 0; i < wallets.length; i += 3) {
      kb.inline_keyboard.push(wallets.slice(i, i+3).map((w, idx) => {
        const num = i+idx+1;
        const l = (w.label && !w.label.match(/^W\d+$/)) ? ` ${w.label}` : "";
        const wb = parseFloat(db.getSysConfig(`mock_balance_${w.public_key}`) || "0");
        return { text: (w.wallet_id === launchWalletId ? `W${num}${l} ✅ ${wb.toFixed(1)}◎` : `W${num}${l} ${wb.toFixed(1)}◎`).slice(0,20), callback_data: `launch_f_setwallet_${w.wallet_id}` };
      }));
    }
    kb.inline_keyboard.push([{ text: "▲ Close", callback_data: "launch_f_wallet_close" }]);
  } else {
    kb.inline_keyboard.push([{ text: `💼 W${walletNum} — ${balance.toFixed(2)} SOL ▼`, callback_data: "launch_f_wallet_open" }, { text: "📖 Guide", callback_data: "launch_f_guide" }]);
  }
  // Name + Symbol show their values on the button
  kb.inline_keyboard.push([
    { text: name ? `📝 ${stripMd(name).slice(0,16)}` : "📝 Name", callback_data: "launch_f_name" },
    { text: symbol ? `🔤 ${stripMd(symbol).slice(0,12)}` : "🔤 Symbol", callback_data: "launch_f_symbol" },
  ]);
  kb.inline_keyboard.push([
    { text: `📄 Description ${ck(desc)}`, callback_data: "launch_f_desc" },
    { text: `🖼 Image ${ck(image)}`, callback_data: "launch_f_image" },
  ]);
  kb.inline_keyboard.push([
    { text: `🐦 X ${ck(xUrl)}`, callback_data: "launch_f_x" },
    { text: `✈️ TG ${ck(tg)}`, callback_data: "launch_f_tg" },
    { text: `🌐 Web ${ck(web)}`, callback_data: "launch_f_web" },
    { text: `💬 ${ck(discord)}`, callback_data: "launch_f_discord" },
  ]);
  // Advanced toggle (collapsed by default)
  const advCount = [name,symbol].filter(Boolean).length; // placeholder
  const advLabel = info.advanced
    ? (advExpanded ? "🔧 Custom Settings ▲" : "🔧 Custom Settings ▼")
    : (advExpanded ? "⚙️ More Options ▲" : "⚙️ More Options ▼");
  kb.inline_keyboard.push([{ text: advLabel, callback_data: "launch_f_adv_toggle" }]);
  if (advExpanded) {
    if (lpHas(info, "supply")) {
      kb.inline_keyboard.push([
        { text: `📦 Supply: ${supply}`, callback_data: "launch_f_supply" },
        { text: `🎯 Start MC: ${startMc > 0 ? startMc + " SOL" : "auto"}`, callback_data: "launch_f_startmc" },
      ]);
    }
    if (lpHas(info, "curve")) {
      const row = [];
      if (lpHas(info, "curve")) {
        const lpKey = db.getSysConfig(`launch_lp_${userId}`) || "pump";
        let curveLabel;
        if (lpKey === "meteora") curveLabel = curve === "dbc" ? "📈 DBC Curve ✅" : "📈 Curve Shape";
        else curveLabel = curve === "justsendit" ? "📈 justsendit ✅" : "📈 Custom";
        row.push({ text: curveLabel, callback_data: "launch_f_curve" });
      }
      if (row.length) kb.inline_keyboard.push(row);
    }
    if (lpHas(info, "grad") || lpHas(info, "migthreshold") || lpHas(info, "vesting")) {
      const row = [];
      if (lpHas(info, "grad")) row.push({ text: `🎓 Grad: ${grad} SOL`, callback_data: "launch_f_grad" });
      if (lpHas(info, "migthreshold")) row.push({ text: `🎯 Migration: ${grad > 0 ? grad + " SOL" : "auto"}`, callback_data: "launch_f_grad" });
      if (lpHas(info, "vesting")) row.push({ text: vesting ? "💎 Vesting: ON" : "💎 Vesting: OFF", callback_data: "launch_f_vesting" });
      if (row.length) kb.inline_keyboard.push(row);
    }
    if (lpHas(info, "vesting") && vesting) {
      kb.inline_keyboard.push([
        { text: vestingDays === "30" ? "30d ✅" : "30d", callback_data: "launch_f_vd_30" },
        { text: vestingDays === "60" ? "60d ✅" : "60d", callback_data: "launch_f_vd_60" },
        { text: vestingDays === "90" ? "90d ✅" : "90d", callback_data: "launch_f_vd_90" },
      ]);
      kb.inline_keyboard.push([
        { text: `💎 Vest %: ${vestPct}%`, callback_data: "launch_f_vestpct" },
        { text: `⏳ Cliff: ${vestCliff}d`, callback_data: "launch_f_vestcliff" },
      ]);
    }
    if (lpHas(info, "initprice")) {
      kb.inline_keyboard.push([{ text: `💲 Initial Price: ${initPrice > 0 ? initPrice : "auto"}`, callback_data: "launch_f_initprice" }]);
    }
    if (lpHas(info, "mintfreeze")) {
      kb.inline_keyboard.push([
        { text: revokeMint ? "🔒 Mint: ON" : "🔒 Mint: OFF", callback_data: "launch_f_revokemint" },
        { text: revokeFreeze ? "🔒 Freeze: ON" : "🔒 Freeze: OFF", callback_data: "launch_f_revokefreeze" },
      ]);
    }
    if (lpHas(info, "burnlp") || lpHas(info, "maxwallet")) {
      const row = [];
      if (lpHas(info, "burnlp")) row.push({ text: burnLp ? "🔥 Burn LP: ON" : "🔥 Burn LP: OFF", callback_data: "launch_f_burnlp" });
      if (lpHas(info, "maxwallet")) row.push({ text: `👥 Max Wallet: ${maxWallet > 0 ? maxWallet+"%" : "OFF"}`, callback_data: "launch_f_maxwallet" });
      if (row.length) kb.inline_keyboard.push(row);
    }
  }
  // ⚡ HawkX Tools separator (bundle/schedule/antisnipe/buyback work on ALL launchpads)
  if (advExpanded) {
    kb.inline_keyboard.push([{ text: "⚡ ── HawkX Tools ── ⚡", callback_data: "launch_f_noop" }]);
  }
  // Bundle selector — inside Advanced
  if (advExpanded && bundleExpanded) {
    const devWalletId = parseInt(db.getSysConfig(`launch_f_wallet_${userId}`)) || (db.getUser(userId)||{}).active_wallet_id;
    const bundleable = wallets.filter(w => w.wallet_id !== devWalletId);
    // Mode toggle
    kb.inline_keyboard.push([
      { text: bundleMode === "same" ? "💰 Same Amount ✅" : "💰 Same Amount", callback_data: "launch_f_bundlemode_same" },
      { text: bundleMode === "custom" ? "🔧 Custom Each ✅" : "🔧 Custom Each", callback_data: "launch_f_bundlemode_custom" },
    ]);
    // Wallet buttons 4 per row with real names
    for (let i = 0; i < bundleable.length; i += 4) {
      kb.inline_keyboard.push(bundleable.slice(i, i+4).map((w) => {
        const num = wallets.indexOf(w) + 1;
        const sel = bundleIds.includes(String(w.wallet_id));
        const nm = (w.label && !w.label.match(/^W\d+$/)) ? w.label : `W${num}`;
        const wBal = parseFloat(db.getSysConfig(`mock_balance_${w.public_key}`) || "0");
        const need = (bundleMode === "custom" ? (parseFloat(bundleAmounts[w.wallet_id]||0)) : (parseFloat(bundlePer)||0)) + 0.02;
        const lowFunds = sel && wBal < need;
        let label = sel ? `${nm} ✅` : nm;
        if (sel && bundleMode === "custom") label = `${nm}:${bundleAmounts[w.wallet_id]||0}`;
        if (lowFunds) label = "⚠️" + label;
        return { text: label.slice(0,18), callback_data: `launch_f_bundletoggle_${w.wallet_id}` };
      }));
    }
    if (bundleMode === "same") {
      kb.inline_keyboard.push([{ text: `💰 Per Wallet: ${bundlePer} SOL`, callback_data: "launch_f_bundleper" }]);
    }
    kb.inline_keyboard.push([{ text: "▲ Close Bundle", callback_data: "launch_f_bundle_close" }]);
  } else if (advExpanded) {
    kb.inline_keyboard.push([
      { text: `🎁 Bundle: ${bundleIds.length} wallets ▼`, callback_data: "launch_f_bundle_open" },
    ]);
  }
  if (advExpanded) {
    // All HawkX tools + native fields — strictly 2 per row
    const toolBtns = [
      { text: schedule ? `🕐 ${schedule}` : "🕐 Schedule", callback_data: "launch_f_schedule" },
      { text: `🛡 Anti-Snipe: ${antisnipe > 0 ? antisnipe+"s" : "OFF"}`, callback_data: "launch_f_antisnipe" },
      { text: `🔁 Buyback: ${buyback > 0 ? buyback+"%" : "OFF"}`, callback_data: "launch_f_buyback" },
    ];
    if (lpHas(info, "decimals")) toolBtns.push({ text: `🔢 Decimals: ${decimals}`, callback_data: "launch_f_decimals" });
    if (lpHas(info, "teamalloc")) toolBtns.push({ text: `👥 Team Alloc: ${teamAlloc > 0 ? teamAlloc+"%" : "OFF"}`, callback_data: "launch_f_teamalloc" });
    if (lpHas(info, "creatorfee")) toolBtns.push({ text: `💵 Creator Fee: ${creatorFee > 0 ? creatorFee+"%" : "OFF"}`, callback_data: "launch_f_creatorfee" });
    for (let i = 0; i < toolBtns.length; i += 2) {
      kb.inline_keyboard.push(toolBtns.slice(i, i + 2));
    }
    // Treasury — only show when it's actually used (buyback or team alloc active)
    const treasuryNeeded = (parseFloat(buyback) > 0) || (parseFloat(teamAlloc) > 0);
    if (treasuryNeeded) {
      kb.inline_keyboard.push([{ text: treasuryW ? "🏦 Treasury ✅" : "🏦 Treasury Wallet (for buyback/team funds)", callback_data: "launch_f_treasury" }]);
    }
  }
  // Launch wallet readiness check
  const needToLaunch = (parseFloat(devBuy) || 0) + 0.04; // initial buy + launch fee + jito tip buffer
  const launchWalletLow = balance < needToLaunch;
  if (launchWalletLow) {
    msg += `\n⚠️ *W${walletNum} has ${balance.toFixed(2)} SOL.* You need ~${needToLaunch.toFixed(2)} SOL (initial buy + fees + Jito tip) to launch. Top up or lower the initial buy.`;
  }
  kb.inline_keyboard.push([{ text: launchWalletLow ? `⚠️ 💰 Initial Buy: ${devBuy} SOL` : `💰 Initial Buy: ${devBuy} SOL`, callback_data: "launch_f_devbuy" }]);
  const ready = name && symbol;
  kb.inline_keyboard.push([{ text: ready ? "📋 Review & Launch" : "❗ Set name & symbol", callback_data: ready ? "launch_f_review" : "launch_f_noop" }]);
  // (CTA uses platform branding on confirm)
  kb.inline_keyboard.push([{ text: "← Back", callback_data: "menu_launch" }]);
  return { msg, kb };
}

async function showLaunchScreen(ctx, userId) {
  const launches = db.getLaunches(userId);
  const msg =
    `🚀 *Launch Token*\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Create and launch your own token in\nseconds. Pick a launchpad to start.\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `🌊 *pump.fun* — simplest, instant\n` +
    `🔵 *Raydium LaunchLab* — advanced control\n` +
    `🟣 *Meteora DBC* — dynamic curve\n` +
    `🟡 *LetsBonk* — meme focused\n` +
    `🌙 *Moonshot* — mobile first\n\n` +
    `📜 My Launches: *${launches.length}*`;
  const kb = { inline_keyboard: [
    [{ text: "🌊 pump.fun", callback_data: "launch_lp_pump" }, { text: "🔵 Raydium LaunchLab", callback_data: "launch_lp_launchlab" }],
    [{ text: "🟣 Meteora DBC", callback_data: "launch_lp_meteora" }, { text: "🟡 LetsBonk", callback_data: "launch_lp_letsbonk" }],
    [{ text: "🌙 Moonshot", callback_data: "launch_lp_moonshot" }],
    [{ text: `📜 My Launches (${launches.length})`, callback_data: "launch_my_list" }],
    [{ text: "← Back", callback_data: "menu_main" }],
  ]};
  try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); }
  catch { await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb }); }
}



async function showWatchlistScreen(ctx, userId) {
  const items = db.getWatchlist(userId);
  const alerts = db.getPriceAlerts(userId);
  let msg = "⭐ *Watchlist & Alerts*\n\n━━━━━━━━━━━━━━━━━━━\n📈 Chart · 🟢 Buy · 🔔 Set price alerts\n💡 Get notified when a token hits your target\n━━━━━━━━━━━━━━━━━━━\n";
  const kb = { inline_keyboard: [] };

  if (!items.length) {
    msg += "_No tokens yet. Tap ➕ to add one._\n━━━━━━━━━━━━━━━━━━━";
  } else {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let info = {};
      try { info = await getTokenInfo(it.token_ca); } catch {}
      const name = info.name || it.token_name || it.token_ca.slice(0, 8);
      const dexUrl = "https://dexscreener.com/solana/" + it.token_ca;
      const priceStr = info.price ? formatPrice(info.price) : "—";
      const mcStr = info.mcap ? formatNum(info.mcap) : "—";
      const fmt = (v) => !v ? "—" : (v > 0 ? "🟢+" : "🔴") + Math.abs(v).toFixed(1) + "%";

      // All alerts for this token
      const tokenAlerts = alerts.filter(a => a.token_ca === it.token_ca);
      let alertLine = "🔔 _No alert_";
      if (tokenAlerts.length) {
        alertLine = tokenAlerts.map(a => {
          const val = a.target_price >= 1000000 ? "$"+(a.target_price/1000000).toFixed(1)+"M"
            : a.target_price >= 1000 ? "$"+(a.target_price/1000).toFixed(0)+"K" : "$"+a.target_price;
          return "🔔 " + (a.direction === "mcap_above" ? "MC▲" : "▲") + val;
        }).join(" · ");
      }

      msg += "\n*" + (i+1) + ". " + name + (info.symbol ? " (" + info.symbol + ")" : "") + "* · [📈 Chart](" + dexUrl + ")\n";
      msg += priceStr + " · MC " + mcStr + "\n";
      msg += "5m:" + fmt(info.change5m) + " 1h:" + fmt(info.change1h) + " 6h:" + fmt(info.change6h) + " 24h:" + fmt(info.change24h) + "\n";
      msg += alertLine + "\n━━━━━━━━━━━━━━━━━━━\n";

      kb.inline_keyboard.push([
        { text: "🟢 Buy " + ((info.symbol || name).slice(0,10)), callback_data: "wl_buy_" + it.id },
        { text: "🔔 Alert", callback_data: "wl_alert_" + it.id },
        { text: "🗑", callback_data: "wl_remove_" + it.id },
      ]);
    }
  }

  kb.inline_keyboard.push([{ text: "➕ Add Token", callback_data: "watchlist_add" }]);
  kb.inline_keyboard.push([
    { text: "← Back", callback_data: "menu_main" },
    { text: "🔄 Refresh", callback_data: "menu_watchlist" },
  ]);

  const curMsgId = ctx.callbackQuery?.message?.message_id;
  if (curMsgId) db.setSysConfig("wl_msg_" + userId, String(curMsgId));
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
  try {
    if (curMsgId && chatId) {
      await ctx.api.editMessageText(chatId, curMsgId, msg, { parse_mode: "Markdown", reply_markup: kb, disable_web_page_preview: true });
    } else {
      const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb, disable_web_page_preview: true });
      db.setSysConfig("wl_msg_" + userId, String(s.message_id));
    }
  } catch(e) {
    if (e?.description?.includes("not modified")) return;
    const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb, disable_web_page_preview: true });
    db.setSysConfig("wl_msg_" + userId, String(s.message_id));
  }
}

module.exports = {
  LAUNCHPAD_INFO,
  showWatchlistScreen,
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
  showLaunchScreen, buildLaunchForm,
};
