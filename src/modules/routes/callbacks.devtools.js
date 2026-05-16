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
        "2. Paste token CA in chat to buy\n" +
        "3. View positions → manage trades\n" +
        "4. Invite friends → earn referrals\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "*Modes:*\n" +
        "🌱 Beginner — simple 8-button layout\n" +
        "⚡ Pro — full features + sniper + copy\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "*Security:*\n" +
        "🔐 Set PIN in Settings → protects key export\n" +
        "🔑 Non-custodial — only you hold your keys\n\n" +
        "━━━━━━━━━━━━━━━━━━━\n" +
        "*Support:* @HawkXSupport\n" +
        "*Channel:* @HawkX_Trade_Bot";
      const helpKb = { inline_keyboard: [[{ text: "← Back", callback_data: "menu_main" }]] };
      try { await ctx.editMessageText(helpMsg, { parse_mode: "Markdown", reply_markup: helpKb }); }
      catch { await ctx.reply(helpMsg, { parse_mode: "Markdown", reply_markup: helpKb }); }
      return true;
    }


    return false;
}

module.exports = { handleDevToolCallbacks };
