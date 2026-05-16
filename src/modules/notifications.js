// ============================================================
// notifications.js — HawkX V11
// FIXED: was sending JSON.stringify(data) for all events
//        now sends properly formatted messages per event type
// V11: beginner/pro message styles, all event types covered
// ============================================================

const db  = require("../../database");
const { t } = require("./i18n");
const { buildRankUpBanner, RANKS } = require("./keyboards");

let botRef = null;

function setBotRef(bot) {
  botRef = bot;
}

// ════════════════════════════════════════════════════════════
// CORE NOTIFY — handles all event types with proper formatting
// ════════════════════════════════════════════════════════════
async function notify(userId, eventType, data = {}) {
  if (!botRef) return;

  const user = db.getUser(userId);
  if (!user) return;

  // Check notifications enabled
  try {
    const settings = db.getSettings(userId);
    if (settings?.notifications_enabled) {
      const notifConfig = JSON.parse(settings.notifications_enabled);
      if (notifConfig.all === false) return;
    }
  } catch {}

  // If stopLoss.js already built a formatted message — use it directly
  if (data._formattedMessage) {
    return sendMsg(userId, data._formattedMessage);
  }

  let msg = "";

  switch (eventType) {

    // ── STOP LOSS ───────────────────────────────────────────
    case "STOP_LOSS_HIT":
      msg =
        `🛑 *Stop Loss Triggered* [DEVNET]\n\n` +
        `🪙 Token: *${data.token || "Unknown"}*\n` +
        `📉 Drop: *${data.pct}%*\n` +
        `💸 SOL lost: *${data.sol} SOL*\n\n` +
        `_Position closed automatically._`;
      break;

    // ── TAKE PROFIT ─────────────────────────────────────────
    case "TAKE_PROFIT_HIT":
      msg =
        `🎯 *Take Profit Hit!* [DEVNET]\n\n` +
        `🪙 Token: *${data.token || "Unknown"}*\n` +
        `📈 Gain: *+${data.pct}%*\n` +
        `💰 SOL gained: *+${data.sol} SOL*\n\n` +
        `_Profits locked in automatically. 🦅_`;
      break;

    // ── RANK UP ─────────────────────────────────────────────
    case "RANK_UP": {
      const rankInfo = RANKS[data.newRank] || {};
      const oldRank = data.oldRank || (data.newRank - 1);
      const rankNames = { 1:"Scout", 2:"Tracker", 3:"Hunter", 4:"Predator", 5:"Apex", 6:"Hawk", 7:"Hawk Elite" };
      // Build journey string
      let journey = "";
      if (data.newRank - oldRank > 1) {
        const steps = [];
        for (let r = oldRank; r <= data.newRank; r++) steps.push(rankNames[r]);
        journey = "\n\n🚀 *Rank Journey:*\n" + steps.join(" → ");
        journey += "\n\n⚡ You jumped *" + (data.newRank - oldRank) + " ranks* in one go!";
      }
      const oldFee = (RANKS[oldRank]?.fee || 1.00).toFixed(2);
      const newFee = (rankInfo.fee || 0.5).toFixed(2);
      const saving = (parseFloat(oldFee) - parseFloat(newFee)).toFixed(2);
      const rankMsg = "🎉 *Congratulations " + (user.username || "Trader") + "!*\n\n" +
        "🏅 New Rank: *" + (data.rankName || rankInfo.name) + "*" + journey + "\n\n" +
        "💸 New Fee: *" + newFee + "%* (was " + oldFee + "%)\n" +
        "💰 Saving: *" + saving + "% per trade* 🦅";
      try {
        const { generateRankCard } = require("./statsCard");
        const { InputFile } = require("grammy");
        const cardBuf = await generateRankCard({ username: user.username || "Trader", rank: data.newRank, rankName: data.rankName || rankInfo.name, fee: rankInfo.fee, volume: user.cumulative_volume_sol || 0, trades: user.total_trades || 0, winRate: user.win_rate || 0 });
        if (cardBuf && botRef) {
          await botRef.api.sendPhoto(userId, new InputFile(cardBuf, "rank_card.png"), { caption: rankMsg, parse_mode: "Markdown" });
          return;
        }
      } catch(e) { console.log("[RANK CARD ERR]", e.message); }
      msg = rankMsg;
      break;
    }

    // ── TRIAL ENDING ─────────────────────────────────────────
    case "TRIAL_ENDING":
      msg =
        `⏳ *Trial Ending Soon* [DEVNET]\n\n` +
        `Your 7-day trial ends in *${data.daysLeft || 1} day(s)*.\n\n` +
        `After trial: fee moves to your rank rate.\n` +
        `Keep trading to climb ranks and lower your fee! 🦅`;
      break;

    // ── TRIAL ENDED ──────────────────────────────────────────
    case "TRIAL_ENDED":
      msg =
        `🔔 *Trial Ended* [DEVNET]\n\n` +
        `Your 7-day trial has ended.\n` +
        `Current fee: *${data.fee || "1.0"}%* (${data.rankName || "Scout"})\n\n` +
        `Trade more volume to rank up and reduce your fee. 🦅`;
      break;

    // ── TRADE CONFIRMED ──────────────────────────────────────
    case "TRADE_CONFIRMED":
      msg =
        `✅ *Trade Confirmed* [DEVNET]\n\n` +
        `${data.action === "buy" ? "🟢 BUY" : "🔴 SELL"} — *${data.token || "Token"}*\n` +
        `💰 ${data.sol || "?"} SOL\n` +
        `🔗 TX: \`${data.txHash || "DEVNET_MOCK"}\``;
      break;

    // ── REFERRAL EARNING ─────────────────────────────────────
    case "REFERRAL_EARNING":
      msg =
        `👥 *Referral Earning* [DEVNET]\n\n` +
        `Level ${data.level || 1} referral traded!\n` +
        `💰 You earned: *+${data.earned || "0"} SOL*`;
      break;

    // ── PAYOUT SENT ──────────────────────────────────────────
    case "PAYOUT_SENT":
      msg =
        `💸 *Referral Payout Sent* [DEVNET]\n\n` +
        `Amount: *${data.amount || "0"} SOL*\n` +
        `_Check your wallet balance._`;
      break;

    // ── KILL SWITCH ──────────────────────────────────────────
    case "KILL_SWITCH_ON":
      msg = `🔴 *Kill Switch ACTIVATED*\n\nAll trading has been stopped by admin.\nYour open positions are safe.`;
      break;

    case "KILL_SWITCH_OFF":
      msg = `✅ *Kill Switch Deactivated*\n\nTrading is now re-enabled. 🦅`;
      break;

    // ── WEEKLY SUMMARY (#18) ─────────────────────────────────
    case "WEEKLY_SUMMARY":
      msg =
        `📊 *Weekly Summary* [DEVNET]\n\n` +
        `🗓 Week ending: ${data.weekEnd || "this week"}\n` +
        `🔄 Trades: *${data.trades || 0}*\n` +
        `📈 Win Rate: *${data.winRate || 0}%*\n` +
        `💰 P&L: *${data.pnl >= 0 ? "+" : ""}${(data.pnl || 0).toFixed(4)} SOL*\n` +
        `🏅 Rank: *${data.rankName || "Scout"}*\n\n` +
        `_Keep climbing. 🦅_`;
      break;

    // ── DAILY CHALLENGE (#38) ────────────────────────────────
    case "DAILY_CHALLENGE":
      msg =
        `🎯 *Daily Challenge* [DEVNET]\n\n` +
        `Trade *${data.target || 3} times today* to earn *${data.reward || "0.01"} SOL*!\n\n` +
        `Progress: ${data.done || 0}/${data.target || 3}\n` +
        `_Challenge resets at midnight UTC._`;
      break;

    case "CHALLENGE_COMPLETE":
      msg =
        `🏆 *Challenge Complete!* [DEVNET]\n\n` +
        `You completed today's trading challenge!\n` +
        `💰 Reward: *+${data.reward || "0.01"} SOL* sent to your wallet. 🦅`;
      break;

    // ── MILESTONE (#39) ──────────────────────────────────────
    case "REFERRAL_MILESTONE":
      msg =
        `🎉 *Referral Milestone!* [DEVNET]\n\n` +
        `You've referred *${data.milestone}* traders!\n` +
        `💰 Bonus: *+${data.reward} SOL* sent to your wallet.\n\n` +
        `Keep sharing your link to unlock more rewards. 🦅`;
      break;
      // ── AUTO SELL ────────────────────────────────────────────
      case "auto_sell":
        msg = data.message || `🤖 *Auto Sell Triggered*`;
        break;
      case "pnl_card":
        if (data.buffer && botRef) {
          const { InputFile } = require("grammy");
          try { await botRef.api.sendPhoto(userId, new InputFile(Buffer.from(data.buffer), "pnl_card.png"), { reply_markup: data.kb }); } catch(e) { console.error("[PnL Card Notify]", e.message); }
        }
        return;
    // ── FALLBACK — never show raw JSON ───────────────────────
    default:
    case "limit_order":
      msg = data.message || `📌 *Limit Order Executed*`;
      break;
      return; // Silent — don't send unknown events to user
  }

  if (msg) await sendMsg(userId, msg);
}

// ════════════════════════════════════════════════════════════
// BROADCAST TO ALL USERS
// ════════════════════════════════════════════════════════════
async function notifyAllUsers(message, langFilter) {
  if (!botRef) return;
  const users = db.getAllUsers();
  let sent = 0, failed = 0;

  for (const user of users) {
    // Optional: only send to specific language
    if (langFilter && user.language !== langFilter) continue;
    try {
      await botRef.api.sendMessage(user.user_id, message);
      sent++;
      // Small delay to avoid Telegram rate limits
      await new Promise((r) => setTimeout(r, 50));
    } catch {
      failed++;
    }
  }
  console.log(`[Broadcast] Sent: ${sent} | Failed: ${failed}`);
  return { sent, failed };
}

// ════════════════════════════════════════════════════════════
// HELPER
// ════════════════════════════════════════════════════════════
async function sendMsg(userId, text) {
  try {
    await botRef.api.sendMessage(userId, text, { parse_mode: "Markdown" });
  } catch {
    try {
      await botRef.api.sendMessage(userId, text);
    } catch (e) {
      console.error(`[Notify] Failed to send to ${userId}:`, e.message);
    }
  }
}

module.exports = { setBotRef, notify, notifyAllUsers };
