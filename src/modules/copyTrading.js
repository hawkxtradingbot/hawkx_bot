// M27 — Copy Trading V12
// Copy Wallet: mirrors another wallet's trades
// Copy Channel: monitors Telegram channel for CAs
// Auto sell OFF = token sellable via main settings + limit orders

const db = require("../../database");

async function executeCopyWalletBuy(bot, copyWallet, tokenCa, tokenName) {
  const user = db.getUser(copyWallet.user_id);
  if (!user || !copyWallet.active) return;

  const solAmount = copyWallet.sol_amount || 0.1;
  const { mockBuy } = require("./executor");
  // Reuse the proven real-buy path (same as manual buys/DCA) instead of simulating -
  // this was previously 100% fake even on mainnet (fake tx hash, no real swap ever executed).
  const fakeCtx = { chat: { id: user.user_id }, api: bot.api, reply: async () => {} };
  const result = await mockBuy(fakeCtx, user, tokenCa, solAmount, "copy_wallet", copyWallet.label || copyWallet.wallet_address.slice(0,8), { silent: true, skipSafety: true });

  const safeLabel = String(copyWallet.label || "").replace(/[_*`[\]]/g, "");
  if (!result) {
    try { await bot.api.sendMessage(user.user_id, `⚠️ *Copy Wallet Buy Failed*\n\nCopied: *${safeLabel}*\nToken: \`${tokenCa.slice(0,12)}...\``, { parse_mode: "Markdown" }); } catch {}
    return;
  }
  try {
    await bot.api.sendMessage(user.user_id,
      `👛 *Copy Wallet Buy*\n\nCopied: *${safeLabel}*\nToken: \`${tokenCa.slice(0,12)}...\`\nAmount: *${solAmount} SOL*\n\n_${copyWallet.auto_sell_enabled ? "Auto sell active." : "Sell from Positions or add limit orders."}_`,
      { parse_mode: "Markdown" }
    );
  } catch {}
}


async function executeCopyChannelBuy(bot, channel, tokenCa) {
  const user = db.getUser(channel.user_id);
  if (!user || channel.status !== "active") return;

  const { checkSafety } = require("./safetyChecker");
  const { mockBuy } = require("./executor");

  const safety = await checkSafety(tokenCa, user.mode || "beginner");
  if (safety.status === "BLOCK") {
    const safeCh     = String(channel.channel_name || channel.channel_id || "").replace(/[_*`[\]]/g, "");
    const safeReason = String(safety.reason || "").replace(/[_*`[\]]/g, "");
    try {
      await bot.api.sendMessage(user.user_id,
        `🚫 *Channel Buy Blocked*\n\nChannel: *${safeCh}*\nReason: *${safeReason}*`,
        { parse_mode: "Markdown" }
      );
    } catch {}
    return;
  }

  const solAmount = channel.buy_amount || 0.1;
  // Reuse the proven real-buy path instead of simulating - this was previously 100% fake
  // even on mainnet (fake tx hash, no real swap ever executed).
  const fakeCtx = { chat: { id: user.user_id }, api: bot.api, reply: async () => {} };
  const result = await mockBuy(fakeCtx, user, tokenCa, solAmount, "copy_channel", channel.channel_id, { silent: true, skipSafety: true });

  const safeName = String(channel.channel_name || channel.channel_id || "").replace(/[_*`[\]]/g, "");
  if (!result) {
    try { await bot.api.sendMessage(user.user_id, `⚠️ *Copy Channel Buy Failed*\n\nChannel: *${safeName}*\nToken: \`${tokenCa.slice(0,12)}...\``, { parse_mode: "Markdown" }); } catch {}
    return;
  }

  try {
    db.getDb()
      .prepare("UPDATE copy_channels SET trades_executed = trades_executed + 1 WHERE id = ?")
      .run(channel.id);
  } catch {}

  const note = channel.auto_sell_enabled
    ? `Auto sell: SL ${channel.stop_loss_pct||0}% / TP ${channel.take_profit_pct||0}%`
    : "Auto sell OFF — sell manually or add limit orders from Positions.";

  try {
    await bot.api.sendMessage(user.user_id,
      `📡 *Copy Channel Buy*\n\nChannel: *${safeName}*\nToken: \`${tokenCa.slice(0,12)}...\`\nAmount: *${solAmount} SOL*\n\n_${note}_`,
      { parse_mode: "Markdown" }
    );
  } catch {}
}

function setupChannelMonitor(bot) {
  bot.on("channel_post", async (ctx) => {
    const text      = ctx.channelPost?.text || "";
    const username  = ctx.chat?.username;
    const channelId = username ? `@${username}` : String(ctx.chat?.id);

    const channels = db.getDb()
      .prepare("SELECT * FROM copy_channels WHERE channel_id = ? AND status = 'active'")
      .all(channelId);

    if (!channels.length) return;

    const caMatches = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];

    for (const ca of caMatches) {
      try {
        db.getDb()
          .prepare("INSERT INTO channel_signals (channel_id, ca, timestamp, action_taken) VALUES (?, ?, datetime('now'), 'detected')")
          .run(channelId, ca);
        db.getDb()
          .prepare("UPDATE copy_channels SET signals_caught = signals_caught + 1 WHERE channel_id = ?")
          .run(channelId);
      } catch {}

      for (const channel of channels) {
        await executeCopyChannelBuy(bot, channel, ca);
      }
    }
  });

  console.log("[CopyTrading] ✅ Channel monitor active");
}

module.exports = { executeCopyWalletBuy, executeCopyChannelBuy, setupChannelMonitor };
