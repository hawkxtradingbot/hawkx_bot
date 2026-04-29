// M05 — Keyboards V12 Final
// Classic clean design — 3 small buttons per row, 2 medium, 1 full width
// All buttons working — guide text on every screen

const { InlineKeyboard } = require("grammy");
const config = require("../../config");

const RANKS = {
  1: { name: "Degen",      fee: 1.00, nextSol: 0.1  },
  2: { name: "Flipper",    fee: 0.85, nextSol: 0.5  },
  3: { name: "Trader",     fee: 0.80, nextSol: 1    },
  4: { name: "Sniper",     fee: 0.75, nextSol: 2    },
  5: { name: "Whale",      fee: 0.70, nextSol: 5    },
  6: { name: "Shark",      fee: 0.60, nextSol: 10   },
  7: { name: "Hawk Elite", fee: 0.50, nextSol: null },
};

function getFeeDisplay(user) {
  if (!user) return "🦅 1.00% — Degen RANK";
  const r = RANKS[user.rank] || RANKS[1];
  return `🦅 ${r.fee.toFixed(2)}% — ${r.name} RANK`;
}

function buildQuickStats(s) {
  if (!s) return "📊 No trades yet";
  const sign = (s.pnl || 0) >= 0 ? "+" : "";
  return `📊 ${sign}${(s.pnl||0).toFixed(3)} SOL · ${s.trades||0} trades · ${s.winRate||0}% win`;
}

function getModeLabel(user) {
  return (user && user.mode === "pro") ? "⚡ Pro" : "🌱 Beginner";
}

function buildRankInfoMessage(user) {
  const vol     = Math.max(0, user?.cumulative_volume_sol || 0);
  const curRank = user?.rank || 1;
  let msg = "🦅 *HawkX Rank & Fee System*\n\n";
  msg += "_Trade more volume → rank up → pay less fee_\n\n";
  for (let r = 1; r <= 7; r++) {
    const info   = RANKS[r];
    const active = curRank === r ? " ◀ *YOU*" : "";
    const volReq = r === 1 ? "0 SOL" : `${info.nextSol} SOL devnet`;
    msg += `${active ? "▶" : "  "} *${info.name}* — ${info.fee.toFixed(2)}% fee${active}\n`;
    msg += `   Volume needed: ${volReq}\n`;
  }
  msg += `\n📈 Your volume: *${vol.toFixed(4)} SOL*`;
  if (curRank < 7) {
    const needed = Math.max(0, (RANKS[curRank].nextSol || 0) - vol).toFixed(4);
    msg += `\n📉 Next rank in: *${needed} SOL*`;
  }
  return msg;
}

// ════════════════════════════════════════════════════════════
// MAIN MENU
// ════════════════════════════════════════════════════════════
function buildMainMenu(user, todayStats, killSwitchActive) {
  const isProMode = user && user.mode === "pro";
  const kb        = new InlineKeyboard();

  if (killSwitchActive) {
    kb.text("🔴 Trading Paused — Admin Notice", "noop").row();
  }

  // Fee + stats — always show on both modes
  kb.text(getFeeDisplay(user), "menu_rank_info").row();
  if (todayStats) kb.text(buildQuickStats(todayStats), "menu_stats").row();

  if (isProMode) {
    kb.text(" BUY 🟢", "trade_quickbuy")
    .text("🔴 SELL ", "trade_positions")
    .row();
    kb.text("📂 Positions",    "menu_portfolio")
      .text("💰 Referrals",    "menu_referrals")
      .row();
    kb.text("🎯 Sniper",      "menu_sniper")
      .text("👥 Copy Trade",  "menu_copy_trade")
      .row();
    kb.text("📋 Limit Orders","menu_limit_orders")
      .text("⭐ Watchlist",   "menu_watchlist")
      .row();
    kb.text("💼 Wallets",     "menu_wallets")
      .text("⚙️ Settings",   "menu_settings")
      .row();
    kb.text("❓ Help",          "menu_help")
      .text("🔄 Refresh",       "menu_main_refresh")
      .row();
    kb.text("🚰 Faucet",        "devnet_faucet").row();
    kb.text("🌱 Beginner Mode →","mode_set_beginner").row();
  } else {
    kb.text(" BUY 🟢", "trade_quickbuy")
    .text("🔴 SELL ", "trade_positions")
    .row();
    kb.text("📂 Positions", "menu_portfolio")
      .text("💼 Wallets",   "menu_wallets")
      .row();
    kb.text("💰 Referrals", "menu_referrals")
      .text("⚙️ Settings",  "menu_settings")
      .row();
    kb.text("❓ Help",       "menu_help")
      .text("🔄 Refresh",   "menu_main_refresh")
      .row();
    kb.text("🚰 Get Test SOL","devnet_faucet").row();
    kb.text("⚡ Pro Mode →",  "mode_set_pro").row();
  }
  return kb;
}

// ════════════════════════════════════════════════════════════
// SETTINGS — BEGINNER
// ════════════════════════════════════════════════════════════
function buildBeginnerSettingsMenu(user) {
  const s  = user?.settings || {};
  const kb = new InlineKeyboard();

  // Buy amounts — 3 per row
  kb.text(`🟢 ${s.buy_amt_1||0.1} SOL`, "bset_buy1")
    .text(`🟢 ${s.buy_amt_2||0.5} SOL`, "bset_buy2")
    .text(`🟢 ${s.buy_amt_3||1.0} SOL`, "bset_buy3")
    .row();

  // Sell amounts — 3 per row
  kb.text(`🔴 ${s.sell_pct_1||25}%`,  "bset_sell1")
    .text(`🔴 ${s.sell_pct_2||50}%`,  "bset_sell2")
    .text("🔴 Initial",               "bset_sell_info")
    .row();

  // Slippage — 2 per row
  kb.text(`📉 Buy: ${s.slippage_pct||10}%`,      "set_slippage")
    .text(`📉 Sell: ${s.sell_slippage_pct||10}%`, "set_sell_slippage")
    .row();

  // Trade speed — 3 per row
  const spd = s.speed_mode || "standard";
  kb.text(spd==="fast"   ? "✅ Fast 🐎"   : "Fast 🐎",   "bset_speed_fast")
    .text(spd==="turbo"  ? "✅ Turbo 🚀"  : "Turbo 🚀",  "bset_speed_turbo")
    .text(spd==="custom" ? "✅ Custom ✏️" : "Custom ✏️", "bset_speed_custom")
    .row();

  kb.text("👁 Show/Hide Tokens",                   "bset_show_hide").row();
  kb.text(user?.sap_enabled ? "🔐 Change PIN" : "🔐 Set Security PIN", "set_sap").row();
  kb.text("💼 Wallets",    "menu_wallets")
    .text("🌐 Language",   "set_language")
    .row();
  kb.text("⚡ Pro Mode →", "mode_set_pro").row();
  kb.text("← Back",    "menu_main")
    .text("🔄 Refresh", "menu_settings")
    .row();
  return kb;
}

// ════════════════════════════════════════════════════════════
// SETTINGS — PRO (category menu)
// ════════════════════════════════════════════════════════════
function buildProSettingsMenu() {
  const kb = new InlineKeyboard();
  kb.text("⚡ Execution", "pset_execution")
    .text("🛡 MEV",       "pset_mev")
    .row();
  kb.text("🔒 Risk",      "pset_risk")
    .text("🔔 Alerts",    "pset_alerts")
    .row();
  kb.text("🔐 PIN",       "set_sap")
    .text("⏱ Session",   "set_session")
    .text("🌐 Language",  "set_language")
    .row();
  kb.text(`📊 Weekly PnL: ${true?"✅":"◻️"}`, "set_weekly").row();
  kb.text("🧪 +1 SOL Vol",      "devnet_add_volume").row();
  kb.text("🌱 Beginner Mode →", "mode_set_beginner").row();
  kb.text("← Back",    "menu_main")
    .text("🔄 Refresh", "menu_settings")
    .row();
  return kb;
}

function buildExecutionSettingsMenu(s) {
  const kb = new InlineKeyboard();
  kb.text(`B1:${s?.buy_amt_1||0.1}`, "pset_b1")
    .text(`B2:${s?.buy_amt_2||0.5}`, "pset_b2")
    .text(`B3:${s?.buy_amt_3||1.0}`, "pset_b3")
    .row();
  kb.text(`S1:${s?.sell_pct_1||25}%`, "pset_s1")
    .text(`S2:${s?.sell_pct_2||50}%`, "pset_s2")
    .text(`S3:${s?.sell_pct_3||100}%`,"pset_s3")
    .row();
  kb.text(s?.confirm_trades ? "✅ Confirm Trades" : "◻️ Confirm Trades", "pset_confirm").row();
  kb.text(`Buy Slip:${s?.slippage_pct||10}%`,      "set_slippage")
    .text(`Sell Slip:${s?.sell_slippage_pct||10}%`, "set_sell_slippage")
    .row();
  const spd = s?.speed_mode || "standard";
  kb.text(spd==="fast"  ? "✅ Fast 🐎"  : "Fast 🐎",  "bset_speed_fast")
    .text(spd==="turbo" ? "✅ Turbo 🚀" : "Turbo 🚀", "bset_speed_turbo")
    .row();
  kb.text(`Jito Tip: ${s?.jito_tip||0.0075} SOL`, "pset_jito").row();
  kb.text("← Back", "menu_settings").row();
  return kb;
}

function buildMevSettingsMenu(s) {
  const kb  = new InlineKeyboard();
  const mev = s?.mev_protect ?? 1;
  kb.text(mev ? "✅ MEV Protection" : "◻️ MEV Protection", "set_mev").row();
  kb.text("✅ Jito Bundle", "noop").text("✅ Anti-Sandwich", "noop").row();
  kb.text("✅ Frontrun Guard", "noop").text("✅ Sim Check", "noop").row();
  kb.text("← Back", "menu_settings").row();
  return kb;
}

function buildRiskSettingsMenu(s) {
  const kb = new InlineKeyboard();
  const sl = s?.stop_loss_pct   || 0;
  const tp = s?.take_profit_pct || 0;
  kb.text(`🛑 SL: ${sl===0?"OFF":sl+"%"}`, "set_stoploss")
    .text(`🎯 TP: ${tp===0?"OFF":tp+"%"}`, "set_takeprofit")
    .row();
  kb.text(`Max Trade:${s?.max_buy_sol||0}SOL`,    "set_maxbuy")
    .text(`Daily Loss:${s?.daily_loss_limit||0}`, "pset_daily_loss")
    .row();
  kb.text(`Max Pos:${s?.max_open_positions||10}`, "pset_max_pos")
    .text(`Daily Trades:${s?.daily_trade_limit||0}`,"pset_daily_trades")
    .row();
  kb.text("✅ Rug Protection", "noop").text("✅ Honeypot Check", "noop").row();
  kb.text("← Back", "menu_settings").row();
  return kb;
}

function buildAlertsSettingsMenu() {
  const kb = new InlineKeyboard();
  kb.text("➕ Price Alert",    "alert_add_price")
    .text("➕ Wallet Tracker", "alert_add_wallet")
    .row();
  kb.text("✅ New Position Alert", "noop").text("✅ TP/SL Alert", "noop").row();
  kb.text("✅ Daily PnL Report",   "set_weekly").row();
  kb.text("← Back", "menu_settings").row();
  return kb;
}

// ════════════════════════════════════════════════════════════
// WALLET MENU
// ════════════════════════════════════════════════════════════
function buildWalletMenu(wallets, activeWalletId) {
  const kb = new InlineKeyboard();
  if (!Array.isArray(wallets)) wallets = [];

  // Wallets as W1, W2, W3 style — 5 per row
  for (let i = 0; i < wallets.length; i += 5) {
    wallets.slice(i, i + 5).forEach((w, idx) => {
      const num    = i + idx + 1;
      const active = w.wallet_id === activeWalletId;
      kb.text(active ? `W${num} ✅` : `W${num}`, `wallet_select_${w.wallet_id}`);
    });
    kb.row();
  }

  if (wallets.length > 0) kb.text("🗑 Delete Wallet", "wallet_delete_select").row();

  kb.text(" Deposit 🟢",  "wallet_deposit")
    .text("🔴 Withdraw ", "wallet_withdraw")
    .row();
  kb.text("📥 Import Key",  "wallet_import")
    .text("🔑 Export Key",  "wallet_export_select")
    .row();
  kb.text("➕ New Wallet",  "wallet_generate")
    .text("🚰 Airdrop SOL", "devnet_faucet")
    .row();
  kb.text("← Back",    "menu_main")
    .text("🔄 Refresh", "menu_wallets")
    .row();
  return kb;
}

function buildWalletDeleteSelect(wallets, activeWalletId) {
  const kb = new InlineKeyboard();
  // Side by side — 3 per row
  for (let i = 0; i < wallets.length; i += 3) {
    wallets.slice(i, i + 3).forEach((w, idx) => {
      const num    = i + idx + 1;
      const active = w.wallet_id === activeWalletId ? " ✅" : "";
      kb.text(`W${num}${active}`, `wallet_delete_confirm_${w.wallet_id}`);
    });
    kb.row();
  }
  kb.text("← Cancel", "menu_wallets").row();
  return kb;
}

function buildWalletExportSelect(wallets) {
  const kb = new InlineKeyboard();
  for (let i = 0; i < wallets.length; i += 4) {
    wallets.slice(i, i + 4).forEach((w, idx) => {
      const label = (i + idx) < 4 ? w.label : `W${i + idx + 1}`;
      kb.text(label, `wallet_export_prompt_${w.wallet_id}`);
    });
    kb.row();
  }
  kb.text("← Cancel", "menu_wallets").row();
  return kb;
}

// ════════════════════════════════════════════════════════════
// COPY TRADE
// ════════════════════════════════════════════════════════════
function buildCopyTradeMenu() {
  const kb = new InlineKeyboard();
  kb.text("💼 Copy Wallet", "copy_wallet_menu")
    .text("📡 Copy Channel","copy_channel_menu")
    .row();
  kb.text("← Back",    "menu_main")
    .text("🔄 Refresh", "menu_copy_trade")
    .row();
  return kb;
}

function buildCopyWalletListMenu(copyWallets) {
  const kb    = new InlineKeyboard();
  const count = copyWallets?.length || 0;
  if (count === 0) { kb.text("No copy wallets yet", "noop").row(); }
  else {
    copyWallets.forEach((cw) => {
      kb.text(`${cw.active?"🟢":"⏸"} ${cw.label}`, `copy_wallet_view_${cw.id}`)
        .text("🗑", `copy_wallet_delete_${cw.id}`)
        .row();
    });
  }
  if (count < 5) kb.text(`➕ Add Copy Wallet (${count}/5)`, "copy_wallet_add").row();
  else kb.text("Max 5 — delete one to add", "noop").row();
  kb.text("⏸ Pause All", "copy_wallet_pause_all").row();
  kb.text("← Back",    "menu_copy_trade")
    .text("🔄 Refresh", "copy_wallet_menu")
    .row();
  return kb;
}

function buildCopyChannelListMenu(copyChannels) {
  const kb = new InlineKeyboard();
  if (!copyChannels?.length) { kb.text("No copy channels yet", "noop").row(); }
  else {
    copyChannels.forEach((cc) => {
      kb.text(`${cc.status==="active"?"🟢":"⏸"} ${cc.channel_name||cc.channel_id}`, `copy_channel_view_${cc.id}`)
        .text("🗑", `copy_channel_delete_${cc.id}`)
        .row();
    });
  }
  kb.text("➕ Add Copy Channel", "copy_channel_add").row();
  kb.text("⏸ Pause All",        "copy_channel_pause_all").row();
  kb.text("← Back",    "menu_copy_trade")
    .text("🔄 Refresh", "copy_channel_menu")
    .row();
  return kb;
}

function buildCopyChannelSettingsMenu(ch) {
  const kb = new InlineKeyboard();
  kb.text(`💰 ${ch.buy_amount||0.1} SOL`, `cch_buy_${ch.id}`)
    .text(`📉 ${ch.slippage||50}%`,        `cch_slip_${ch.id}`)
    .text(`⛽ ${ch.tip||0.0075} tip`,      `cch_tip_${ch.id}`)
    .row();
  kb.text(ch.mev_protection       ? "✅ MEV"       : "◻️ MEV",       `cch_mev_${ch.id}`)
    .text(ch.auto_sell_enabled     ? "✅ Auto Sell" : "◻️ Auto Sell", `cch_autosell_${ch.id}`)
    .row();
  if (ch.auto_sell_enabled) {
    const sl = ch.stop_loss_pct   || 0;
    const tp = ch.take_profit_pct || 0;
    kb.text(`🛑 SL:${sl===0?"OFF":sl+"%"}`, `cch_sl_${ch.id}`)
      .text(`🎯 TP:${tp===0?"OFF":tp+"%"}`, `cch_tp_${ch.id}`)
      .row();
  }
  kb.text(ch.mint_auth_revoked   ? "✅ Mint Rev"   : "◻️ Mint Rev",   `cch_mint_${ch.id}`)
    .text(ch.freeze_auth_revoked ? "✅ Freeze Rev" : "◻️ Freeze Rev", `cch_freeze_${ch.id}`)
    .row();
  kb.text(`Max/Signal:${ch.max_buys_per_signal||1}`, `cch_maxbuys_${ch.id}`).row();
  kb.text("✅ Activate Channel", `copy_channel_activate_${ch.id}`).row();
  kb.text("← Back", "copy_channel_menu").row();
  return kb;
}

// ════════════════════════════════════════════════════════════
// SNIPER
// ════════════════════════════════════════════════════════════
function buildSniperMainMenu() {
  const kb = new InlineKeyboard();
  kb.text("🎯 Auto Sniper",      "sniper_auto_menu")
    .text("🔀 Migration Sniper", "sniper_migration_menu")
    .row();
  kb.text("← Back",    "menu_main")
    .text("🔄 Refresh", "menu_sniper")
    .row();
  return kb;
}

function buildAutoSniperMenu(configs) {
  const kb = new InlineKeyboard();
  if (!configs?.length) { kb.text("No setups yet", "noop").row(); }
  else {
    configs.forEach((c) => {
      kb.text(`${c.active?"🟢":"⏸"} ${c.label}`, `sniper_config_view_${c.id}`)
        .text("🗑", `sniper_config_delete_${c.id}`)
        .row();
    });
  }
  kb.text("➕ Create Setup", "sniper_config_new").row();
  kb.text("⏸ Pause All",    "sniper_pause_all").row();
  kb.text("← Back",    "menu_sniper")
    .text("🔄 Refresh", "sniper_auto_menu")
    .row();
  return kb;
}

function buildSniperConfigMenu(cfg) {
  const kb = new InlineKeyboard();
  kb.text(`💰 ${cfg.snipe_amount||0.1}SOL`, `scfg_amt_${cfg.id}`)
    .text(`📉 ${cfg.snipe_slippage||50}%`,   `scfg_slip_${cfg.id}`)
    .text(`⛽ ${cfg.snipe_fee||0.003}SOL`,   `scfg_fee_${cfg.id}`)
    .row();
  kb.text(`🎯 Tip:${cfg.snipe_tip||0.0075}`, `scfg_tip_${cfg.id}`)
    .text(cfg.mev_protection ? "✅ MEV" : "◻️ MEV", `scfg_mev_${cfg.id}`)
    .text(cfg.auto_sell ? "✅ AutoSell" : "◻️ AutoSell", `scfg_as_${cfg.id}`)
    .row();
  kb.text(cfg.platform_raydium  ? "✅ Raydium"  : "◻️ Raydium",  `scfg_ray_${cfg.id}`)
    .text(cfg.platform_pumpfun  ? "✅ Pumpfun"  : "◻️ Pumpfun",  `scfg_pump_${cfg.id}`)
    .text(cfg.platform_moonshot ? "✅ Moonshot" : "◻️ Moonshot", `scfg_moon_${cfg.id}`)
    .row();
  kb.text(cfg.use_lightning_rpc ? "✅ ⚡ Lightning RPC" : "◻️ ⚡ Lightning RPC", `scfg_rpc_${cfg.id}`).row();
  kb.text(`Max Snipes: ${cfg.max_snipes||5}`, `scfg_max_${cfg.id}`).row();
  kb.text("✅ Save & Activate", `sniper_config_save_${cfg.id}`).row();
  kb.text("← Back", "sniper_auto_menu").row();
  return kb;
}

function buildMigrationSniperMenu(snipes) {
  const kb = new InlineKeyboard();
  if (!snipes?.length) { kb.text("No active snipes", "noop").row(); }
  else {
    snipes.forEach((s) => {
      kb.text(`🟢 ${s.token_ca?.slice(0,8)||"Any"}... ${s.sol_amount}SOL`, `snipe_view_${s.id}`)
        .text("✖", `snipe_cancel_${s.id}`)
        .row();
    });
  }
  kb.text("+ New Snipe", "sniper_migration_new").row();
  kb.text("⏸ Pause All", "sniper_pause_all").row();
  kb.text("← Back",    "menu_sniper")
    .text("🔄 Refresh", "sniper_migration_menu")
    .row();
  return kb;
}

// ════════════════════════════════════════════════════════════
// LIMIT ORDERS
// ════════════════════════════════════════════════════════════
function buildLimitOrdersMenu(orders) {
  const kb = new InlineKeyboard();
  if (!orders?.length) {
    kb.text("No active limit orders", "noop").row();
    kb.text("Tap a token in Positions to add a limit order", "noop").row();
  } else {
    orders.forEach((o) => {
      const type = o.order_type === "buy" ? "🟢 BUY" : "🔴 SELL";
      kb.text(`${type} ${(o.token_name||o.token_ca.slice(0,6)).slice(0,8)}`, `limit_view_${o.id}`)
        .text("✖", `limit_cancel_${o.id}`)
        .row();
    });
  }
  kb.text("← Back",    "menu_main")
    .text("🔄 Refresh", "menu_limit_orders")
    .row();
  return kb;
}

function buildLimitOrderSetupMenu(pos, hasBuy, hasSell) {
  const kb  = new InlineKeyboard();
  const pid = pos?.position_id;
  kb.text(hasBuy  ? "✅ Buy Order"  : "◻️ Buy Order",  `limit_toggle_buy_${pid}`)
    .text(hasSell ? "✅ Sell Order" : "◻️ Sell Order", `limit_toggle_sell_${pid}`)
    .row();
  if (hasBuy) {
    kb.text("💰 Buy Amount ✏️",  `limit_buy_amt_${pid}`)
      .text("📍 Buy Price ✏️",   `limit_buy_price_${pid}`)
      .row();
  }
  if (hasSell) {
    kb.text("🔴 Sell 1 % ✏️",   `limit_sell1_pct_${pid}`)
      .text("📍 Sell 1 Price ✏️",`limit_sell1_price_${pid}`)
      .row();
    kb.text("🔴 Sell 2 % ✏️",   `limit_sell2_pct_${pid}`)
      .text("📍 Sell 2 Price ✏️",`limit_sell2_price_${pid}`)
      .row();
  }
  kb.text("← Back",    "menu_limit_orders")
    .text("🔄 Refresh", `limit_token_${pid}`)
    .row();
  return kb;
}

// ════════════════════════════════════════════════════════════
// WATCHLIST
// ════════════════════════════════════════════════════════════
function buildWatchlistMenu(items) {
  const kb = new InlineKeyboard();
  if (!items?.length) { kb.text("No tokens in watchlist yet", "noop").row(); }
  else {
    items.forEach((item) => {
      const name = (item.token_name || item.token_ca.slice(0, 8) + "...").slice(0,12);
      kb.text(`⭐ ${name}`, `watchlist_view_${item.id}`)
        .text("🗑", `watchlist_remove_${item.id}`)
        .row();
    });
  }
  kb.text("➕ Add Token", "watchlist_add").row();
  kb.text("← Back",    "menu_main")
    .text("🔄 Refresh", "menu_watchlist")
    .row();
  return kb;
}

// ════════════════════════════════════════════════════════════
// RANK UP BANNER
// ════════════════════════════════════════════════════════════
function buildRankUpBanner(user, rankName, fee) {
  const tags = {
    2:"First flips logged. 🦅", 3:"Real trader energy. 🦅",
    4:"Precision over instinct. 🦅", 5:"Whale mode activated. 🦅",
    6:"Shark in the water. 🦅", 7:"The Hawk never misses. 🦅",
  };
  return (
    `🦅 *RANK UP!* [DEVNET]\n\n` +
    `👤 ${user.username||"Trader"}\n` +
    `🏅 Rank: *${rankName}* (${user.rank}/7)\n` +
    `📈 Volume: *${(user.cumulative_volume_sol||0).toFixed(2)} SOL*\n` +
    `💎 New Fee: *${fee}%*\n\n` +
    `_${tags[user.rank]||"Keep climbing."}_\n\n` +
    `👥 Refer & earn 30%:\n` +
    `🔗 t.me/YourBot?start=REF_${user.user_id}`
  );
}

const GUIDES = {
  main_beginner: "🌱 *Beginner Mode* — Tap Positions to view tokens. Settings to customise.",
  main_pro:      "⚡ *Pro Mode* — Full access. Tap any feature to start.",
  positions:     "📂 Filter by All / Manual / Channel / Copy Wallet. Tap token name to manage.",
  wallets:       "💼 Tap wallet to switch. Deposit · Withdraw · Import · Export all here.",
  settings_beg:  "⚙️ Set buy/sell amounts, slippage, trade speed and security PIN.",
  settings_pro:  "⚙️ Choose a category to configure your trading settings.",
  copy_trade:    "👥 Copy Wallet = follows a trader. Copy Channel = buys signals from Telegram.",
  copy_wallet:   "💼 When followed wallet buys, you auto-buy. Max 5 wallets.",
  copy_channel:  "📡 When CA posted in channel, bot auto-buys with your settings.",
  sniper:        "🎯 Auto Sniper catches new launches. Migration Sniper targets PumpFun→Raydium.",
  limit_orders:  "📋 Set price targets. Bot auto-buys or sells when price is reached.",
  referrals:     "💰 Share your link. Earn % of every trade your referrals make forever.",
};

function getGuide(screen) { return GUIDES[screen] || ""; }

module.exports = {
  buildMainMenu, buildBeginnerSettingsMenu, buildProSettingsMenu,
  buildExecutionSettingsMenu, buildMevSettingsMenu, buildRiskSettingsMenu,
  buildAlertsSettingsMenu, buildWalletMenu, buildWalletDeleteSelect,
  buildWalletExportSelect, buildCopyTradeMenu, buildCopyWalletListMenu,
  buildCopyChannelListMenu, buildCopyChannelSettingsMenu,
  buildSniperMainMenu, buildAutoSniperMenu, buildSniperConfigMenu,
  buildMigrationSniperMenu, buildLimitOrdersMenu,      buildLimitOrderSetupMenu,
  buildWatchlistMenu, buildRankUpBanner, buildRankInfoMessage,
  buildQuickStats, getModeLabel, getFeeDisplay, getGuide, RANKS,
};
