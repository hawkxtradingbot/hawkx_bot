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
  const userWithSettings = { ...user, settings };
  const guide = isProMode
    ? "⚙️ *Pro Settings* — Choose a category:\n\n" +
      "⚡ *Execution* — Buy/sell amounts, slippage, speed\n" +
      "🛡 *MEV* — Protect trades from sandwich bots\n" +
      "🔒 *Risk* — Max trade size, daily limits, SL/TP\n" +
      "🔔 *Alerts* — Price alerts and notifications"
    : "⚙️ *Beginner Settings* — Tap any button to change instantly.\n\n" +
      "🟢 *Buy amounts* — SOL per trade\n" +
      "🔴 *Sell %* — % of position to sell\n" +
      "📉 *Slippage* — Price tolerance %\n" +
      "⚡ *Speed* — Trade execution priority\n" +
      "🔐 *PIN* — Security for key export/withdraw";
  const kb = isProMode
    ? buildProSettingsMenu(userWithSettings)
    : buildBeginnerSettingsMenu(userWithSettings);

  try { await ctx.editMessageText(guide, { parse_mode: "Markdown", reply_markup: kb }); }
  catch { await ctx.reply(guide, { parse_mode: "Markdown", reply_markup: kb }); }
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
