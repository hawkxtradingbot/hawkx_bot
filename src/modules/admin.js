// Admin V12 — Complete
// Revenue, promoters, all user referral stats, download all data

const db         = require("../../database");
const config     = require("../../config");
const killSwitch = require("./killSwitch");
const { notifyAllUsers } = require("./notifications");
const fs         = require("fs");
const path       = require("path");

function isAdmin(userId) {
  return config.ADMIN_IDS.includes(String(userId));
}

// ── Admin Panel Main Screen ───────────────────────────────────
async function showAdminPanel(ctx) {
  if (!isAdmin(ctx.from.id)) return;

  const total = db.getTotalUsers();
  const ranks = db.getRankDistribution();
  const ks    = killSwitch.isActive();
  const now   = new Date().toDateString();
  const rev   = db.getRevenue(new Date(now).toISOString());

  const rankStr = ranks.map((r) => {
    const name = config.RANK_NAMES?.[r.rank] || `R${r.rank}`;
    return `${name}: ${r.cnt}`;
  }).join(" | ");

  const msg =
    `🦅 *HawkX Admin Panel* [DEVNET]\n\n` +
    `👥 Total Users: *${total}*\n` +
    `📊 Ranks: ${rankStr}\n\n` +
    `💰 Revenue Today: *${(rev?.total || 0).toFixed(4)} SOL*\n\n` +
    `Kill Switch: *${ks ? "🔴 ACTIVE" : "✅ OFF"}*\n\n` +
    `🧪 DEVNET MODE`;

  await ctx.reply(msg, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: ks ? "✅ Resume Trading" : "🔴 Kill Switch", callback_data: "admin_killswitch" }],
        [{ text: "📢 Broadcast",          callback_data: "admin_broadcast"       }],
        [{ text: "👑 Add Promoter",       callback_data: "admin_add_promoter"    },
         { text: "🗑 Remove Promoter",    callback_data: "admin_remove_promoter" }],
        [{ text: "💰 Revenue",            callback_data: "admin_revenue"         }],
        [{ text: "👥 All Users",          callback_data: "admin_users"           }],
        [{ text: "📊 Referral Stats",     callback_data: "admin_referral_stats"  }],
        [{ text: "📥 Download All Data",  callback_data: "admin_download"        }],
        [{ text: "🧪 Simulate +0.5 SOL",  callback_data: "admin_sim_trades"      }],
        [{ text: "📡 gRPC Health",         callback_data: "admin_grpc"            }],
        [{ text: "🚩 Suspicious",          callback_data: "admin_suspicious"      }],
        [{ text: "🔙 Close",               callback_data: "menu_main"             }],
      ],
    },
  });
}

// ── Admin Callback Handler ────────────────────────────────────
async function handleAdminCallback(ctx, action) {
  if (!isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery("❌ Admin only.");
  }

  // ── Kill Switch ───────────────────────────────────────────
  if (action === "admin_killswitch") {
    if (killSwitch.isActive()) {
      killSwitch.deactivate();
      await ctx.answerCallbackQuery("✅ Kill Switch OFF");
      await notifyAllUsers("✅ *HawkX Trading Resumed*\n\nTrading is now live again. 🦅");
    } else {
      killSwitch.activate();
      await ctx.answerCallbackQuery("🔴 Kill Switch ACTIVE");
      await notifyAllUsers(
        "🔴 *HawkX Trading Paused*\n\nAdmin has temporarily paused all trading.\nYour positions are safe."
      );
    }
    return showAdminPanel(ctx);

  // ── Add Promoter ──────────────────────────────────────────
  } else if (action === "admin_add_promoter") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_add_promoter");
    await ctx.reply("👑 Enter the Telegram user ID to make Promoter:");

  // ── Remove Promoter ───────────────────────────────────────
  } else if (action === "admin_remove_promoter") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_remove_promoter");
    await ctx.reply("🗑 Enter the Telegram user ID to remove Promoter:");

  // ── Revenue ───────────────────────────────────────────────
  } else if (action === "admin_revenue") {
    await ctx.answerCallbackQuery();
    const today     = db.getRevenue(new Date().toISOString().slice(0,10));
    const allTime   = db.getRevenue("2000-01-01");
    const promoters = db.getDb()
      .prepare("SELECT user_id, username FROM users WHERE promoter_status = 1")
      .all();

    let msg = `💰 *Revenue*\n\n`;
    msg += `Today: *${(today?.total||0).toFixed(6)} SOL*\n`;
    msg += `All Time: *${(allTime?.total||0).toFixed(6)} SOL*\n\n`;
    msg += `━━━━━━━━━━\n`;
    msg += `👑 *Promoters (${promoters.length}/100):*\n\n`;

    if (!promoters.length) {
      msg += `_No promoters yet._\n`;
    } else {
      promoters.forEach((p) => {
        const count  = db.getDirectReferralCount(p.user_id);
        const earned = db.getTotalEarnings(p.user_id);
        const pending = db.getPendingEarnings(p.user_id);
        msg += `• *${p.username || p.user_id}*\n`;
        msg += `  Referrals: ${count} | Earned: ${(earned?.total||0).toFixed(4)} SOL\n`;
        msg += `  Pending: ${(pending?.total||0).toFixed(6)} SOL\n\n`;
      });
    }

    await ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "admin_panel" }]] },
    });

  // ── All Users Referral Stats ──────────────────────────────
  } else if (action === "admin_referral_stats") {
    await ctx.answerCallbackQuery();
    const users = db.getAllUsers();
    let msg = `📊 *All Users Referral Stats*\n\n`;
    msg += `Total users: *${users.length}*\n\n`;
    msg += `━━━━━━━━━━\n`;

    let hasStats = false;
    for (const u of users) {
      const count   = db.getDirectReferralCount(u.user_id);
      const total   = db.getTotalEarnings(u.user_id);
      const pending = db.getPendingEarnings(u.user_id);
      const paid    = db.getPaidEarnings(u.user_id);
      if (count > 0 || (total?.total || 0) > 0) {
        hasStats = true;
        const isPromoter = u.promoter_status === 1 ? " 👑" : "";
        msg += `*${u.username || u.user_id}*${isPromoter}\n`;
        msg += `Referrals: ${count} | Earned: ${(total?.total||0).toFixed(4)} SOL\n`;
        msg += `Paid: ${(paid?.total||0).toFixed(4)} SOL | Pending: ${(pending?.total||0).toFixed(6)} SOL\n\n`;
      }
    }

    if (!hasStats) msg += `_No referral activity yet._`;

    // Split if too long
    if (msg.length > 4000) {
      msg = msg.slice(0, 3900) + "\n\n_...more users not shown. Use Download for full list._";
    }

    await ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "admin_panel" }]] },
    });

  // ── Download All Data ─────────────────────────────────────
  } else if (action === "admin_download") {
    await ctx.answerCallbackQuery("⏳ Generating report...");

    const users    = db.getAllUsers();
    const allTrades = db.getTradeHistory(0, 99999);
    const now      = new Date().toISOString().slice(0,10);

    let csv = "=== HAWKX ADMIN REPORT ===\n";
    csv += `Generated: ${new Date().toISOString()}\n`;
    csv += `Total Users: ${users.length}\n\n`;

    // Revenue
    const todayRev   = db.getRevenue(now);
    const totalRev   = db.getRevenue("2000-01-01");
    csv += `=== REVENUE ===\n`;
    csv += `Today: ${(todayRev?.total||0).toFixed(6)} SOL\n`;
    csv += `All Time: ${(totalRev?.total||0).toFixed(6)} SOL\n\n`;

    // Users
    csv += `=== ALL USERS ===\n\n`;
    for (const u of users) {
      const count   = db.getDirectReferralCount(u.user_id);
      const earned  = db.getTotalEarnings(u.user_id);
      const pending = db.getPendingEarnings(u.user_id);
      const rankName = config.RANK_NAMES?.[u.rank] || "Scout";
      csv += `────────────────────\n`;
      csv += `User: ${u.username||"Unknown"} (ID: ${u.user_id})\n`;
      csv += `Rank: ${rankName} | Volume: ${(u.cumulative_volume_sol||0).toFixed(4)} SOL\n`;
      csv += `Referrals: ${count} | Earned: ${(earned?.total||0).toFixed(6)} SOL\n`;
      csv += `Pending: ${(pending?.total||0).toFixed(6)} SOL | Promoter: ${u.promoter_status ? "Yes" : "No"}\n\n`;
    }

    // Write file
    const filePath = `/tmp/hawkx_report_${now}.txt`;
    fs.writeFileSync(filePath, csv);

    const { InputFile } = require("grammy");
    await ctx.replyWithDocument(
      new InputFile(fs.readFileSync(filePath), `HawkX_Report_${now}.txt`),
      { caption: `📥 HawkX Admin Report\nGenerated: ${now}\nUsers: ${users.length}` }
    );

    // Cleanup
    try { fs.unlinkSync(filePath); } catch {}

  // ── Broadcast ─────────────────────────────────────────────
  } else if (action === "admin_broadcast") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_broadcast");
    await ctx.reply(
      "📢 *Broadcast Message*\n\nType your message below.\nIt will be sent to ALL users.",
      { parse_mode: "Markdown" }
    );

  // ── View Users ────────────────────────────────────────────
  } else if (action === "admin_users") {
    await ctx.answerCallbackQuery();
    const users = db.getAllUsers();
    const lines = users.slice(0, 20).map((u, i) => {
      const name     = u.username || "Unknown";
      const rankName = config.RANK_NAMES?.[u.rank] || "Scout";
      const vol      = (u.cumulative_volume_sol || 0).toFixed(2);
      const promo    = u.promoter_status ? "👑" : "";
      return `${i+1}. ${promo}${name}\n   ID: ${u.user_id} | ${rankName} | ${vol} SOL`;
    });
    await ctx.reply(`👥 Users (${users.length} total)\n━━━━━━━━━━━━━━━━━━━\n${lines.join("\n━━━━━━━━━━━━━━━━━━━\n")}`);

  // ── Simulate Trades ───────────────────────────────────────
  } else if (action === "admin_sim_trades") {
    const users = db.getAllUsers();
    for (const u of users) db.addVolume(u.user_id, 0.5);
    await ctx.answerCallbackQuery(`✅ +0.5 SOL to ${users.length} users`);

  // ── gRPC Health ───────────────────────────────────────────
  } else if (action === "admin_grpc") {
    await ctx.answerCallbackQuery();
    const grpcStatus = db.getSysConfig("grpc_status")  || "unknown";
    const rpcPrimary = db.getSysConfig("rpc_primary")  || "unknown";
    await ctx.reply(
      `📡 *Infrastructure Health*\n\ngRPC: *${grpcStatus}*\nRPC: *${rpcPrimary}*\n\n_Running in background._`,
      { parse_mode: "Markdown" }
    );

  // ── Suspicious Activity ───────────────────────────────────
  } else if (action === "admin_suspicious") {
    await ctx.answerCallbackQuery();
    try {
      const flags = db.getDb()
        .prepare("SELECT * FROM suspicious_activity WHERE cleared = 0 ORDER BY flagged_at DESC LIMIT 10")
        .all();
      if (!flags.length) return ctx.reply("✅ No suspicious activity.");
      const lines = flags.map((f) => `• User ${f.user_id} | ${f.reason} | ${f.flagged_at?.slice(0,10)}`);
      await ctx.reply(`🚩 *Suspicious Activity*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("Suspicious activity table not set up yet.");
    }

  // ── Admin Panel Refresh ───────────────────────────────────
  } else if (action === "admin_panel") {
    return showAdminPanel(ctx);

  } else {
    await ctx.answerCallbackQuery("Unknown admin action.");
  }
}

// ── Admin Text Input Handler ──────────────────────────────────
// Call this from router.js text handler when pending starts with admin_
async function handleAdminTextInput(ctx, pendingKey) {
  const text    = ctx.message.text.trim();
  const adminId = ctx.from.id;

  if (pendingKey === "admin_add_promoter") {
    const targetId = parseInt(text);
    if (isNaN(targetId)) {
      await ctx.reply("❌ Invalid user ID. Enter numbers only.");
      return;
    }
    const targetUser = db.getUser(targetId);
    if (!targetUser) {
      await ctx.reply(`❌ User ${targetId} not found in database.`);
      db.setSysConfig(`pending_${adminId}`, "");
      return;
    }
    const count = db.getDb()
      .prepare("SELECT COUNT(*) as cnt FROM users WHERE promoter_status = 1")
      .get()?.cnt || 0;
    if (count >= 100) {
      await ctx.reply("❌ Max 100 promoter slots reached.");
      db.setSysConfig(`pending_${adminId}`, "");
      return;
    }
    db.updateUser(targetId, { promoter_status: 1 });
    db.setSysConfig(`pending_${adminId}`, "");
    await ctx.reply(
      `✅ *${targetUser.username || targetId}* is now a Promoter.\n\nThey now earn *35%* on L1 referrals.`,
      { parse_mode: "Markdown" }
    );
    // Notify the user
    try {
      await ctx.api.sendMessage(
        targetId,
        `🌟 *Congratulations!*\n\nYou have been made a *Promoter* on HawkX.\n\nYour L1 referral rate is now *35%* instead of 30%.\n\nShare your referral link and earn more! 🦅`,
        { parse_mode: "Markdown" }
      );
    } catch {}
    return;
  }

  if (pendingKey === "admin_remove_promoter") {
    const targetId = parseInt(text);
    if (isNaN(targetId)) {
      await ctx.reply("❌ Invalid user ID.");
      return;
    }
    const targetUser = db.getUser(targetId);
    if (!targetUser) {
      await ctx.reply(`❌ User ${targetId} not found.`);
      db.setSysConfig(`pending_${adminId}`, "");
      return;
    }
    db.updateUser(targetId, { promoter_status: 0 });
    db.setSysConfig(`pending_${adminId}`, "");
    await ctx.reply(
      `✅ *${targetUser.username || targetId}* Promoter status removed.\n\nThey now earn standard 30% on L1.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (pendingKey === "admin_broadcast") {
    const users = db.getAllUsers();
    let sent = 0, failed = 0;
    for (const u of users) {
      try {
        try {
          await ctx.api.sendMessage(u.user_id, `📢 *HawkX Announcement*\n\n${text}`, { parse_mode: "Markdown" });
        } catch {
          await ctx.api.sendMessage(u.user_id, `📢 HawkX Announcement\n\n${text}`);
        }
        sent++;
      } catch { failed++; }
    }
    db.setSysConfig(`pending_${adminId}`, "");
    await ctx.reply(`✅ Broadcast sent!\n\n✅ Delivered: ${sent}\n❌ Failed: ${failed}`);
    return;
  }

  db.setSysConfig(`pending_${adminId}`, "");
}

module.exports = { showAdminPanel, handleAdminCallback, handleAdminTextInput, isAdmin };
