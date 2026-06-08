const db = require("../../database");

function getLaunchPending(userId) {
  const user = db.getUser(userId);
  const walletId = db.getSysConfig(`launch_wallet_${userId}`) || user?.active_wallet_id;
  return {
    name:        db.getSysConfig(`launch_name_${userId}`)        || "",
    symbol:      db.getSysConfig(`launch_symbol_${userId}`)      || "",
    supply:      db.getSysConfig(`launch_supply_${userId}`)      || "1000000000",
    description: db.getSysConfig(`launch_desc_${userId}`)        || "",
    twitter:     db.getSysConfig(`launch_twitter_${userId}`)     || "",
    telegram:    db.getSysConfig(`launch_telegram_${userId}`)    || "",
    website:     db.getSysConfig(`launch_website_${userId}`)     || "",
    platform:    db.getSysConfig(`launch_platform_${userId}`)    || "",
    initial_buy: db.getSysConfig(`launch_initial_buy_${userId}`) || "0",
    image:       db.getSysConfig(`launch_image_${userId}`)       || "",
    wallet_id:   walletId,
  };
}

function buildLaunchPlatformScreen() {
  return {
    inline_keyboard: [
      [{ text: "🌊 Pump.fun", callback_data: "launch_platform_pump" },
       { text: "🦅 HawkX", callback_data: "launch_platform_hawkx" }],
      [{ text: "📋 My Launches", callback_data: "launch_my_list" }],
      [{ text: "← Back", callback_data: "menu_main" }],
    ]
  };
}

function buildLaunchScreen(p, wallets, balance, walletNum, expanded) {
  const buyAmt = p.initial_buy || "0";

  // Wallet buttons when expanded
  const walletBtns = [];
  if (expanded) {
    for (let i = 0; i < wallets.length; i += 4) {
      walletBtns.push(wallets.slice(i, i+4).map((w, idx) => {
        const num = i+idx+1;
        const isSel = String(w.wallet_id) === String(p.wallet_id);
        return { text: (() => { const l=(w.label&&!w.label.match(/^W\d+$/))?` ${w.label}`:""; return isSel?`W${num}${l} ✅`.slice(0,20):`W${num}${l}`.slice(0,20); })(), callback_data: `launch_setwallet_${w.wallet_id}` };
      }));
    }
  }

  return {
    inline_keyboard: [
      [{ text: p.image ? "🖼 Image: ✅" : "🖼 Upload Image ❌", callback_data: "launch_set_image" }],
      [{ text: `📝 Name: ${p.name||"Not set"}`, callback_data: "launch_set_name" },
       { text: `🔤 Symbol: ${p.symbol||"Not set"}`, callback_data: "launch_set_symbol" }],
      ...(p.platform === "pump" ?
        [[{ text: "🔢 Supply: 1,000,000,000 🔒", callback_data: "launch_supply_locked" }]] :
        [[{ text: `🔢 Supply: ${parseInt(p.supply||1000000000).toLocaleString()}`, callback_data: "launch_set_supply" }]]
      ),
      [{ text: p.description ? "📄 Description ✅" : "📄 Description ❌", callback_data: "launch_set_desc" }],
      [{ text: `🐦 ${p.twitter||"Twitter: Not set"}`, callback_data: "launch_set_twitter" },
       { text: `💬 ${p.telegram||"Telegram: Not set"}`, callback_data: "launch_set_telegram" }],
      [{ text: `🌍 ${p.website||"Website: Not set"}`, callback_data: "launch_set_website" }],
      // Wallet selector
      ...(expanded ? [
        ...walletBtns,
        [{ text: "▲ Close Wallet", callback_data: "launch_wallet_collapse" }],
      ] : [
        [{ text: `💼 W${walletNum} — ${balance.toFixed(3)} SOL ▼`, callback_data: "launch_wallet_expand" }],
      ]),
      [{ text: `0 SOL`, callback_data: "launch_buy_amt_0" },
       { text: `0.1 SOL`, callback_data: "launch_buy_amt_0.1" },
       { text: `0.5 SOL`, callback_data: "launch_buy_amt_0.5" },
       { text: `✏️ Custom`, callback_data: "launch_set_initial_buy" }],
      [{ text: `💰 ${buyAmt} SOL — Cost: ~${(0.02+parseFloat(buyAmt||0)).toFixed(2)} SOL`, callback_data: "noop" }],
      [{ text: "🚀 Launch & Buy", callback_data: "launch_confirm" }],
      [{ text: "← Back", callback_data: "menu_launch" },
       { text: "🔄 Refresh", callback_data: `launch_refresh_${p.platform}` }],
    ]
  };
}

function buildLaunchSuccessScreen(ca, name, symbol) {
  const shareText = encodeURIComponent(`🚀 ${name} (${symbol}) just launched!\n\nCA: ${ca}\n\nTrade now 🦅`);
  return {
    inline_keyboard: [
      [{ text: "🟢 0.1 SOL", callback_data: `launch_token_buy_${ca}_0.1` },
       { text: "🟢 0.5 SOL", callback_data: `launch_token_buy_${ca}_0.5` },
       { text: "🟢 ✏️", callback_data: `launch_token_buy_custom_${ca}` }],
      [{ text: "🔴 25%", callback_data: `launch_token_sell_${ca}_25` },
       { text: "🔴 50%", callback_data: `launch_token_sell_${ca}_50` },
       { text: "🔴 100%", callback_data: `launch_token_sell_${ca}_100` },
       { text: "🔴 ✏️", callback_data: `launch_token_sell_custom_${ca}` }],
      [{ text: "🎁 Bundle Sell", callback_data: `launch_bundlesell_${ca}` }],
      [{ text: "📊 Position", callback_data: "menu_portfolio" },
       { text: "📢 Share", url: `https://t.me/share/url?url=https://pump.fun/${ca}&text=${shareText}` }],
      [{ text: "← My Launches", callback_data: "launch_my_list" },
       { text: "🔄 Refresh", callback_data: `launch_chart_${ca}` }],
    ]
  };
}

module.exports = { getLaunchPending, buildLaunchPlatformScreen, buildLaunchScreen, buildLaunchSuccessScreen };
