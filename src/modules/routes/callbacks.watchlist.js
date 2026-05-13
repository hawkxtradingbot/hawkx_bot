const db = require("../../../database");
const { safeEdit } = require("./helpers.routes");
const { buildWatchlistMenu } = require("../keyboards");

async function handleWatchlistCallbacks(ctx, data, userId, user, bot, ks) {
    if (data === "menu_watchlist") {
      await ctx.answerCallbackQuery();
      const items = db.getWatchlist(userId);
      return safeEdit(
        ctx,
        `⭐ *Watchlist*\n\nTrack tokens and get alerts.`,
        buildWatchlistMenu(items),
      );
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


    return false;
}

module.exports = { handleWatchlistCallbacks };
