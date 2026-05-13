const db = require("../../../database");
const { showAdminPanel, handleAdminCallback, isAdmin } = require("../admin");

async function handleAdminCallbacks(ctx, data, userId, user, bot, ks) {
    // ── ADMIN ─────────────────────────────────────────────────
    if (data.startsWith("admin_")) {
      if (!isAdmin(userId)) {
        await ctx.answerCallbackQuery("❌ Admin only.");
        return true;
      }
      return handleAdminCallback(ctx, data);
    }
    // ── DEFAULT ───────────────────────────────────────────────

    return false;
}

module.exports = { handleAdminCallbacks };
