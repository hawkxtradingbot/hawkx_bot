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
  const rankIcons = { 1:"🥉", 2:"🥈", 3:"🥇", 4:"🏆", 5:"💎", 6:"🦅", 7:"👑" };
  let msg = "🦅 *Rank & Fee System*\n";
  msg += "_Trade more → rank up → pay less fee_\n\n";
  msg += "━━━━━━━━━━━━━━━━━━━\n";
  for (let r = 1; r <= 7; r++) {
    const info = RANKS[r];
    const icon = rankIcons[r];
    const isYou = curRank === r;
    const volReq = r === 1 ? "0 SOL" : `${info.nextSol} SOL`;
    if (isYou) {
      msg += `▶ ${icon} *${info.name}* — *${info.fee.toFixed(2)}%* ◀ YOU\n`;
    } else if (r < curRank) {
      msg += `  ${icon} ~~${info.name}~~ — ${info.fee.toFixed(2)}% ✅\n`;
    } else {
      msg += `  ${icon} ${info.name} — ${info.fee.toFixed(2)}% | ${volReq}\n`;
    }
  }
  msg += "━━━━━━━━━━━━━━━━━━━\n\n";
  // Progress bar
  const rank = RANKS[curRank];
  const nextSol = rank.nextSol || 0;
  const rankPct = nextSol > 0 ? Math.min(100, (vol / nextSol) * 100) : 100;
  const filled = Math.round((rankPct / 100) * 16);
  const bar = "█".repeat(filled) + "░".repeat(16 - filled);
  msg += `📊 Progress: ${bar} ${rankPct.toFixed(0)}%\n`;
  msg += `📈 Volume: *${vol.toFixed(4)} SOL*\n`;
  if (curRank < 7) {
    const nextRank = RANKS[curRank + 1] || RANKS[curRank];
    const needed = Math.max(0, nextSol - vol).toFixed(4);
    msg += `📉 Need *${needed} SOL* → ${rankIcons[curRank+1]} ${nextRank.name}\n`;
    const savings = (1.00 - rank.fee) * 100;
    msg += `💰 Fee savings: *${savings.toFixed(2)}%* vs base rate\n`;
  } else {
    msg += `👑 *Maximum rank achieved!*\n`;
  }
  return msg;
}

// ════════════════════════════════════════════════════════════
// MAIN MENU
// ════════════════════════════════════════════════════════════
function buildMainMenu(user, todayStats, killSwitchActive) {
  const isProMode = user && user.mode === 'pro';
  const kb = new InlineKeyboard();

  if (killSwitchActive) {
    kb.text('🔴 Trading Paused — Admin Notice', 'noop').row();
  }

  kb.text(getFeeDisplay(user), 'menu_rank_info').row();
  if (todayStats) kb.text(buildQuickStats(todayStats), 'menu_stats').row();

  kb.text('BUY 🟢', 'trade_quickbuy').text('🔴 SELL', 'trade_positions').row();
  kb.text('📂 Positions', 'menu_portfolio').text('💼 Wallets', 'menu_wallets').row();

  if (isProMode) {
    kb.text('🎯 Sniper', 'menu_sniper').text('👥 Copy Trade', 'menu_copy_trade').row();
    kb.text('📍 Limit', 'menu_limit_orders').text('📉 DCA', 'menu_dca').text('🔔 Watchlist', 'menu_watchlist').row();
    kb.text('🚀 Launch Token', 'menu_launch').row();
    kb.text('⚙️ Settings', 'menu_settings').text('💰 Referrals', 'menu_referrals').row();
    kb.text('❓ Help', 'menu_help').row();
    kb.text('🌱 Beginner Mode →', 'mode_set_beginner').row();
  } else {
    kb.text('📍 Limit', 'menu_limit_orders').text('📉 DCA', 'menu_dca').text('🔔 Watchlist', 'menu_watchlist').row();
    kb.text('⚙️ Settings', 'menu_settings').text('💰 Referrals', 'menu_referrals').row();
    kb.text('❓ Help', 'menu_help').row();
    kb.text('🚰 Get Test SOL', 'devnet_faucet').row();
    kb.text('⚡ Pro Mode →', 'mode_set_pro').row();
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
  kb.text(`📉 Buy Slippage: ${s.slippage_pct||10}%`,      "set_slippage")
    .text(`📉 Sell Slippage: ${s.sell_slippage_pct||10}%`, "set_sell_slippage")
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
function buildProSettingsMenu(user) {
  const s = user?.settings || {};
  const kb = new InlineKeyboard();
  kb.text("🤖 Auto Buy", "pset_autobuy_screen").text("🤖 Auto Sell", "pset_autosell_screen").row();
  kb.text("⚡ Execution Settings", "pset_execution").row();
  kb.text("🔔 Alerts & Notifications", "pset_alerts").row();
  kb.text("🔐 PIN", "set_sap").text("⏱ Session", "set_session").row();
  kb.text("🌐 Language", "set_language").text(`📊 PnL: ${s.weekly_summary?"✅":"◻️"}`, "set_weekly").row();
  kb.text("🌱 Beginner Mode", "mode_set_beginner").row();
  kb.text("← Back", "menu_main").text("🔄 Refresh", "menu_settings").row();
  return kb;
}

function buildExecutionSettingsMenu(s, jitoExpanded = false, spdExpanded = false, slipExpanded = false) {
  const kb = new InlineKeyboard();
  const spd = s?.speed_mode || "standard";
  const mev = s?.mev_protect ?? 1;
  const cur = s?.jito_tip || 0.0075;
  const buySl = s?.slippage_pct || 10;
  const sellSl = s?.sell_slippage_pct || 10;

  // Buy/Sell amounts
  kb.text(`🟢 ${s?.buy_amt_1||0.1}`, "pset_b1").text(`🟢 ${s?.buy_amt_2||0.5}`, "pset_b2").text(`🟢 ${s?.buy_amt_3||1.0}`, "pset_b3").text("✏️", "pset_b_custom").row();
  kb.text(`🔴 ${s?.sell_pct_1||25}%`, "pset_s1").text(`🔴 ${s?.sell_pct_2||50}%`, "pset_s2").text(`🔴 ${s?.sell_pct_3||100}%`, "pset_s3").text("Init", "bset_sell_info").row();

  // Slippage
  if (slipExpanded) {
    kb.text("📉 BUY SLIPPAGE:", "noop").row();
    kb.text(buySl===5?"✅ 5%":"5%", "pset_slip_buy_5").text(buySl===10?"✅ 10%":"10%", "pset_slip_buy_10").text(buySl===20?"✅ 20%":"20%", "pset_slip_buy_20").text("✏️", "set_slippage").row();
    kb.text("📉 SELL SLIPPAGE:", "noop").row();
    kb.text(sellSl===5?"✅ 5%":"5%", "pset_slip_sell_5").text(sellSl===10?"✅ 10%":"10%", "pset_slip_sell_10").text(sellSl===20?"✅ 20%":"20%", "pset_slip_sell_20").text("✏️", "set_sell_slippage").row();
  } else {
    kb.text(`📉 Buy: ${buySl}% | Sell: ${sellSl}%`, "pset_slippage_expand").row();
  }

  // Speed
  if (spdExpanded) {
    kb.text(spd==="standard"?"✅ Std":"Std", "pset_speed_standard").text(spd==="fast"?"✅ Fast 🐎":"Fast 🐎", "bset_speed_fast").text(spd==="turbo"?"✅ Turbo 🚀":"Turbo 🚀", "bset_speed_turbo").row();
    kb.text(spd==="boost"?"✅ Boost 🔥":"Boost 🔥", "pset_speed_boost").text(spd==="custom"?"✅ Custom ✏️":"Custom ✏️", "bset_speed_custom").row();
  } else {
    const spdLabel = spd==="standard"?"Std ⬜":spd==="fast"?"Fast 🐎 ✅":spd==="turbo"?"Turbo 🚀 ✅":spd==="boost"?"Boost 🔥 ✅":"Custom ✅";
    kb.text(`⚡ Speed: ${spdLabel}`, "pset_speed_expand").row();
  }

  kb.text(s?.confirm_trades ? "✅ Confirm" : "⬜ Confirm", "pset_confirm").text(mev ? "✅ MEV" : "⬜ MEV", "set_mev").row();

  // Jito
  if (jitoExpanded) {
    kb.text(cur===0.0001?"✅ Min":"Min", "pset_jito_preset_0.0001").text(cur===0.005?"✅ Std":"Std", "pset_jito_preset_0.005").text(cur===0.0075?"✅ Def":"Def", "pset_jito_preset_0.0075").row();
    kb.text(cur===0.01?"✅ Fast":"Fast", "pset_jito_preset_0.01").text(cur===0.05?"✅ Pri":"Pri", "pset_jito_preset_0.05").text("✏️", "pset_jito_custom").row();
  } else {
    kb.text(`⚡ Jito: ${cur} SOL`, "pset_jito").row();
  }

  kb.text("← Back", "menu_settings").row();
  return kb;
}

function buildMevSettingsMenu(s) {
  const kb  = new InlineKeyboard();
  const mev = s?.mev_protect ?? 1;
  kb.text(mev ? "✅ MEV Protection" : "⬜ MEV Protection", "set_mev").row();
  kb.text(`⚡ Jito Tip: ${s?.jito_tip||0.0075} SOL`, "pset_jito").row();
  kb.text("← Back", "menu_settings").row();
  return kb;
}

function buildAlertsSettingsMenu(s) {
  const kb = new InlineKeyboard();
  kb.text("👛 Wallet Tracker", "alert_add_wallet").row();
  kb.text(`📊 Daily PnL Report: ${s?.weekly_summary?"✅":"◻️"}`, "set_weekly").row();
  kb.text("← Back", "menu_settings").row();
  return kb;
}

// ════════════════════════════════════════════════════════════
// WALLET MENU
// ════════════════════════════════════════════════════════════
function buildWalletMenu(wallets, activeWalletId, mode = "pro") {
  const kb = new InlineKeyboard();
  if (!Array.isArray(wallets)) wallets = [];

  // Wallets — 3 per row with custom label
  for (let i = 0; i < wallets.length; i += 3) {
    wallets.slice(i, i + 3).forEach((w, idx) => {
      const num    = i + idx + 1;
      const active = w.wallet_id === activeWalletId;
      const lbl = (w.label && !w.label.match(/^W\d+$/)) ? ` ${w.label}` : "";
      kb.text(active ? `W${num}${lbl} ✅` : `W${num}${lbl}`, `wallet_select_${w.wallet_id}`);
    });
    kb.row();
  }

  const isPro = mode === "pro";
  if (isPro) {
    // PRO — full menu
    if (wallets.length > 0) kb.text("🗑 Delete Wallet", "wallet_delete_select").row();
    kb.text("📋 Copy Address", "wallet_copy_address").text("✏️ Rename", "wallet_rename").row();
    kb.text(" Deposit 🟢",  "wallet_deposit").text("🔴 Withdraw ", "wallet_withdraw").row();
    kb.text("📥 Import Key",  "wallet_import").text("🔑 Export Key",  "wallet_export_select").row();
    kb.text("➕ New Wallet",  "wallet_generate").text("🚰 Airdrop SOL", "devnet_faucet").row();
  } else {
    // BEGINNER — simplified (Delete on top, then Deposit/Withdraw/Import/Export/New)
    if (wallets.length > 0) kb.text("🗑 Delete Wallet", "wallet_delete_select").row();
    kb.text(" Deposit 🟢",  "wallet_deposit").text("🔴 Withdraw ", "wallet_withdraw").row();
    kb.text("📥 Import Key",  "wallet_import").text("🔑 Export Key",  "wallet_export_select").row();
    kb.text("➕ New Wallet",  "wallet_generate").row();
  }
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
        const name = cw.label || cw.wallet_address.slice(0,12) + "...";
        kb.text(`${cw.active ? "🟢" : "⏸"} ${name}`, `copy_wallet_view_${cw.id}`).row();
      });
    }
  if (count < 5) kb.text(`➕ Add Copy Wallet (${count}/5)`, "copy_wallet_add").row();
  else kb.text("Max 5 — delete one to add", "noop").row();
    const anyActive2 = copyWallets && copyWallets.some(w => w.active);
    kb.text(anyActive2 ? "⏸ Pause All" : "▶ Resume All", "copy_wallet_pause_all").row();
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
      const name   = cc.channel_name || cc.channel_id;
      const status = cc.status === "active" ? "🟢" : "⏸";
      kb.text(`${status} ${name}`, `copy_channel_view_${cc.id}`).row();
    });
  }
  kb.text("➕ Add Copy Channel", "copy_channel_add").row();
  const anyActive = copyChannels && copyChannels.some(c => c.status === "active");
  kb.text(anyActive ? "⏸ Pause All" : "▶ Resume All", "copy_channel_pause_all").row();
  kb.text("← Back", "menu_copy_trade").text("🔄 Refresh", "copy_channel_menu").row();
  return kb;
}

function buildCopyChannelSettingsMenu(ch, expanded = false) {
  const kb = new InlineKeyboard();
  kb.text(`💰 ${ch.buy_amount||0.1}SOL`, `cch_buy_${ch.id}`)
    .text(`📊 ${ch.slippage||50}%`, `cch_slip_${ch.id}`)
    .text(`⛽ ${ch.tip||0.005}SOL`, `cch_tip_${ch.id}`)
    .row();
  kb.text(ch.mev_protection ? "🛡 MEV: ON ✅" : "🛡 MEV: OFF ❌", `cch_mev_${ch.id}`)
    .text(ch.auto_sell_enabled ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", `cch_autosell_${ch.id}`)
    .row();
  if (expanded) {
    kb.text("🔍 Filters ▲", `cch_filters_collapse_${ch.id}`).row();
    kb.text(`💧 Min Liq: ${ch.min_liquidity ? ch.min_liquidity + " SOL" : "OFF"}`, `cch_minliq_${ch.id}`)
      .text(`📊 Max MCap: ${ch.max_mcap ? (ch.max_mcap/1000) + "K" : "OFF"}`, `cch_maxmcap_${ch.id}`)
      .row();
    kb.text(`📉 Min MCap: ${ch.min_mcap ? (ch.min_mcap/1000) + "K" : "OFF"}`, `cch_minmcap_${ch.id}`)
      .text(`⏰ Min Age: ${ch.min_token_age ? ch.min_token_age + "m" : "OFF"}`, `cch_minage_${ch.id}`)
      .row();
    kb.text("🚫 Blacklist Words", `cch_blacklist_${ch.id}`).row();
  } else {
    kb.text("🔍 Filters ▼", `cch_filters_expand_${ch.id}`).row();
  }
  kb.text("✏️ Rename", `cch_rename_${ch.id}`)
    .text(ch.status === "active" ? "⏸ Pause Channel" : "▶ Resume Channel", `copy_channel_toggle_${ch.id}`)
    .row();
  kb.text("← Back", "copy_channel_menu")
    .text("🗑 Delete", `copy_channel_delete_${ch.id}`).row();
  return kb;
}

// ════════════════════════════════════════════════════════════
// SNIPER
// ════════════════════════════════════════════════════════════
function buildSniperMainMenu() {
  const kb = new InlineKeyboard();
  kb.text("🎯 Auto Sniper",      "sniper_auto_menu")
    .text("🔀 Migration Sniper", "sniper_migration_menu")
    .row()
    .text("⚡ Real-Time Snipe",  "sniper_realtime_menu")
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
  const anyActive = configs?.some(c => c.active);
  kb.text(anyActive ? "⏸ Pause All" : "▶ Resume All", "auto_pause_all").row();
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
    .row();
  kb.text(cfg.auto_sell_enabled ? "🤖 AutoSell ON ✅" : "🤖 AutoSell OFF ❌", `sniper_autosell_${cfg.id}`).row();
  kb.text(cfg.platform_raydium  ? "✅ Raydium"  : "◻️ Raydium",  `scfg_ray_${cfg.id}`)
    .text(cfg.platform_pumpfun  ? "✅ Pumpfun"  : "◻️ Pumpfun",  `scfg_pump_${cfg.id}`)
    .text(cfg.platform_moonshot ? "✅ Moonshot" : "◻️ Moonshot", `scfg_moon_${cfg.id}`)
    .row();
  kb.text(cfg.use_lightning_rpc ? "✅ ⚡ Lightning RPC" : "◻️ ⚡ Lightning RPC", `scfg_rpc_${cfg.id}`).row();
  kb.text(`Max Snipes: ${cfg.max_snipes||5}`, `scfg_max_${cfg.id}`).row();
  // Filters
  kb.text(`💧 Min Liq: ${cfg.min_liquidity||0} SOL`, `scfg_minliq_${cfg.id}`).text(`📊 Max MCap: ${cfg.market_cap_min||0}`, `scfg_maxmcap_${cfg.id}`).row();
  kb.text(`👤 Dev%: ${cfg.dev_holding_max||100}%`, `scfg_dev_${cfg.id}`).text(cfg.mint_auth_revoked ? "✅ Mint Rev" : "◻️ Mint Rev", `scfg_mint_${cfg.id}`).row();
  kb.text(cfg.freeze_auth_revoked ? "✅ Freeze Rev" : "◻️ Freeze Rev", `scfg_freeze_${cfg.id}`).text(cfg.platform_launchlab ? "✅ HawkX Launch" : "◻️ HawkX Launch", `scfg_hawkx_${cfg.id}`).row();
  kb.text("✏️ Rename", `scfg_rename_${cfg.id}`).text(cfg.active ? "✅ Active — tap to pause" : "⏸ Paused — tap to activate", `sniper_config_toggle_${cfg.id}`).row();
  kb.text("← Back", "sniper_auto_menu").row();
  return kb;
}

function buildMigrationSniperMenu(snipes) {
  const kb = new InlineKeyboard();


  if (!snipes?.length) { kb.text("No snipes yet", "noop").row(); }
  else {
    snipes.forEach((s) => {
      const icon = s.active ? "🟢" : "🟡";
      const snipeName = s.label || `Snipe #${s.id}`;
      const label = `${icon} ${snipeName}`;
      kb.text(label, `snipe_view_${s.id}`)
        .text("✖", `snipe_cancel_${s.id}`)
        .row();
    });
  }
  kb.text("➕ New Migration Snipe", "sniper_migration_new").row();
  const anyActive = snipes?.some(s => s.active);
  kb.text(anyActive ? "⏸ Pause All" : "▶ Resume All", "migration_pause_all").row();
  kb.text("← Back",    "menu_sniper")
    .text("🔄 Refresh", "sniper_migration_menu")
    .row();
  return kb;
}

function buildRealtimeSnipeMenu(cfg) {
  const kb = new InlineKeyboard();
  kb.text(cfg?.enabled ? "✅ Real-Time Snipe ON" : "◻️ Real-Time Snipe OFF", "sniper_rt_toggle").row();
  kb.text(`💰 Amount: ${cfg?.amount || 0.1} SOL`, "sniper_rt_amount")
    .text(`📉 Slippage: ${cfg?.slippage || 50}%`, "sniper_rt_slippage")
    .row();
  kb.text(`⛽ Fee: ${cfg?.fee || 0.003} SOL`, "sniper_rt_fee")
    .text(`🛡 MEV: ${cfg?.mev ? "ON ✅" : "OFF ❌"}`, "sniper_rt_mev")
    .row();
  kb.text(`🌊 Raydium: ${cfg?.raydium ? "ON ✅" : "OFF ❌"}`, "sniper_rt_raydium")
    .text(`🔥 Migrating: ${cfg?.migrating ? "ON ✅" : "OFF ❌"}`, "sniper_rt_migrating")
    .row();
  kb.text(cfg?.platform_launchlab ? "✅ HawkX Launch" : "◻️ HawkX Launch", "sniper_rt_hawkx")
    .text(`⚡ Jito: ${cfg?.jito_tip||0.0075} SOL`, "sniper_rt_jito")
    .row();
  kb.text(cfg?.auto_sell_enabled ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", "sniper_rt_autosell").row();
  kb.text("← Back", "menu_sniper")
    .text("🔄 Refresh", "sniper_realtime_menu")
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
// Shared: render template buttons in adaptive rows (3 short / 2 long), ✅ on selected
function renderTemplateRows(kb, templates, activeId, usePrefix) {
  if (!templates?.length) { kb.text("No templates yet", "noop").row(); return; }
  let i = 0;
  while (i < templates.length) {
    const first = templates[i];
    const perRow = (first.name || "").length > 5 ? 2 : 3;
    const slice = templates.slice(i, i + perRow);
    slice.forEach(t => {
      const sel = t.id === activeId;
      kb.text(`${sel ? "✅ " : ""}${t.name}`, `${usePrefix}_${t.id}`);
    });
    kb.row();
    i += perRow;
  }
}

function buildSniperAutoSellScreen(cfg, templates) {
  const kb = new InlineKeyboard();
  kb.text(cfg?.auto_sell_enabled ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", `sniper_autosell_toggle_${cfg.id}`).row();
  kb.text("📚 🛑 SL = sell if drops · 🎯 TP = sell if rises", "noop").row();
  renderTemplateRows(kb, templates, cfg.auto_sell_template_id, `sniper_autosell_use_${cfg.id}`);
  kb.text("➕ New Template", `sniper_autosell_new_${cfg.id}`).row();
  kb.text("← Back", `sniper_config_view_${cfg.id}`).row();
  return kb;
}
function buildWalletAutoSellScreen(cw, templates) {
  const kb = new InlineKeyboard();
  kb.text(cw.auto_sell_enabled ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", `cw_autosell_toggle_${cw.id}`).row();
  kb.text("📚 🛑 SL = sell if drops · 🎯 TP = sell if rises", "noop").row();
  renderTemplateRows(kb, templates, cw.auto_sell_template_id, `cw_autosell_use_${cw.id}`);
  kb.text("➕ New Template", `cw_autosell_new_${cw.id}`).row();
  kb.text("← Back", `copy_wallet_view_${cw.id}`).row();
  return kb;
}
function buildChannelAutoSellScreen(ch, templates) {
  const kb = new InlineKeyboard();
  kb.text(ch.auto_sell_enabled ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", `cch_autosell_toggle_${ch.id}`).row();
  kb.text("📚 🛑 SL = sell if drops · 🎯 TP = sell if rises", "noop").row();
  renderTemplateRows(kb, templates, ch.auto_sell_template_id, `cch_autosell_use_${ch.id}`);
  kb.text("➕ New Template", `cch_autosell_new_${ch.id}`).row();
  kb.text("← Back", ch.id === "setup" ? "cch_autosell_setup" : `copy_channel_view_${ch.id}`).row();
  return kb;
}
function buildSettingsAutoSellScreen(s, templates) {
  const kb = new InlineKeyboard();
  const on = s?.auto_sell_enabled ?? 0;
  const tplId = s?.auto_sell_template_id || 0;
  kb.text(on ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", "sas_toggle").row();
  kb.text("📚 🛑 SL = sell if drops · 🎯 TP = sell if rises", "noop").row();
  renderTemplateRows(kb, templates, tplId, `sas_use`);
  kb.text("➕ New Template", "pset_autosell_screen").row();
  kb.text("← Back", "menu_settings")
    .text("🔄 Refresh", "pset_autosell_manual")
    .row();
  return kb;
}
    function buildAutoSellListScreen(templates, activeTemplateId, autoSellOn) {
  const kb = new InlineKeyboard();
  // Guard: ignore stale selection that no longer exists
  if (activeTemplateId && !(templates||[]).some(t => t.id === activeTemplateId)) activeTemplateId = null;
  kb.text(autoSellOn ? "🤖 Auto Sell: ON ✅" : "🤖 Auto Sell: OFF ❌", "sas_toggle").row();
  kb.text("📚 🛑 SL = sell if drops · 🎯 TP = sell if rises", "noop").row();
  renderTemplateRows(kb, templates, activeTemplateId, "ast_select");
  kb.text("➕ New Template", "ast_new").row();
  kb.text("← Back", "menu_settings")
    .text("🔄 Refresh", "pset_autosell_screen")
    .row();
  return kb;
}
function buildAutoBuyScreen(s) {
  const kb = new InlineKeyboard();
  const on = s?.auto_buy_enabled ?? 0;
  kb.text(on ? "✅ Auto Buy: ON" : "◻️ Auto Buy: OFF", "ab_toggle").row();
  kb.text(`💰 Amount: ${s?.auto_buy_sol||0.1} SOL`, "ab_amount")
    .text(`📉 Slip: ${s?.auto_buy_slippage||10}%`,   "ab_slippage")
    .row();
  kb.text(`⛽ Gas: ${s?.auto_buy_gas||0.005} SOL`,   "ab_gas")
    .text(s?.auto_buy_mev ? "🛡 MEV: ON ✅" : "🛡 MEV: OFF ❌", "ab_mev")
    .row();
  kb.text(`🔢 Max Buys/Token: ${s?.auto_buy_max||1}`, "ab_max").row();
  kb.text("✅ Save & Back", "menu_settings")
  .text("🔄 Refresh", "pset_autobuy_screen")
  .row();
  return kb;
}
// ════════════════════════════════════════════════════════════
// WATCHLIST
// ════════════════════════════════════════════════════════════
function buildAutoSellTemplateScreen(t) {
  const kb = new InlineKeyboard();
  const id = t.id;

  // Active/Rename
  const isNewTemplate = t.name === "New Template";
  kb.text(isNewTemplate ? "📝 Add Name" : `✏️ ${t.name}`, `ast_rename_${id}`).row();

  // SL Section
  kb.text("━━━ 🛑 Stop Loss ━━━", "noop").row();
  for (let i = 1; i <= 3; i++) {
    const sl    = t[`sl_${i}`] || 0;
    const slPct = t[`sl_${i}_sell_pct`] || 100;
    const slTr  = t[`sl_${i}_trail`] ? "🔄" : "📍";
    kb.text(`SL${i}`,                                      "noop")
      .text(`${slTr} ${sl===0?"OFF":sl+"%"}`,              `ast_sl_${i}_${id}`)
      .text(`Sell:${slPct}%`,                              `ast_sl_pct_${i}_${id}`)
      .text(t[`sl_${i}_trail`] ? "✅Trail" : "◻️Trail",  `ast_sl_trail_${i}_${id}`)
      .row();
  }

  // TP Section
  kb.text("━━━ 🎯 Take Profit ━━━", "noop").row();
  for (let i = 1; i <= 5; i++) {
    const tp    = t[`tp_${i}`] || 0;
    const tpPct = t[`tp_${i}_pct`] || 100;
    const tpTr  = t[`tp_${i}_trail`] ? "🔄" : "📍";
    kb.text(`TP${i}`,                                      "noop")
      .text(`${tpTr} ${tp===0?"OFF":"+"+tp+"%"}`,         `ast_tp_${i}_${id}`)
      .text(`Sell:${tpPct}%`,                              `ast_tp_pct_${i}_${id}`)
      .text(t[`tp_${i}_trail`] ? "✅Trail" : "◻️Trail",  `ast_tp_trail_${i}_${id}`)
      .row();
  }
  kb.text("✅ Save", `ast_save_${id}`).row();
  kb.text("← Back", `ast_back_${id}`)
    .text("🔄 Refresh", `ast_view_${id}`)
    .row();
  return kb;
}
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
    `🔗 t.me/${global.BOT_USERNAME || "hawkx_test_replit_bot"}?start=REF_${user.user_id}_${user.username || "user"}`
  );
}

const GUIDES = {
  main_beginner: "🌱 *Beginner Mode*\n\n━━━━━━━━━━━━━━━━━━━\n🟢 BUY/🔴 SELL — trade instantly\n📂 Positions — view open trades\n💼 Wallets — manage your wallets\n⚙️ Settings — customise bot\n💰 Referrals — earn rewards\n❓ Help — support & guide\n━━━━━━━━━━━━━━━━━━━",

  main_pro: "🦅 HawkX — Always Watching. Always First.\n\n━━━━━━━━━━━━━━━━━━━\n🟢 BUY/🔴 SELL — trade instantly\n📂 Positions — view open trades\n💼 Wallets — manage your wallets\n🎯 Sniper — auto snipe launches\n👥 Copy Trade — copy wallets/channels\n📍 Limit Orders — set price targets\n📉 DCA — auto-buy in chunks over time\n⚙️ Settings — customise bot\n🚀 Launch Token — launch your token\n🔔 Watchlist — track tokens & set price alerts\n💰 Referrals — earn rewards\n❓ Help — support\n━━━━━━━━━━━━━━━━━━━",

  positions:     "📂 Filter by All / Manual / Channel / Copy Wallet. Tap token name to manage.",
  wallets:       "💼 Tap wallet to switch. Deposit · Withdraw · Import · Export all here.",
  settings_beg:  "⚙️ Set buy/sell amounts, slippage, trade speed and security PIN.",
  settings_pro:  "⚙️ Choose a category to configure your trading settings.",
  copy_trade:    "👥 Copy Wallet = follows a trader. Copy Channel = buys signals from Telegram.",
  copy_wallet:   "💼 When followed wallet buys, you auto-buy. Max 5 wallets.",
  copy_channel:  "📚 *GUIDE:*\n\n➕ *Add* — add a channel to follow\n🟢 *Active* — tap to view/edit settings\n⏸ *Pause* — stop copying from channel\n▶ *Resume* — start copying again\n🗑 *Delete* — remove permanently\n\n💡 *HOW IT WORKS:*\nAdd any Telegram channel.\nWhen a token CA is posted there,\nbot auto-buys using your settings.",
  sniper:        "🎯 Auto Sniper catches new launches. Migration Sniper targets PumpFun→Raydium.",
  limit_orders:  "📋 Set price targets. Bot auto-buys or sells when price is reached.",
  referrals:     "💰 Share your link. Earn % of every trade your referrals make forever.",
};

function getGuide(screen) { return GUIDES[screen] || ""; }

module.exports = {
  buildMainMenu, buildBeginnerSettingsMenu, buildProSettingsMenu,
  buildExecutionSettingsMenu,
  buildAlertsSettingsMenu, buildWalletMenu, buildWalletDeleteSelect,
  buildWalletExportSelect, buildCopyTradeMenu, buildCopyWalletListMenu,
  buildCopyChannelListMenu, buildCopyChannelSettingsMenu,
  buildSniperMainMenu, buildAutoSniperMenu, buildSniperConfigMenu,
  buildMigrationSniperMenu, buildRealtimeSnipeMenu, buildLimitOrdersMenu, buildLimitOrderSetupMenu,
  buildAutoBuyScreen, buildSettingsAutoSellScreen, buildAutoSellListScreen, buildAutoSellTemplateScreen, buildWalletAutoSellScreen, buildChannelAutoSellScreen, buildSniperAutoSellScreen, buildWatchlistMenu, buildRankUpBanner, buildRankInfoMessage,
  buildQuickStats, getModeLabel, getFeeDisplay, getGuide, RANKS,
};
