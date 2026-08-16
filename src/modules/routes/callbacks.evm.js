// EVM/HOOD trade button handlers — buy amounts, custom buy, sell 50/100, refresh.
// Calls the real evmBuy/evmSell (which handle mock-on-devnet, real-on-mainnet + fee tracking).
const db = require("../../../database");

async function handleEvmCallbacks(ctx, data, userId, user, bot, ks) {
  if (!data || !data.startsWith("evm_")) return false;

  const activeChain = db.getActiveChain(userId);
  const tokenCa = db.getSysConfig(`pending_ca_${userId}`) || "";

  // ── Refresh the token screen ──
  if (data === "evm_token_refresh") {
    await ctx.answerCallbackQuery("🔄 Refreshing...");
    if (!tokenCa) return true;
    const { showEvmTokenScreen } = require("./helpers.routes");
    await showEvmTokenScreen(ctx, user, tokenCa);
    return true;
  }

  // ── Buy a preset amount: evm_buy_0.1 etc ──
  if (data.startsWith("evm_buy_") && data !== "evm_buy_custom") {
    const amt = parseFloat(data.replace("evm_buy_", ""));
    if (isNaN(amt) || amt <= 0) { await ctx.answerCallbackQuery("Invalid amount"); return true; }
    if (!tokenCa) { await ctx.answerCallbackQuery({ text: "Paste a token first.", show_alert: true }); return true; }
    if (ks) { await ctx.answerCallbackQuery({ text: "Trading is paused.", show_alert: true }); return true; }
    await ctx.answerCallbackQuery();
    const { evmBuy } = require("../chains/evm/evmTrade");
    try {
      await evmBuy(ctx, user, tokenCa, amt, "manual", null, {}, activeChain);
    } catch (e) {
      const { formatError } = require("../errorFormat");
      const fe = formatError(e, "evm buy");
      if (fe.alert) require("../adminAlert").alertAdmin("EVM Buy", fe.adminDetail || String(e.message||e)).catch(()=>{});
      await ctx.reply("❌ " + fe.userMsg);
    }
    return true;
  }

  // ── Custom buy amount → prompt for input ──
  if (data === "evm_buy_custom") {
    if (!tokenCa) { await ctx.answerCallbackQuery({ text: "Paste a token first.", show_alert: true }); return true; }
    await ctx.answerCallbackQuery();
    db.setSysConfig(`pending_${userId}`, "evm_buy_custom");
    const sym = db.getChainConfig(activeChain)?.native_symbol || "ETH";
    await ctx.reply(`✏️ Enter buy amount in ${sym} (e.g. 0.25):`);
    return true;
  }

  // ── Sell a % of the held position: evm_sell_50 / evm_sell_100 ──
  if (data.startsWith("evm_sell_")) {
    const pct = parseInt(data.replace("evm_sell_", ""));
    if (isNaN(pct) || pct <= 0 || pct > 100) { await ctx.answerCallbackQuery("Invalid %"); return true; }
    if (ks) { await ctx.answerCallbackQuery({ text: "Trading is paused.", show_alert: true }); return true; }
    if (!tokenCa) { await ctx.answerCallbackQuery({ text: "No token selected.", show_alert: true }); return true; }
    // Find the open position for this token on this chain
    const positions = db.getOpenPositions(userId) || [];
    const pos = positions.find(p => (p.token_ca||"").toLowerCase() === tokenCa.toLowerCase() && (p.chain||"SOL") === activeChain);
    if (!pos) { await ctx.answerCallbackQuery({ text: "No position to sell.", show_alert: true }); return true; }
    await ctx.answerCallbackQuery();
    const { evmSell } = require("../chains/evm/evmTrade");
    try {
      await evmSell(ctx, user, pos, pct, {});
    } catch (e) {
      const { formatError } = require("../errorFormat");
      const fe = formatError(e, "evm sell");
      if (fe.alert) require("../adminAlert").alertAdmin("EVM Sell", fe.adminDetail || String(e.message||e)).catch(()=>{});
      await ctx.reply("❌ " + fe.userMsg);
    }
    return true;
  }

  return false;
}

module.exports = { handleEvmCallbacks };
