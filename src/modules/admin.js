// M32 — Admin Panel (Devnet)
const db = require("../../database");
const config = require("../../config");
const killSwitch = require("./killSwitch");
const { notifyAllUsers } = require("./notifications");

function isAdmin(userId) {
  return config.ADMIN_IDS.includes(String(userId));
}

async function showAdminPanel(ctx) {
  if (!isAdmin(ctx.from.id)) return;

  const total = db.getTotalUsers();
  const ranks = db.getRankDistribution();
  const ks = killSwitch.isActive();
  const now = new Date().toDateString();
  const rev = db.getRevenue(new Date(now).toISOString());

  const msg =
    `🦅 *HawkX Admin* [DEVNET]\n\n` +
    `👥 Users: ${total}\n` +
    `📊 Ranks: ${ranks.map((r) => `R${r.rank}:${r.cnt}`).join(" ")}\n` +
    `💰 Revenue Today: ${(rev?.total || 0).toFixed(4)} SOL (simulated)\n` +
    `🔴 Kill-Switch: *${ks ? "ACTIVE" : "OFF"}*\n\n` +
    `🧪 DEVNET MODE`;

  await ctx.reply(msg, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: ks ? "✅ Resume" : "🔴 Kill-Switch ON",
            callback_data: "admin_killswitch",
          },
        ],
        [{ text: "📢 Broadcast", callback_data: "admin_broadcast" }],
        [{ text: "🧪 Simulate 10 Trades", callback_data: "admin_sim_trades" }],
        [{ text: "🔙 Close", callback_data: "menu_main" }],
      ],
    },
  });
}

async function handleAdminCallback(ctx, action) {
  if (!isAdmin(ctx.from.id)) return;

  if (action === "admin_killswitch") {
    killSwitch.isActive() ? killSwitch.deactivate() : killSwitch.activate();
    await ctx.answerCallbackQuery(
      killSwitch.isActive() ? "🔴 Kill-switch ON" : "✅ Resumed",
    );
    await showAdminPanel(ctx);
  } else if (action === "admin_broadcast") {
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_broadcast");
    await ctx.reply("Type your broadcast message:");
  } else if (action === "admin_sim_trades") {
    // Simulate volume for all users
    const users = db.getAllUsers();
    for (const u of users) {
      db.addVolume(u.user_id, 0.5);
    }
    await ctx.answerCallbackQuery(
      `Simulated 0.5 SOL volume for ${users.length} users`,
    );
  }
}

module.exports = { showAdminPanel, handleAdminCallback, isAdmin };
