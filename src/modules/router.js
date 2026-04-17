// M04 — Router (Devnet version with test commands)
const killSwitch = require("./killSwitch");
const db = require("../../database");
const { t } = require("./i18n");
const { handleStart } = require("./onboarding");
const {
  showSettings,
  handleSettingCallback,
  handleTextInput,
} = require("./settings");
const {
  buildMainMenu,
  buildTradeMenu,
  buildModulesMenu,
  buildWalletMenu,
} = require("./keyboards");
const { getReferralStats } = require("./referrals");
const { checkAndPromote } = require("./ranks");

async function setupRouter(bot) {
  // ── COMMANDS ──

  bot.command("start", async (ctx) => {
    ctx.match = ctx.match || "";
    await handleStart(ctx);
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "🦅 *HawkX Devnet Help*\n\n" +
        "*/start* — Start bot\n" +
        "*/trade* — Trade menu\n" +
        "*/portfolio* — View positions\n" +
        "*/settings* — Settings\n" +
        "*/referrals* — Referral stats\n" +
        "*/wallets* — Wallet manager\n" +
        "*/faucet* — Get free devnet SOL\n" +
        "*/mockbuy [CA] [SOL]* — Simulate buy\n" +
        "*/mocksell* — Simulate sell\n" +
        "*/addvolume [SOL]* — Add test volume (rank up)\n" +
        "*/mystats* — Your stats\n" +
        "*/admin* — Admin panel\n\n" +
        "🧪 _DEVNET MODE — No real SOL used_",
      { parse_mode: "Markdown" },
    );
  });

  bot.command("trade", async (ctx) => {
    if (killSwitch.isActive()) {
      const user = db.getUser(ctx.from.id);
      return ctx.reply(t("killswitch.active", user?.language || "en"));
    }
    const user = await ensureUser(ctx);
    if (!user) return;
    await ctx.reply("⚡ *Trade Menu* [DEVNET]", {
      parse_mode: "Markdown",
      reply_markup: buildTradeMenu(user),
    });
  });

  bot.command("portfolio", async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const { getPortfolio } = require("./portfolio");
    await getPortfolio(ctx, user);
  });

  bot.command("settings", async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const settings = db.getSettings(user.user_id);
    await ctx.reply("⚙️ *Settings*", {
      parse_mode: "Markdown",
      reply_markup: require("./keyboards").buildSettingsMenu({
        ...user,
        settings,
      }),
    });
  });

  bot.command("referrals", async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const stats = getReferralStats(user.user_id);
    await ctx.reply(
      `👥 *Referral Stats* [DEVNET]\n\n` +
        `🔗 Link: \`${stats.referralLink}\`\n` +
        `💰 All-Time: ${stats.allTime.toFixed(4)} SOL\n` +
        `⏳ Pending: ${stats.pending.toFixed(4)} SOL\n\n` +
        `Levels: 30% / 4% / 3% / 2% / 1.5% / 1%`,
      { parse_mode: "Markdown" },
    );
  });

  bot.command("wallets", async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const wallets = db.getWallets(user.user_id);
    if (!wallets.length) {
      await ctx.reply("No wallets yet.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🆕 Generate Wallet", callback_data: "wallet_generate" }],
          ],
        },
      });
      return;
    }
    await ctx.reply("👛 *Your Wallets*", {
      parse_mode: "Markdown",
      reply_markup: buildWalletMenu(wallets, user.active_wallet_id),
    });
  });

  // ── DEVNET TEST COMMANDS ──

  bot.command("faucet", async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const { handleFaucet } = require("./faucet");
    await handleFaucet(ctx, user);
  });

  bot.command("mockbuy", async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    if (killSwitch.isActive())
      return ctx.reply(t("killswitch.active", user.language));
    const args = ctx.match ? ctx.match.trim().split(" ") : [];
    const ca = args[0] || "DEVNET_TOKEN_" + Date.now();
    const sol = parseFloat(args[1]) || 0.1;
    const { mockBuy } = require("./executor");
    await mockBuy(ctx, user, ca, sol);
  });

  bot.command("mocksell", async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const positions = db.getOpenPositions(user.user_id);
    if (!positions.length) return ctx.reply("No open positions to sell.");
    const { mockSell } = require("./executor");
    await mockSell(ctx, user, positions[0]);
  });

  bot.command("addvolume", async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const args = ctx.match ? ctx.match.trim() : "1";
    const vol = parseFloat(args) || 1;
    db.addVolume(user.user_id, vol);
    const promoted = checkAndPromote(
      user.user_id,
      require("./notifications").notify,
    );
    const updated = db.getUser(user.user_id);
    await ctx.reply(
      `✅ Added ${vol} SOL volume.\n` +
        `📊 Total: ${updated.cumulative_volume_sol.toFixed(2)} SOL\n` +
        `🏅 Rank: ${require("../../config").RANK_NAMES[updated.rank]}\n` +
        `${promoted ? "🎉 RANK UP!" : ""}`,
      { parse_mode: "Markdown" },
    );
  });

  bot.command("mystats", async (ctx) => {
    const user = await ensureUser(ctx);
    if (!user) return;
    const config = require("../../config");
    const trades = db.getTradeHistory(user.user_id, 100);
    const positions = db.getOpenPositions(user.user_id);
    const rankKey = config.RANK_FEE_KEYS[user.rank] || "scout";
    const fee = user.trial_active
      ? 0.3
      : (config.FEE_RATES[rankKey] * 100).toFixed(2);
    const nextRank =
      user.rank < 7 ? config.RANK_THRESHOLDS[user.rank + 1] : "MAX";
    const needed =
      user.rank < 7 ? (nextRank - user.cumulative_volume_sol).toFixed(2) : "—";

    await ctx.reply(
      `📊 *Your Stats* [DEVNET]\n\n` +
        `👤 ${user.username || "Trader"}\n` +
        `🏅 Rank: *${config.RANK_NAMES[user.rank]}* (${user.rank}/7)\n` +
        `💰 Fee Rate: *${fee}%*\n` +
        `📈 Volume: ${(user.cumulative_volume_sol || 0).toFixed(4)} SOL\n` +
        `📉 To Next Rank: ${needed} SOL\n` +
        `🔄 Total Trades: ${trades.length}\n` +
        `📂 Open Positions: ${positions.length}\n` +
        `🧪 Trial Active: ${user.trial_active ? "Yes" : "No"}`,
      { parse_mode: "Markdown" },
    );
  });

  bot.command("admin", async (ctx) => {
    const config = require("../../config");
    if (!config.ADMIN_IDS.includes(String(ctx.from.id))) return;
    const { showAdminPanel } = require("./admin");
    await showAdminPanel(ctx);
  });

  // ── CALLBACK HANDLER ──

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    const user = db.getUser(userId);

    // Kill-switch check for trade actions
    if (
      (data.startsWith("trade_") || data.startsWith("devnet_mock")) &&
      killSwitch.isActive()
    ) {
      await ctx.answerCallbackQuery(
        t("killswitch.active", user?.language || "en"),
      );
      return;
    }

    try {
      // ── MENU NAVIGATION ──
      if (data === "menu_main") {
        const fresh = db.getUser(userId);
        try {
          await ctx.editMessageText("🦅 *HawkX* [DEVNET]", {
            parse_mode: "Markdown",
            reply_markup: buildMainMenu(fresh),
          });
        } catch {
          await ctx.reply("🦅 *HawkX* [DEVNET]", {
            parse_mode: "Markdown",
            reply_markup: buildMainMenu(fresh),
          });
        }
      } else if (data === "menu_trade") {
        await safeEdit(ctx, "⚡ *Trade Menu* [DEVNET]", buildTradeMenu(user));
      } else if (data === "menu_modules") {
        await safeEdit(
          ctx,
          "📦 *Modules* — All features at all ranks:",
          buildModulesMenu(),
        );
      } else if (data === "menu_settings") {
        await require("./settings").showSettings(ctx, user);
      } else if (data === "menu_portfolio") {
        const { getPortfolio } = require("./portfolio");
        await getPortfolio(ctx, user);
      } else if (data === "menu_wallets") {
      await ctx.answerCallbackQuery();
      const user = db.getUser(userId);
      const wallets = db.getWallets(userId)|| [];
      const activeWallet = wallets.find(w => w.wallet_id === user.active_wallet_id) || wallets[0];
      const address = activeWallet ? (activeWallet.address || activeWallet.public_key) : "No wallet found.";
        
      // TODO: CHANGE THIS TO REAL BLOCKCHAIN BALANCE FOR MAINNET
      const savedMock = db.getSysConfig(`mock_balance_${address}`);
      const balance = savedMock ? parseFloat(savedMock) : 0;
      const menuText = `💼 *Wallet Management*\n\n💳 *Active Wallet:*\n\`${address}\`\n\n💰 *Balance:*         ${parseFloat(balance).toFixed(2)} SOL (Devnet)\n\n💡 _Tap your address above to copy it._`;

      
      const { buildWalletMenu } = require("./keyboards");
      return ctx.editMessageText(menuText, { 
        parse_mode: "Markdown", 
        reply_markup: buildWalletMenu(wallets, user.active_wallet_id)
      }).catch(() => {});
      } else if (data === "menu_referrals") {
        const stats = getReferralStats(userId);
        await ctx.reply(
          `👥 *Referrals*\n\n🔗 \`${stats.referralLink}\`\nPending: ${stats.pending.toFixed(4)} SOL`,
          { parse_mode: "Markdown" },
        );

        // ── WALLET ACTIONS ──
      } else if (data === "wallet_generate") {
        const { addWallet } = require("./walletVault");
        await addWallet(ctx, user, "generate");
      } else if (data === "wallet_import") {
        await ctx.reply("📥 Send your Solana privet key:");
        db.setSysConfig(`pending_${userId}`, "wallet_import");
      
          // 1. Update the database with the new active wallet
    } else if (data.startsWith("wallet_select_")) {
        const walletId = parseInt(data.replace("wallet_select_", ""));

        // Stop if the wallet is already active
        if (user.active_wallet_id === walletId) {
            return ctx.answerCallbackQuery("✅ This wallet is already active!");
        }

    // Update DB
    db.updateUser(userId, { active_wallet_id: walletId });
  
  // Force Fresh Data
  const freshUser = db.getUser(userId);
  const wallets = db.getWallets(userId) || [];
  
  // Stop the loading spinner
  await ctx.answerCallbackQuery("✅ Active wallet updated!");
  
  // Refresh the menu with the dot moved
    // 1. Find the newly selected wallet's address
  const activeWallet = wallets.find(w => w.wallet_id === freshUser.active_wallet_id) || wallets[0];
  const address = activeWallet ? (activeWallet.address || activeWallet.public_key) : "No wallet found.";
        
  // TODO: CHANGE THIS TO REAL BLOCKCHAIN BALANCE FOR MAINNET
  const savedMock = db.getSysConfig(`mock_balance_${address}`);
  const balance = savedMock ? parseFloat(savedMock) : 0;

// 2. Build the big message board again
const menuText = `💼 *Wallet Management*\n\n💳 *Active Wallet:*\n\`${address}\`\n\n💰 *Balance:* ${parseFloat(balance).toFixed(2)} SOL (Devnet)\n\n💡 _Tap your address above to copy it._`;

  // 3. Refresh the screen with the new board and moved dot
  await safeEdit(ctx, menuText, buildWalletMenu(wallets, freshUser.active_wallet_id));


        // ── SETTINGS ──
      } else if (data.startsWith("set_")) {
        await handleSettingCallback(ctx, user, data);
          } else if (data.startsWith("lang_")) {
        const newLang = data.replace("lang_", "");
        db.updateUser(userId, { language: newLang });
        await ctx.answerCallbackQuery("Language updated!");
        await handleStart(ctx); // This forces the bot to instantly send a fresh menu!

    // 👇 ADD THIS NEW BLOCK HERE 👇
    } else if (data.startsWith("wallet_export_prompt_")) {
      const walletId = data.split("_")[3];
      db.setSysConfig(`pending_${userId}`, `export_auth_${walletId}`);
      return ctx.reply(t("wallet.export.prompt", user.language), { parse_mode: "Markdown" });
    // 👆 END NEW BLOCK 👆

    // -- DEVNET TEST BUTTONS --
    } else if (data === "devnet_faucet") {
      const { handleFaucet } = require("./faucet");
      await handleFaucet(ctx, user);
        await ctx.answerCallbackQuery(`Language updated!`);

        // ── DEVNET TEST BUTTONS ──
      } else if (data === "devnet_faucet") {
        const { handleFaucet } = require("./faucet");
        await handleFaucet(ctx, user);
      } else if (data === "devnet_mock_buy") {
        const { mockBuy } = require("./executor");
        const ca = "DEVNET_TOKEN_" + Date.now();
        await mockBuy(ctx, user, ca, 0.1);
      } else if (data === "devnet_mock_sell") {
        const positions = db.getOpenPositions(userId);
        if (!positions.length) {
          await ctx.answerCallbackQuery("No open positions.");
          return;
        }
        const { mockSell } = require("./executor");
        await mockSell(ctx, user, positions[0]);
      } else if (data === "devnet_add_volume") {
        db.addVolume(userId, 1);
        checkAndPromote(userId, require("./notifications").notify);
        const updated = db.getUser(userId);
        await ctx.answerCallbackQuery(
          `+1 SOL volume. Total: ${updated.cumulative_volume_sol.toFixed(2)} SOL`,
        );
      } else if (data === "devnet_sim_price") {
        await ctx.answerCallbackQuery("Price simulation — check /portfolio");
      } else if (data === "trade_quickbuy") {
        await ctx.reply("🔍 Paste a Solana CA (or any string in devnet):");
        db.setSysConfig(`pending_${userId}`, "quickbuy_ca");
      } else if (data === "coming_soon") {
        await ctx.answerCallbackQuery("Coming in NEXT release!");
      } else if (data === "noop") {
        await ctx.answerCallbackQuery();

        // ── ADMIN ──
      } else if (data.startsWith("admin_")) {
        const { handleAdminCallback } = require("./admin");
        await handleAdminCallback(ctx, data);
      } else {
        await ctx.answerCallbackQuery("Coming soon!");
      }

      await ctx.answerCallbackQuery();
    } catch (e) {
      console.error("[Router CB]", e.message);
      try {
        await ctx.answerCallbackQuery("Error!");
      } catch {}
    }
  });

  // ── TEXT MESSAGE HANDLER ──
  bot.on("message:text", async (ctx) => {
    const userId = ctx.from.id;
    let user = db.getUser(userId);
    if (!user) {
      await handleStart(ctx);
      return;
    }

    const pending = db.getSysConfig(`pending_${userId}`) || "";

    if (pending === "quickbuy_ca") {
      db.setSysConfig(`pending_${userId}`, "");
      if (killSwitch.isActive())
        return ctx.reply(t("killswitch.active", user.language));
      const { mockBuy } = require("./executor");
      await mockBuy(ctx, user, ctx.message.text.trim(), 0.1);
    } else if (pending === "wallet_import") {
      db.setSysConfig(`pending_${userId}`, "");
      const { addWallet } = require("./walletVault");
      await addWallet(ctx, user, ctx.message.text.trim());
    } else if (pending.startsWith("set_")) {
      await handleTextInput(ctx, user, pending);
        } else if (pending.startsWith("export_auth_")) {
      const walletId = pending.split("_")[2];
      const inputPassword = ctx.message.text.trim();
      
      if (inputPassword === process.env.AES_MASTER_SECRET) {
        const wallet = db.getWalletById(walletId);
        const { decrypt } = require("./walletVault");
        const decryptedKey = decrypt(wallet.private_key); 
        
        const msg = await ctx.reply(t("wallet.export.success", user.language, { key: decryptedKey }), { parse_mode: "Markdown" });
        setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {}), 60000);
      } else {
        await ctx.reply(t("wallet.export.invalid", user.language));
      }
      db.setSysConfig(`pending_${userId}`, "");
      } else {
      // Check if it looks like a CA
      const { extractCAs } = require("./caExtractor");
      const cas = extractCAs(ctx.message.text.trim());
      if (cas.length > 0 && !killSwitch.isActive()) {
        const { mockBuy } = require("./executor");
        await mockBuy(ctx, user, cas[0], 0.1);
      } else {
        await ctx.reply(
          "👋 Send a command or paste a CA to trade.\n\nType /help for all commands.",
          { reply_markup: buildMainMenu(user) },
        );
      }
    }
  });
}

async function safeEdit(ctx, text, kb) {
  try {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: kb,
    });
  } catch {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: kb });
  }
}

async function ensureUser(ctx) {
  const user = db.getUser(ctx.from.id);
  if (!user) {
    await handleStart(ctx);
    return null;
  }
  return user;
}
module.exports = { setupRouter };
