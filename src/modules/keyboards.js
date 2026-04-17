// M05 — Keyboards (Devnet version with faucet button)
const { InlineKeyboard } = require("grammy");
const { t } = require("./i18n");
const config = require("../../config");

function getFeeDisplay(user) {
  if (!user) return "💰 Fee: 1% | Scout";
  
  const now = Date.now();
  const joinedDate = new Date(user.created_at || now).getTime();
  const diffDays = (now - joinedDate) / (1000 * 60 * 60 * 24);

  // If trial is active (less than 7 days)
  if (diffDays <= 7) {
    return "✨ [7-DAY TRIAL ACTIVE] — 0.3% Fee";
  }

  // If trial is over, show regular fee
  const rank = user.rank || "Scout";
  const fee = user.fee_rate || "1.0";
  return `💰 Fee: ${fee}% | Rank: ${rank}`;
}

function buildMainMenu(user) {
    const { t } = require("./i18n");
    const lang = user.language || "en";
    
    const kb = new InlineKeyboard();
    kb.text(getFeeDisplay(user), "noop").row();
    
        // Clean version - No emojis in the callback_data (the second part)
    kb.text(t("menu.portfolio", lang), "menu_portfolio")
      .text(t("menu.trade", lang), "menu_trade")
      .row();
    kb.text(t("menu.settings", lang), "menu_settings")
      .text(t("menu.referrals", lang), "menu_referrals")
      .row();
    kb.text(t("menu.modules", lang), "menu_modules")
      .text(t("menu.wallets", lang), "menu_wallets")
      .row();
    kb.text(t("menu.faucet", lang), "devnet_faucet").row();
    kb.text(t("menu.test_trade", lang), "devnet_test_trade")
      .text(t("menu.sim_price", lang), "devnet_sim_price")
      .row();
    kb.text(t("menu.help", lang), "menu_help").row();
    return kb;
}

function buildTradeMenu(user) {
  const kb = new InlineKeyboard();
  kb.text("🔍 Quick Buy (Paste CA)", "trade_quickbuy").row();
  kb.text("📂 Open Positions", "trade_positions").row();
  kb.text("🧪 Mock Buy 0.1 SOL", "devnet_mock_buy").row();
  kb.text("🧪 Mock Sell Position", "devnet_mock_sell").row();
  kb.text("🔙 Back", "menu_main").row();
  return kb;
}

function buildModulesMenu() {
  const kb = new InlineKeyboard();
  kb.text("🎯 Sniper", "mod_sniper").text("📈 Strategy", "mod_strategy").row();
  kb.text("🛡 Safety", "mod_safety")
    .text("📊 Analytics", "mod_analytics")
    .row();
  kb.text("🦅 Hawk Elite", "mod_hawkelite").row();
  kb.text("🔙 Back", "menu_main").row();
  return kb;
}

function buildSettingsMenu(user) {
  const s = user ? user.settings : null;
  const kb = new InlineKeyboard();
  kb.text(
    "Slippage: " + (s ? s.slippage_pct : 10) + "% ✏️",
    "set_slippage",
  ).row();
  kb.text(
    "Max Buy: " + (s ? s.max_buy_sol : 0.1) + " SOL ✏️",
    "set_maxbuy",
  ).row();
  kb.text(
    "Speed: " + (s ? s.speed_mode : "standard") + " ✏️",
    "set_speed",
  ).row();
  kb.text(
    "Auto-Buy: " + (s && s.auto_buy ? "✅ ON" : "❌ OFF"),
    "set_autobuy",
  ).row();
  kb.text("Language 🌐", "set_language").row();
  kb.text("🧪 Simulate Volume (+1 SOL)", "devnet_add_volume").row();
  kb.text("🔙 Back", "menu_main").row();
  return kb;
}

function buildWalletMenu(wallets, activeWalletId) {
  const kb = new InlineKeyboard();
  if (!Array.isArray(wallets)) wallets = [];
  wallets.forEach((w) => {
    const short = w.public_key.slice(0, 4) + "..." + w.public_key.slice(-4);
    const marker = w.wallet_id === activeWalletId ? " ●" : "";
    kb.text(
      w.label + ": " + short + marker,
      "wallet_select_" + w.wallet_id,
    ).row();
  });
  kb.text("🆕 Generate Devnet Wallet", "wallet_generate").row();
  kb.text("📥 Import Private Key", "wallet_import").row();
  kb.text("🚰 Airdrop SOL to Active", "devnet_faucet").row();
  kb.text("🔑 Export Private Key", `wallet_export_prompt_${activeWalletId}`).row();
  kb.text("🔙 Back", "menu_main").row();
  return kb;
}

function buildRankUpBanner(user, rankName, fee) {
  const taglines = {
    2: "First kills logged.",
    3: "On the trail. Precision over instinct.",
    4: "Apex instincts activated.",
    5: "No prey escapes.",
    6: "Elite execution. Minimum cost.",
    7: "The Hawk never misses.",
  };
  return (
    "🦅 *RANK UP! [DEVNET]*\n\n" +
    "👤 " +
    (user.username || "Trader") +
    "\n" +
    "📊 New Rank: *" +
    rankName +
    "* (Rank " +
    user.rank +
    ")\n" +
    "📈 Volume: " +
    (user.cumulative_volume_sol || 0).toFixed(2) +
    " SOL\n" +
    "💰 New Fee Rate: *" +
    fee +
    "%*\n\n" +
    "_" +
    (taglines[user.rank] || "Keep climbing.") +
    "_\n\n" +
    "🔗 Invite: t.me/YourBot?start=REF_" +
    user.user_id
  );
}

module.exports = {
  buildMainMenu,
  buildTradeMenu,
  buildModulesMenu,
  buildSettingsMenu,
  buildWalletMenu,
  buildRankUpBanner,
};
