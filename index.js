// ============================================================
require("dotenv").config();
const { Bot } = require("grammy");
const config  = require("./config");
const db      = require("./database");

const { setupRouter }          = require("./src/modules/router");
const { startRankCron } = require("./src/modules/ranks");
const { startPayoutCron } = require("./src/modules/referrals");
const { startHealthMonitor }   = require("./src/modules/rpcFailover");
const { setBotRef, notify }    = require("./src/modules/notifications");
const { monitorPositions, setDcaBotApi } = require("./src/modules/stopLoss");
const { isActive: killSwitchActive } = require("./src/modules/killSwitch");

// ── STARTUP LOG ───────────────────────────────────────────────
console.log("");
console.log("🦅 HawkX Bot V11 — DEVNET MODE");
console.log("================================");
console.log(`Network:     ${config.NETWORK}`);
console.log(`RPC:         ${config.HELIUS_RPC_URL}`);
console.log(`DB:          ${config.DB_PATH}`);
console.log(`Mock Trades: ${config.MOCK_TRADES}`);
console.log(`Version:     V11`);
console.log("");

// ── INIT DB ───────────────────────────────────────────────────
db.getDb();
console.log("[DB] ✅ SQLite WAL ready (V11 schema)");

// ── INIT BOT ──────────────────────────────────────────────────
const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
setBotRef(bot);
console.log("[Bot] ✅ Telegram bot initialized");

// ── #29 RATE LIMIT MIDDLEWARE (safe) ─────────────────────────
bot.use(async (ctx, next) => {
  try {
    const tradeActions = ["trade_quickbuy", "devnet_mock_buy", "buy_confirm_", "sell_confirm_"];
    const isTradeAction =
      ctx.callbackQuery &&
      tradeActions.some((a) => ctx.callbackQuery.data?.startsWith(a));

    if (isTradeAction && ctx.from) {
      const userId = ctx.from.id;
      const user   = db.getUser(userId);
      if (user && user.trade_count_minute !== undefined) {
        const now      = Date.now();
        const winStart = user.trade_window_start
          ? new Date(user.trade_window_start).getTime()
          : now;
        const elapsed  = (now - winStart) / 1000;

        if (elapsed > 60) {
          db.resetTradeRateLimit(userId, new Date().toISOString());
        } else if ((user.trade_count_minute || 0) >= 10) {
          await ctx.answerCallbackQuery(
            "⏳ Too many trades — wait 60 seconds.",
            { show_alert: true }
          );
          return;
        }
        db.incrementTradeRateLimit(userId);
      }
    }
  } catch (e) {
    console.log("[Middleware] Rate limit skipped:", e.message.slice(0, 50));
  }
  return next();
});

// ── SETUP ROUTER ─────────────────────────────────────────────
const notifyCallback = (userId, eventType, data) =>
  notify(userId, eventType, data);

setupRouter(bot);
console.log("[Router] ✅ Commands and callbacks registered");

// ── ERROR HANDLER ────────────────────────────────────────────
bot.catch((err) => {
  if (err.message?.includes("query is too old")) return;
  const isParseError = err.message?.includes("can't parse entities") || err.message?.includes("parse entities");
  if (isParseError) {
    const payload = err.error?.payload || {};
    const preview = String(payload.text || payload.caption || "").slice(0, 200);
    console.error("[Bot Error] Markdown parse error — message preview:", JSON.stringify(preview));
    console.error("[Bot Error]", err.message);
  } else {
    console.error("[Bot Error]", err.message);
  }
});
// ── Channel message handler — detect CA from channels ──────
bot.on("channel_post", async (ctx) => {
  try {
    const channelId = String(ctx.chat.id);
    const text      = ctx.channelPost?.text || ctx.channelPost?.caption || "";
    if (!text) return;

    // Find Solana CA pattern (32-44 base58 chars)
    const caMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
    if (!caMatch) return;

    const ca = caMatch[0];

    // Find all users following this channel
    const followers = db.getDb().prepare(
      "SELECT * FROM copy_channels WHERE channel_id = ? AND status = 'active'"
    ).all(channelId);

    if (!followers.length) return;

    const { mockBuy } = require("./src/modules/executor");

    for (const follower of followers) {
      try {
        const user = db.getUser(follower.user_id);
        if (!user) continue;
        const fakeCtx = {
          reply: async (msg, opts) => {
            try { await bot.api.sendMessage(follower.user_id, msg, opts); } catch {}
          },
          chat: { id: follower.user_id },
          from: { id: follower.user_id },
        };
        await mockBuy(fakeCtx, user, ca, follower.buy_amount || 0.1, "copy_channel", channelId);
        db.getDb().prepare(
          "UPDATE copy_channels SET signals_caught = signals_caught + 1, trades_executed = trades_executed + 1 WHERE id = ?"
        ).run(follower.id);
      } catch {}
    }
  } catch {}
});
// ── START POLLING ────────────────────────────────────────────
bot.start({
  onStart: async (info) => {
    console.log("");
    console.log(`[Bot] ✅ @${info.username} is LIVE on DEVNET`);
    console.log(
      `[Kill-Switch] ${killSwitchActive() ? "🔴 ACTIVE" : "✅ OFF"}`
    );
    console.log("[Mode System] ✅ Beginner/Pro toggle active (#01)");
    console.log("[Rate Limit]  ✅ 10 trades/min per user (#29)");
    console.log("");
    console.log("─────────────────────────────────");
    console.log("🦅 HawkX V11 Devnet Ready!");
    console.log("Always Watching. Always First.");
    console.log("─────────────────────────────────");
    console.log("");
    console.log("TEST COMMANDS:");
    console.log("  /start       — Register (Beginner Mode default)");
    console.log("  /faucet      — Get free devnet SOL");
    console.log("  /mockbuy     — Simulate a buy trade");
    console.log("  /mocksell    — Simulate a sell");
    console.log("  /addvolume 5 — Add 5 SOL volume (rank up)");
    console.log("  /mystats     — Check your stats + rank");
    console.log("  /portfolio   — View open positions");
    console.log("  /referrals   — Referral stats");
    console.log("  /admin       — Admin panel");
    console.log("");
    console.log("V11 CALLBACKS:");
    console.log("  mode_set_pro       — Switch to Pro Mode");
    console.log("  mode_set_beginner  — Switch to Beginner Mode");
    console.log("  menu_watchlist     — Open Watchlist");
    console.log("  set_sap            — Set Security PIN");
    console.log("");
  },
});

// ── BACKGROUND JOBS ──────────────────────────────────────────
startRankCron(notifyCallback);
startPayoutCron(bot);
startHealthMonitor();

// Give DCA cron access to the bot API for buy notifications
try { setDcaBotApi(bot.api); } catch {}
// Position monitor every 30s (#34 — retry on fail)
let positionMonitorErrors = 0;
setInterval(async () => {
  try {
    await monitorPositions(notifyCallback);
    positionMonitorErrors = 0; // Reset error count on success
  } catch (e) {
    positionMonitorErrors++;
    console.error(`[Monitor] Error #${positionMonitorErrors}:`, e.message);
    if (positionMonitorErrors >= 5) {
      console.error("[Monitor] ⚠️ 5 consecutive errors — check stopLoss.js");
    }
  }
}, 5000);

console.log("[Jobs] ✅ Trial cron, rank cron, payout cron, position monitor started");

// ── GRACEFUL SHUTDOWN ────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\n[HawkX V11] Shutting down gracefully...");
  process.exit(0);
});

process.on("uncaughtException", (e) => {
  console.error("[Uncaught Exception]", e.message);
  // Don't exit — keep bot running
});

process.on("unhandledRejection", (reason) => {
  console.error("[Unhandled Rejection]", reason);
});

const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("HawkX Running 🦅"));
app.listen(3000, () => console.log("[Web] Health-check on port 3000"));
