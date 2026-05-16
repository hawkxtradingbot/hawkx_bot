const db = require("../../../database");
const { handleStart } = require("../onboarding");
const { handlePnlCard } = require("./helpers.routes");
const { showAdminPanel, isAdmin } = require("../admin");

function setupCommands(bot) {
  // Helper: make command ctx work like callback ctx
  function makeCbCtx(ctx) {
    ctx.answerCallbackQuery = async () => {};
    ctx.callbackQuery = { data: "", message: ctx.message };
    return ctx;
  }

  bot.api.setMyCommands([
    { command: "start",     description: "🏠 Main Menu" },
    { command: "buy",       description: "🟢 Buy a token" },
    { command: "sell",      description: "🔴 Sell positions" },
    { command: "positions", description: "📂 Open positions" },
    { command: "wallets",   description: "💼 Manage wallets" },
    { command: "settings",  description: "⚙️ Settings" },
    { command: "referrals", description: "💰 Referrals" },
    { command: "mystats",   description: "📊 Stats & Rank" },
    { command: "sniper",    description: "🎯 Sniper (Pro)" },
    { command: "help",      description: "❓ Help" },
  ]).catch(() => {});

  bot.command("start", async (ctx) => {
    const param = ctx.match || "";
    if (param.startsWith("pnlcard_")) {
      const posId = parseInt(param.replace("pnlcard_", ""));
      const user = db.getUser(ctx.from.id);
      if (!user) {
        await ctx.reply("Please /start first.");
        return;
      }
      return handlePnlCard(ctx, user, posId, false);
    }
    return handleStart(ctx, bot);
  });
  bot.command("buy", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    ctx.callbackQuery = { message: ctx.message };
    db.setSysConfig(`pending_${ctx.from.id}`, "buy_paste_ca_first");
    const msg = await ctx.reply("🟢 *Buy Token*\n\nPaste the token CA:", { parse_mode: "Markdown" });
    db.setSysConfig(`prompt_msg_${ctx.from.id}`, String(msg.message_id));
  });

  bot.command("sell", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    const { getPortfolio } = require("../portfolio");
    return getPortfolio(ctx, user);
  });

  bot.command("positions", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    const { getPortfolio } = require("../portfolio");
    return getPortfolio(ctx, user);
  });

  bot.command("wallets", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    makeCbCtx(ctx);
    const { showWalletScreen } = require("../routes/callbacks.wallet");
    return showWalletScreen(ctx, ctx.from.id, null);
  });

  bot.command("settings", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    const { showSettings } = require("../settings/index");
    return showSettings(ctx, user);
  });

  bot.command("referrals", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    const { buildReferralScreen } = require("./helpers.routes");
    return buildReferralScreen(ctx, ctx.from.id, false);
  });


  bot.command("faucet", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    await ctx.callbackQuery ? null : (ctx.callbackQuery = {});
    const { handleFaucet } = require("../faucet");
    return handleFaucet(ctx, user);
  });

  bot.command("mystats", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    makeCbCtx(ctx);
    const { handleMenuCallbacks } = require("./callbacks.menu");
    return handleMenuCallbacks(ctx, "menu_stats", ctx.from.id, user, bot, false);
  });

  bot.command("security", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    await ctx.reply(
      `🔐 *HawkX Security*\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🛡️ *HOW WE PROTECT YOU*\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔑 *Private Keys*\n` +
      `Your wallet private key is encrypted\n` +
      `with AES-256-GCM military grade\n` +
      `encryption before storing.\n\n` +
      `👁️ *Zero Knowledge*\n` +
      `HawkX team CANNOT see your\n` +
      `private key. Ever.\n\n` +
      `💾 *Storage*\n` +
      `Encrypted keys stored in secure\n` +
      `database. Never in plain text.\n\n` +
      `🌐 *Open Source*\n` +
      `Our code is public. Verify our\n` +
      `security yourself:\n` +
      `github.com/hawkxtradingbot/hawkx_bot\n\n` +
      `⚠️ *Your Responsibility*\n` +
      `• Never share your seed phrase\n` +
      `• Never share bot access\n` +
      `• Use strong Telegram password\n` +
      `• Enable 2FA on Telegram\n\n` +
      `━━━━━━━━━━━━━━━━━━━`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "menu_main" }]] }}
    );
  });
  
  bot.command("help", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
      await ctx.reply(
        `❓ *HawkX — All Commands*\n\n` +
        `━━━ 🌱 Basic ━━━\n` +
        `/start — Main Menu\n` +
        `/buy — Buy a token\n` +
        `/sell — Sell positions\n` +
        `/positions — Open positions\n` +
        `/wallets — Manage wallets\n` +
        `/settings — Configure bot\n` +
        `/faucet — Get devnet SOL\n` +
        `/mystats — Your rank & stats\n` +
        `/referrals — Referral program\n\n` +
        `━━━ ⚡ Pro ━━━\n` +
        `/sniper — Token Sniper\n` +
        `/copytrade — Copy Trade\n` +
        `/launch — Launch Token\n` +
        `/limitorders — Limit Orders\n` +
        `/autobuy — Auto Buy\n` +
        `/autosell — Auto Sell\n\n` +
        `━━━ 🔐 Security ━━━\n` +
        `• AES-256-GCM encrypted wallets\n` +
        `• Zero knowledge — we can't see keys\n` +
        `• Open source code on GitHub\n` +
        `• github.com/hawkxtradingbot/hawkx_bot\n\n` +
        `💡 Paste any CA to trade instantly!`,
        { reply_markup: { inline_keyboard: [[{ text: "🏠 Main Menu", callback_data: "menu_main" }]] }}
    );
  });

  bot.command("sniper", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    makeCbCtx(ctx);
    const { handleSniperCallbacks } = require("./callbacks.sniper");
    return handleSniperCallbacks(ctx, "menu_sniper", ctx.from.id, user, bot, false);
  });

  bot.command("copytrade", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    makeCbCtx(ctx);
    const { handleCopyTradeCallbacks } = require("./callbacks.copytrade");
    return handleCopyTradeCallbacks(ctx, "menu_copy_trade", ctx.from.id, user, bot, false);
  });

  bot.command("launch", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    makeCbCtx(ctx);
    const { showLaunchScreen } = require("./helpers.routes");
    return showLaunchScreen(ctx, ctx.from.id);
  });

  bot.command("limitorders", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    makeCbCtx(ctx);
    const db2 = require("../../../database");
    db2.setSysConfig(`lo_msg_${ctx.from.id}`, "0");
    const { showLimitOrdersScreen } = require("./helpers.routes");
    return showLimitOrdersScreen(ctx, ctx.from.id);
  });

  bot.command("watchlist", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    makeCbCtx(ctx);
    const { handleWatchlistCallbacks } = require("./callbacks.watchlist");
    return handleWatchlistCallbacks(ctx, "menu_watchlist", ctx.from.id, user, bot, false);
  });

  bot.command("autobuy", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    makeCbCtx(ctx);
    const db2 = require("../../../database");
    db2.setSysConfig(`autobuy_msg_${ctx.from.id}`, "0");
    const { handleSettingCallback } = require("../settings/index");
    return handleSettingCallback(ctx, user, "pset_autobuy_screen", bot);
  });

  bot.command("autosell", async (ctx) => {
    const user = db.getUser(ctx.from.id);
    if (!user) return ctx.reply("Please /start first.");
    makeCbCtx(ctx);
    const { handleSettingCallback } = require("../settings/index");
    return handleSettingCallback(ctx, user, "pset_autosell_screen", bot, async (source) => {
      if (source === "msnipe_as_back" || source === "msnipe_open_as") return refreshMsnipeScreen(ctx, userId);
      if (source === "sniper_realtime_menu") { ctx.callbackQuery.data = "sniper_realtime_menu"; await bot.handleUpdate({ callback_query: ctx.callbackQuery }); }
    });
  });

  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await showAdminPanel(ctx);
  });

  // ── Callback handler ─────────────────────────────────────────
}

module.exports = { setupCommands };
