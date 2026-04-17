kb.text('🔑 Export Private Key', `wallet_export_prompt_${activeWalletId}`).row();
// M05 — Keyboards (Devnet version with faucet button)
const { InlineKeyboard } = require('grammy');
const { t } = require('./i18n');
const config = require('../../config');

function getFeeDisplay(user) {
  if (!user) return '💰 Fee: 1% | Scout';
  if (user.trial_active) return t('menu.trial', user.language);
  const rankKey = config.RANK_FEE_KEYS[user.rank] || 'scout';
  const fee = (config.FEE_RATES[rankKey] * 100).toFixed(2);
  const rankName = config.RANK_NAMES[user.rank] || 'Scout';
  return `💰 ${t('menu.fee', user.language, { fee, rank: rankName })}`;
}

function buildMainMenu(user) {
  const kb = new InlineKeyboard();
  kb.text(getFeeDisplay(user), 'noop').row();
  kb.text('📊 Portfolio', 'menu_portfolio').text('⚡ Trade', 'menu_trade').row();
  kb.text('⚙️ Settings', 'menu_settings').text('👥 Referrals', 'menu_referrals').row();
  kb.text('📦 Modules', 'menu_modules').text('👛 Wallets', 'menu_wallets').row();
  // DEVNET ONLY BUTTON
  kb.text('🚰 Faucet (Free SOL)', 'devnet_faucet').row();
  kb.text('🧪 Test Trade', 'devnet_test_trade').text('📈 Sim Price', 'devnet_sim_price').row();
  kb.text('❓ Help', 'menu_help').row();
  return kb;
}

function buildTradeMenu(user) {
  const kb = new InlineKeyboard();
  kb.text('🔍 Quick Buy (Paste CA)', 'trade_quickbuy').row();
  kb.text('📂 Open Positions', 'trade_positions').row();
  kb.text('📋 Limit Orders (NEXT)', 'coming_soon').row();
  kb.text('🔄 DCA (NEXT)', 'coming_soon').row();
  kb.text('📡 Channel Monitor (NEXT)', 'coming_soon').row();
  // DEVNET TEST BUTTONS
  kb.text('🧪 Mock Buy 0.1 SOL', 'devnet_mock_buy').row();
  kb.text('🧪 Mock Sell Position', 'devnet_mock_sell').row();
  kb.text('🔙 Back', 'menu_main').row();
  return kb;
}

function buildModulesMenu() {
  const kb = new InlineKeyboard();
  // Rule 8 — ALL visible to ALL ranks
  kb.text('🎯 Sniper', 'mod_sniper').text('📈 Strategy', 'mod_strategy').row();
  kb.text('🛡 Safety', 'mod_safety').text('📊 Analytics', 'mod_analytics').row();
  kb.text('🦅 Hawk Elite', 'mod_hawkelite').row();
  kb.text('🔙 Back', 'menu_main').row();
  return kb;
}

function buildSettingsMenu(user) {
  const s = user ? user.settings : null;
  const kb = new InlineKeyboard();
  kb.text(`Slippage: ${s ? s.slippage_pct : 10}% ✏️`, 'set_slippage').row();
  kb.text(`Max Buy: ${s ? s.max_buy_sol : 0.1} SOL ✏️`, 'set_maxbuy').row();
  kb.text(`Speed: ${s ? s.speed_mode : 'standard'} ✏️`, 'set_speed').row();
  kb.text(`Auto-Buy: ${s && s.auto_buy ? '✅ ON' : '❌ OFF'}`, 'set_autobuy').row();
  kb.text(`Language ✏️`, 'set_language').row();
  // DEVNET: Quick rank test
  kb.text('🧪 Simulate Volume (+1 SOL)', 'devnet_add_volume').row();
  kb.text('🔙 Back', 'menu_main').row();
  return kb;
}

function buildWalletMenu(wallets, activeWalletId) {
  const kb = new InlineKeyboard();
    if (!Array.isArray(wallets)) wallets = [];
  wallets.forEach(w => {
    const short = `${w.public_key.slice(0, 4)}...${w.public_key.slice(-4)}`;
    const marker = w.wallet_id === activeWalletId ? ' ●' : '';
        // This adds the label and short address on a button
    kb.text(`${w.label}: ${short}${marker}`, `wallet_select_${w.wallet_id}`).row();
    
    // This adds a dedicated "Copy" button that sends the full address
    kb.text(`📋 Copy Full Address`, `copy_addr_${w.public_key}`).row();
  });
  kb.text('🆕 Generate Devnet Wallet', 'wallet_generate').row();
  kb.text('📥 Import Private Key', 'wallet_import').row();
  kb.text('🚰 Airdrop SOL to Active', 'devnet_faucet').row();
  kb.text("🔑 Export Private Key", `wallet_export_prompt_${activeWalletId}`).row();
  kb.text('🔙 Back', 'menu_main').row();
  return kb;
}

function buildRankUpBanner(user, rankName, fee) {
  const taglines = {
    2: 'First kills logged.',
    3: 'On the trail. Precision over instinct.',
    4: 'Apex instincts activated.',
    5: 'No prey escapes.',
    6: 'Elite execution. Minimum cost.',
    7: 'The Hawk never misses.',
  };
  return `🦅 *RANK UP! [DEVNET]*\n\n` +
    `👤 ${user.username || 'Trader'}\n` +
    `📊 New Rank: *${rankName}* (Rank ${user.rank})\n` +
    `📈 Volume: ${(user.cumulative_volume_sol || 0).toFixed(2)} SOL\n` +
    `💰 New Fee Rate: *${fee}%*\n\n` +
    `_${taglines[user.rank] || 'Keep climbing.'}_\n\n` +
    `🔗 Invite: t.me/YourBot?start=REF_${user.user_id}`;
}

module.exports = {
  buildMainMenu, buildTradeMenu, buildModulesMenu,
  buildSettingsMenu, buildWalletMenu, buildRankUpBanner,
};