const db = require("../../../database");
const { safeEdit, showWatchlistScreen, showTokenScanner } = require("./helpers.routes");

async function showAlertMgmtScreen(ctx, userId, wlId) {
  const item = db.getWatchlist(userId).find(w => w.id === wlId);
  if (!item) return showWatchlistScreen(ctx, userId);
  const name = item.token_name || item.token_ca.slice(0,8);
  const alerts = db.getPriceAlerts(userId).filter(a => a.token_ca === item.token_ca);
  let msg = "🔔 *" + name + " Alerts*\n\n━━━━━━━━━━━━━━━━━━━\n💡 Get notified when this token hits a target\n▸ Use K/M for market cap (50K, 1M)\n▸ Use decimals for price (0.0005)\n▸ Set multiple alerts per token\n━━━━━━━━━━━━━━━━━━━\n";
  const kb = { inline_keyboard: [] };
  if (!alerts.length) {
    msg += "_No alerts set for this token._\n━━━━━━━━━━━━━━━━━━━";
  } else {
    alerts.forEach((a, i) => {
      const val = a.target_price >= 1000000 ? "$"+(a.target_price/1000000).toFixed(1)+"M" : a.target_price >= 1000 ? "$"+(a.target_price/1000).toFixed(0)+"K" : "$"+a.target_price;
      const dir = a.direction === "mcap_above" ? "MC▲" : "Price▲";
      msg += (i+1) + ". " + dir + " " + val + "\n";
      kb.inline_keyboard.push([{ text: "🗑 Delete Alert " + (i+1) + " (" + dir + " " + val + ")", callback_data: "wl_alert_del_" + a.id + "_" + wlId }]);
    });
    msg += "━━━━━━━━━━━━━━━━━━━";
  }
  kb.inline_keyboard.push([{ text: "➕ Add New Alert", callback_data: "wl_alert_add_" + wlId }]);
  kb.inline_keyboard.push([{ text: "← Back to Watchlist", callback_data: "menu_watchlist" }]);
  const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
  const mid = ctx.callbackQuery?.message?.message_id || parseInt(db.getSysConfig("wl_alert_msg_" + userId) || db.getSysConfig("wl_msg_" + userId) || "0");
  try {
    if (mid && chatId) {
      await ctx.api.editMessageText(chatId, mid, msg, { parse_mode: "Markdown", reply_markup: kb });
      db.setSysConfig("wl_msg_" + userId, String(mid));
    } else {
      const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
      db.setSysConfig("wl_msg_" + userId, String(s.message_id));
    }
  } catch(e) {
    if (e?.description?.includes("not modified")) return;
    const s = await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
    db.setSysConfig("wl_msg_" + userId, String(s.message_id));
  }
}
const { buildWatchlistMenu } = require("../keyboards");

async function handleWatchlistCallbacks(ctx, data, userId, user, bot, ks) {
    if (data === "menu_watchlist") {
      await ctx.answerCallbackQuery();
      return showWatchlistScreen(ctx, userId);
    }

    if (data === "watchlist_add") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply("⭐ Paste token CA to add to watchlist:");
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "watchlist_add_ca");
      return true;
    }

    if (data.startsWith("watchlist_remove_")) {
      const id = parseInt(data.replace("watchlist_remove_", ""));
      db.removeFromWatchlist(userId, id);
      await ctx.answerCallbackQuery("🗑 Removed.");
      return safeEdit(
        ctx,
        "⭐ *Watchlist*",
        buildWatchlistMenu(db.getWatchlist(userId)),
      );
    }


    if (data.startsWith("wl_remove_") && !data.startsWith("wl_remove_confirm_")) {
      const id = parseInt(data.replace("wl_remove_", ""));
      const item = db.getWatchlist(userId).find(w => w.id === id);
      if (!item) { await ctx.answerCallbackQuery("Not found."); return true; }
      await ctx.answerCallbackQuery();
      const name = item.token_name || item.token_ca.slice(0,8);
      // Edit the watchlist message itself into a confirm prompt (in place)
      try {
        await ctx.editMessageText("🗑 *Remove " + name + " from watchlist?*\n\nThis also removes its alerts.", {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[
            { text: "✅ Yes, Remove", callback_data: "wl_remove_confirm_" + id },
            { text: "← Cancel", callback_data: "menu_watchlist" },
          ]]}
        });
      } catch {}
      return true;
    }

    if (data.startsWith("wl_remove_confirm_")) {
      const id = parseInt(data.replace("wl_remove_confirm_", ""));
      const item = db.getWatchlist(userId).find(w => w.id === id);
      if (item) {
        // Remove token's alerts too
        const alerts = db.getPriceAlerts(userId).filter(a => a.token_ca === item.token_ca);
        alerts.forEach(a => db.getDb().prepare("DELETE FROM price_alerts WHERE id = ? AND user_id = ?").run(a.id, userId));
        db.removeFromWatchlist(userId, id);
      }
      await ctx.answerCallbackQuery("🗑 Removed.");
      // The confirm prompt IS the watchlist message — refresh it in place
      return showWatchlistScreen(ctx, userId);
    }

    if (data === "wl_cancel_remove") {
      await ctx.answerCallbackQuery("Cancelled.");
      try { await ctx.api.deleteMessage(ctx.chat.id, ctx.callbackQuery.message.message_id); } catch {}
      return true;
    }

    if (data.startsWith("wl_buy_")) {
      const id = parseInt(data.replace("wl_buy_", ""));
      const item = db.getWatchlist(userId).find(w => w.id === id);
      if (!item) { await ctx.answerCallbackQuery("Not found."); return true; }
      await ctx.answerCallbackQuery();
      await showTokenScanner(ctx, user, item.token_ca);
      return true;
    }

    if (data.startsWith("wl_alert_") && !data.startsWith("wl_alert_add_") && !data.startsWith("wl_alert_del_")) {
      const id = parseInt(data.replace("wl_alert_", ""));
      const item = db.getWatchlist(userId).find(w => w.id === id);
      if (!item) { await ctx.answerCallbackQuery("Not found."); return true; }
      await ctx.answerCallbackQuery();
      return showAlertMgmtScreen(ctx, userId, id);
    }

    if (data.startsWith("wl_alert_add_")) {
      const id = parseInt(data.replace("wl_alert_add_", ""));
      const item = db.getWatchlist(userId).find(w => w.id === id);
      if (!item) { await ctx.answerCallbackQuery("Not found."); return true; }
      await ctx.answerCallbackQuery();
      // Save the alert mgmt screen msg id so we can edit it back after input
      const mgmtMsgId = ctx.callbackQuery?.message?.message_id;
      if (mgmtMsgId) db.setSysConfig("wl_alert_msg_" + userId, String(mgmtMsgId));
      db.setSysConfig("alert_pending_ca_" + userId, item.token_ca);
      db.setSysConfig("alert_pending_name_" + userId, item.token_name || item.token_ca.slice(0,8));
      db.setSysConfig("alert_pending_wlid_" + userId, String(id));
      const m = await ctx.reply("🔔 *Set Alert for " + (item.token_name || item.token_ca.slice(0,8)) + "*\n\nEnter target price or market cap (e.g. 0.0005 / 50K / 1M):", { parse_mode: "Markdown" });
      db.setSysConfig("prompt_msg_" + userId, String(m.message_id));
      db.setSysConfig("pending_" + userId, "wl_alert_target");
      return true;
    }

    if (data.startsWith("wl_alert_del_")) {
      const parts = data.replace("wl_alert_del_", "").split("_");
      const alertId = parseInt(parts[0]);
      const wlId = parseInt(parts[1]);
      db.getDb().prepare("DELETE FROM price_alerts WHERE id = ? AND user_id = ?").run(alertId, userId);
      await ctx.answerCallbackQuery("🗑 Alert deleted.");
      return showAlertMgmtScreen(ctx, userId, wlId);
    }

    return false;
}

module.exports = { handleWatchlistCallbacks, showAlertMgmtScreen };
