// M04 — Router V12 — All callbacks wired (REFACTORED)
const {
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
} = require("./routes/helpers.routes");
const db = require("../../database");
const config = require("../../config");
const { InputFile } = require("grammy");
const bcrypt = require("bcryptjs");
const { setupCommands } = require("./routes/commands.routes");
const { setupMessages } = require("./routes/messages.routes");
const { handleMenuCallbacks } = require("./routes/callbacks.menu");
const { handleTradingCallbacks, handlePnlCardToggle } = require("./routes/callbacks.trading");
const { handleWalletCallbacks } = require("./routes/callbacks.wallet");
const { handleCopyTradeCallbacks } = require("./routes/callbacks.copytrade");
const { handleSniperCallbacks } = require("./routes/callbacks.sniper");
const { handleLimitOrderCallbacks } = require("./routes/callbacks.limitorders");
const { handleLaunchCallbacks } = require("./routes/callbacks.launch");
const { handleWatchlistCallbacks } = require("./routes/callbacks.watchlist");
const { handleReferralCallbacks } = require("./routes/callbacks.referrals");
const { handleDevToolCallbacks } = require("./routes/callbacks.devtools");
const { handleAdminCallbacks } = require("./routes/callbacks.admin");
const { handleStart } = require("./onboarding");
const { showSettings, handleSettingCallback, handleTextInput, doExportKey } = require("./settings/index");
const { getPortfolio, getTokenPosition } = require("./portfolio");
const { mockBuy, mockSell, handleAutoBuy, executeRealtimeSnipe } = require("./executor");
const { addWallet, deleteWallet, decryptWallet, isSolanaAddress } = require("./walletVault");
const { getActiveWallet, setActiveWallet, getBalance } = require("./walletSwitcher");
const { handleFaucet } = require("./faucet");
const { buildReferralMessage, addPromoter, removePromoter } = require("./referrals");
const { showAdminPanel, handleAdminCallback, handleAdminTextInput, isAdmin } = require("./admin");
const { buildMainMenu, buildSettingsMenu, buildWalletMenu, buildWalletDeleteSelect, buildWalletExportSelect, buildCopyTradeMenu, buildCopyWalletListMenu, buildCopyChannelListMenu, buildCopyChannelSettingsMenu, buildSniperMainMenu, buildAutoSniperMenu, buildSniperConfigMenu, buildMigrationSniperMenu, buildRealtimeSnipeMenu, buildLimitOrdersMenu, buildLimitOrderSetupMenu, buildWatchlistMenu, getModeLabel, getGuide } = require("./keyboards");
const { getTokenInfo, formatNum, formatPrice } = require("./tokenInfo");

function setupRouter(bot) {
  // Register commands with Telegram

  setupCommands(bot);

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    let user = db.getUser(userId);

    if (!user) {
      await ctx.answerCallbackQuery("Please /start first.");
      return;
    }
    db.touchLastActive(userId);

    const ks = require("./killSwitch").isActive();
    if (await handleMenuCallbacks(ctx, data, userId, user, bot, ks)) return;

    if (await handleTradingCallbacks(ctx, data, userId, user, bot, ks)) return;
    if (await handlePnlCardToggle(ctx, data, userId)) return;

    if (await handleWalletCallbacks(ctx, data, userId, user, bot, ks)) return;

    if (await handleCopyTradeCallbacks(ctx, data, userId, user, bot, ks)) return;

    if (await handleSniperCallbacks(ctx, data, userId, user, bot, ks)) return;

    if (await handleLimitOrderCallbacks(ctx, data, userId, user, bot, ks)) return;

    if (await handleLaunchCallbacks(ctx, data, userId, user, bot, ks)) return;

    if (await handleWatchlistCallbacks(ctx, data, userId, user, bot, ks)) return;
    if (await handleReferralCallbacks(ctx, data, userId, user, bot, ks)) return;

    if (await handleDevToolCallbacks(ctx, data, userId, user, bot, ks)) return;
    if (await handleAdminCallbacks(ctx, data, userId, user, bot, ks)) return;

    // ── DEFAULT ───────────────────────────────────────────────
    await ctx.answerCallbackQuery();
  });
  setupMessages(bot);
}

async function deleteMsg(ctx, msgId) {
  if (!msgId) return;
  try {
    await ctx.api.deleteMessage(ctx.chat.id, msgId);
  } catch {}
}

module.exports = { setupRouter };
