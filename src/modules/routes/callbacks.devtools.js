const db = require("../../../database");
const { mockBuy, mockSell } = require("../executor");
const { handleFaucet } = require("../faucet");
const { buildMainMenu, getGuide } = require("../keyboards");

async function handleDevToolCallbacks(ctx, data, userId, user, bot, ks) {
    // ── DEVNET TOOLS ──────────────────────────────────────────
    if (data === "devnet_faucet") {
      await ctx.answerCallbackQuery();
      return handleFaucet(ctx, user);
    }

    if (data === "devnet_mock_buy") {
      if (ks) {
        await ctx.answerCallbackQuery("🔴 Trading paused.", {
          show_alert: true,
        });
        return true;
      }
      await ctx.answerCallbackQuery();
      const ca = `DEVNET_TOKEN_${Date.now()}`;
      await mockBuy(ctx, user, ca, 0.1);
      return true;
    }

    if (data === "devnet_mock_sell") {
      if (ks) {
        await ctx.answerCallbackQuery("🔴 Trading paused.", {
          show_alert: true,
        });
        return true;
      }
      await ctx.answerCallbackQuery();
      const positions = db.getOpenPositions(userId);
      if (!positions.length) {
        await ctx.reply("No open positions to sell.");
        return true;
      }
      await mockSell(ctx, user, positions[0], 100);
      return true;
    }

    if (data === "devnet_add_volume") {
      db.addVolume(userId, 1);
      await ctx.answerCallbackQuery("✅ +1 SOL volume added");
      return showSettings(ctx, db.getUser(userId));
    }

    // ── HELP ──────────────────────────────────────────────────
    if (data === "menu_help") {
      await ctx.answerCallbackQuery();
      const helpMsg = "❓ *HawkX Help*\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "*Getting Started:*\n" +
        "1. Get test SOL — 🚰 Faucet\n" +
        "2. Paste a token CA in chat to buy\n" +
        "3. View positions → manage trades\n" +
        "4. Invite friends → earn referrals\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "*Modes:*\n" +
        "🌱 Beginner — simple layout\n" +
        "⚡ Pro — full features + sniper + copy\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "*Security:*\n" +
        "🔐 Set a PIN in Settings → protects key export\n" +
        "🔑 Non-custodial — only you hold your keys\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "*Need help?*\n" +
        "💬 Community: t.me/HawkxUserVerify\n" +
        "📢 Updates: t.me/HawkxUpdates\n" +
        "🛟 Support: @CryptoFazl";
      const helpKb = { inline_keyboard: [
        [{ text: "📖 FAQ — Common Questions", callback_data: "help_faq" }],
        [{ text: "📜 Terms & Privacy", callback_data: "help_legal" }],
        [{ text: "💬 Community", url: "https://t.me/HawkxUserVerify" }, { text: "📢 Updates", url: "https://t.me/HawkxUpdates" }],
        [{ text: "← Back", callback_data: "menu_main" }],
      ] };
      try { await ctx.editMessageText(helpMsg, { parse_mode: "Markdown", reply_markup: helpKb }); }
      catch { await ctx.reply(helpMsg, { parse_mode: "Markdown", reply_markup: helpKb }); }
      return true;
    }


    // ── FAQ ──────────────────────────────────────────────────
    if (data === "help_faq") {
      await ctx.answerCallbackQuery();
      const msg = "📖 *HawkX FAQ*\n\nTap a question to see the answer:";
      const kb = { inline_keyboard: [
        [{ text: "💰 How do I buy a token?", callback_data: "faq_buy" }],
        [{ text: "📤 How do I sell?", callback_data: "faq_sell" }],
        [{ text: "🏦 How do I deposit / withdraw?", callback_data: "faq_wallet" }],
        [{ text: "💸 What are the fees?", callback_data: "faq_fees" }],
        [{ text: "🔐 Is it safe? Who holds my keys?", callback_data: "faq_safe" }],
        [{ text: "🏅 How do ranks work?", callback_data: "faq_ranks" }],
        [{ text: "👥 How do referrals work?", callback_data: "faq_ref" }],
        [{ text: "🎯 What is Sniper / Copy Trade?", callback_data: "faq_auto" }],
        [{ text: "← Back", callback_data: "menu_help" }],
      ]};
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); }
      catch { await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb }); }
      return true;
    }

    const FAQ = {
      faq_buy: "💰 *How do I buy?*\n\nJust paste a token's contract address (CA) into the chat. HawkX shows the token with a safety scan, then tap a buy amount. Your active wallet is used. Done in seconds.",
      faq_sell: "📤 *How do I sell?*\n\nTap 🔴 SELL (or open Positions), pick the token, choose a sell % (25/50/100 or custom). You can also set Auto-Sell templates with Stop Loss / Take Profit to sell automatically.",
      faq_wallet: "🏦 *Deposit / Withdraw*\n\n*Deposit:* Go to Wallets → copy your address → send SOL to it.\n*Withdraw:* Wallets → Withdraw → enter address + amount → confirm with your PIN.\n\nAlways double-check the address — blockchain transfers are irreversible.",
      faq_fees: "💸 *Fees*\n\nHawkX charges a small trading fee that DROPS as you trade more (rank up). It starts at 1% (Scout) and goes down to 0.50% (Hawk Elite). Network + priority fees are separate and go to the blockchain, not us.",
      faq_safe: "🔐 *Security*\n\nHawkX is *non-custodial* — only YOU hold your keys. They're encrypted (AES-256). Set a PIN in Settings to protect key export and withdrawals. We never sell your data or touch your funds.",
      faq_ranks: "🏅 *Ranks*\n\n7 ranks: Scout → Tracker → Hunter → Predator → Apex → Hawk → Hawk Elite. You rank up automatically by trading more volume — and your fee drops at each rank. Check your rank on the main menu.",
      faq_ref: "👥 *Referrals*\n\nShare your referral link/code. You earn a % of the fees from everyone you refer — across 6 levels (30% / 4% / 3% / 2% / 1.5% / 1%). Claim your earnings anytime in the Referrals menu.",
      faq_auto: "🎯 *Sniper & Copy Trade*\n\n*Sniper* auto-buys new token launches based on your rules.\n*Copy Trade* mirrors trades from wallets or channels you follow.\nBoth are in Pro mode. Set your amount, filters, and auto-sell, then let HawkX work.",
    };
    if (FAQ[data]) {
      await ctx.answerCallbackQuery();
      const kb = { inline_keyboard: [[{ text: "← Back to FAQ", callback_data: "help_faq" }]] };
      try { await ctx.editMessageText(FAQ[data], { parse_mode: "Markdown", reply_markup: kb }); }
      catch { await ctx.reply(FAQ[data], { parse_mode: "Markdown", reply_markup: kb }); }
      return true;
    }

    // ── TERMS & PRIVACY ──────────────────────────────────────
    if (data === "help_legal") {
      await ctx.answerCallbackQuery();
      const msg = "📜 *HawkX Terms & Privacy*\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "*Terms — Quick Summary*\n" +
        "• HawkX is a non-custodial tool, not a bank, broker, or advisor.\n" +
        "• Nothing here is financial advice. Trade at your own risk.\n" +
        "• Crypto is volatile — you can lose all your funds. Transactions are irreversible.\n" +
        "• We charge a trading fee (shown in-bot, lower as your rank rises).\n" +
        "• You're responsible for your keys, decisions, taxes, and local laws.\n" +
        "• Provided \"as is\" — no guarantees on uptime/execution. Not liable for losses.\n" +
        "• Must be 18+ and legally allowed to trade crypto where you live.\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "*Privacy — Quick Summary*\n" +
        "• We collect only what's needed: Telegram ID, wallet addresses, trades, settings.\n" +
        "• Private keys are encrypted (AES-256). We never sell data or access your keys.\n" +
        "• Non-custodial — your funds are always yours.\n" +
        "• Blockchain transactions are public and permanent.\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "_By using HawkX you agree to these terms._\n" +
        "Full docs: linktr.ee/hawkxbot";
      const kb = { inline_keyboard: [[{ text: "← Back", callback_data: "menu_help" }]] };
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); }
      catch { await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb }); }
      return true;
    }

    return false;
}

module.exports = { handleDevToolCallbacks };
