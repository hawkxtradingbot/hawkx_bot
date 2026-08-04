// M07 — Settings V12
// All handlers — instant toggle, prompt messages auto-delete
// Beginner and Pro mode settings separated

const db     = require("../../../database");
const bcrypt = require("bcryptjs");
const {
  buildBeginnerSettingsMenu, buildProSettingsMenu,
  buildExecutionSettingsMenu, buildMevSettingsMenu,
  buildRiskSettingsMenu, buildAlertsSettingsMenu,
} = require("../keyboards");

// ── Show settings based on mode ───────────────────────────────
async function showSettings(ctx, user) {
  const settings = db.getSettings(user.user_id);
  const isProMode = user.mode === "pro";
  const _isSol = !(user.active_chain && user.active_chain !== "SOL");
  const _coin = _isSol ? "SOL" : "ETH";
  const _sc = db.getChainConfig(user.active_chain || "SOL");
  const _scIcons = { SOL: "🟣", HOOD: "🟢" };
  const _chainLine = `${_scIcons[user.active_chain] || "🔗"} Chain: *${_sc?.label || user.active_chain || "Solana"}*\n\n`;
  const userWithSettings = { ...user, settings };
  const guide = isProMode
    ? "⚙️ *Pro Settings* — Choose a category:\n\n" + _chainLine +
      "⚡ *Execution* — Buy/sell amounts, slippage" + (_isSol ? ", speed" : "") + "\n" +
      (_isSol ? "🛡 *MEV* — Protect trades from sandwich bots\n" : "") +
      "🔒 *Risk* — Max trade size, daily limits, SL/TP\n" +
      "🔔 *Alerts* — Price alerts and notifications"
    : "⚙️ *Beginner Settings* — Tap any button to change instantly.\n\n" + _chainLine +
      `🟢 *Buy amounts* — ${_coin} per trade\n` +
      "🔴 *Sell %* — % of position to sell\n" +
      "📉 *Slippage* — Price tolerance %\n" +
      (_isSol ? "⚡ *Speed* — Trade execution priority\n" : "") +
      "🔐 *PIN* — Security for key export/withdraw";
  const kb = isProMode
    ? buildProSettingsMenu(userWithSettings)
    : buildBeginnerSettingsMenu(userWithSettings);

  try {
    await ctx.editMessageText(guide, { parse_mode: "Markdown", reply_markup: kb });
    db.setSysConfig(`settings_msg_${user.user_id}`, String(ctx.callbackQuery?.message?.message_id || 0));
  } catch {
    const m = await ctx.reply(guide, { parse_mode: "Markdown", reply_markup: kb });
    db.setSysConfig(`settings_msg_${user.user_id}`, String(m.message_id));
  }
}

// ── Send prompt, return message ID for deletion ───────────────
async function sendPrompt(ctx, text) {
  const msg = await ctx.reply(text, { parse_mode: "Markdown" });
  return msg.message_id;
}

async function deleteMsg(ctx, msgId) {
  if (!msgId) return;
  try { await ctx.api.deleteMessage(ctx.chat.id, msgId); } catch {}
}

// ── Instant toggle refresh ────────────────────────────────────
async function refreshSettings(ctx, user) {
  const settings      = db.getSettings(user.user_id);
  const userWithSettings = { ...user, settings };
  const isProMode     = user.mode === "pro";
  const kb = isProMode
    ? buildProSettingsMenu(userWithSettings)
    : buildBeginnerSettingsMenu(userWithSettings);
  try { await ctx.editMessageReplyMarkup({ reply_markup: kb }); } catch {}
}


module.exports = { showSettings, sendPrompt, deleteMsg, refreshSettings };
