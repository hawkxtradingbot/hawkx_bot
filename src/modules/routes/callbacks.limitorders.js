const db = require("../../../database");
const { buildTokenOrdersScreen, showLimitOrdersScreen } = require("./helpers.routes");
const { buildLimitOrdersMenu, buildLimitOrderSetupMenu } = require("../keyboards");

async function handleLimitOrderCallbacks(ctx, data, userId, user, bot, ks) {
    // ── LIMIT ORDERS ──────────────────────────────────────────
    if (data.startsWith("lo_pause_")) {
      const id = parseInt(data.replace("lo_pause_", ""));
      db.pauseLimitOrder(userId, id);
      await ctx.answerCallbackQuery("✅ Updated!");
      const curMsg = ctx.callbackQuery?.message?.message_id;
      if (curMsg) db.setSysConfig(`lo_msg_${userId}`, String(curMsg));
      const returnCa = db.getSysConfig(`lo_pending_ca_${userId}`) || "";
      if (returnCa) return buildTokenOrdersScreen(ctx, userId, returnCa);
      return showLimitOrdersScreen(ctx, userId);
    }

    if (data.startsWith("lo_del_")) {
      const id = parseInt(data.replace("lo_del_", ""));
      db.cancelLimitOrder(userId, id);
      await ctx.answerCallbackQuery("🗑 Deleted!");
      const curMsg2 = ctx.callbackQuery?.message?.message_id;
      if (curMsg2) db.setSysConfig(`lo_msg_${userId}`, String(curMsg2));
      const returnCa2 = db.getSysConfig(`lo_pending_ca_${userId}`) || "";
      if (returnCa2) return buildTokenOrdersScreen(ctx, userId, returnCa2);
      return showLimitOrdersScreen(ctx, userId);
    }

    if (data.startsWith("lo_token_") && !data.startsWith("lo_token_ca_")) {
      const posId = parseInt(data.replace("lo_token_", ""));
      const pos = db.getPosition(posId, userId);
      if (!pos) { await ctx.answerCallbackQuery("Not found."); return true; }
      await ctx.answerCallbackQuery();
      const curMsg3 = ctx.callbackQuery?.message?.message_id;
      if (curMsg3) db.setSysConfig(`lo_msg_${userId}`, String(curMsg3));
      db.setSysConfig(`lo_pending_ca_${userId}`, pos.token_ca);
      db.setSysConfig(`lo_pending_name_${userId}`, pos.token_name || pos.token_ca.slice(0,8));
      return buildTokenOrdersScreen(ctx, userId, pos.token_ca, false);
    }

    if (data.startsWith("lo_token_ca_")) {
      await ctx.answerCallbackQuery();
      const caKey3 = data.replace("lo_token_ca_", "");
      const ca = db.getSysConfig(`lo_ca_map_${userId}_${caKey3}`) || caKey3;
      const curMsg4 = ctx.callbackQuery?.message?.message_id;
      if (curMsg4) db.setSysConfig(`lo_msg_${userId}`, String(curMsg4));
      return buildTokenOrdersScreen(ctx, userId, ca);
    }

    if (data === "lo_wallet_expand") {
      db.setSysConfig(`lo_wallet_expanded_${userId}`, "1");
      await ctx.answerCallbackQuery();
      const curMsg5 = ctx.callbackQuery?.message?.message_id;
      if (curMsg5) db.setSysConfig(`lo_msg_${userId}`, String(curMsg5));
      return showLimitOrdersScreen(ctx, userId);
    }

    if (data === "lo_wallet_collapse") {
      db.setSysConfig(`lo_wallet_expanded_${userId}`, "0");
      await ctx.answerCallbackQuery();
      const curMsg6 = ctx.callbackQuery?.message?.message_id;
      if (curMsg6) db.setSysConfig(`lo_msg_${userId}`, String(curMsg6));
      return showLimitOrdersScreen(ctx, userId);
    }

    if (data.startsWith("lo_setwallet_")) {
      const wId = parseInt(data.replace("lo_setwallet_", ""));
      db.updateUser(userId, { active_wallet_id: wId });
      db.setSysConfig(`lo_wallet_expanded_${userId}`, "0");
      await ctx.answerCallbackQuery("✅ Wallet set!");
      const curMsg7 = ctx.callbackQuery?.message?.message_id;
      if (curMsg7) db.setSysConfig(`lo_msg_${userId}`, String(curMsg7));
      return showLimitOrdersScreen(ctx, userId);
    }

    if (data.startsWith("lo_tok_wallet_expand_")) {
      await ctx.answerCallbackQuery();
      const caKeyExp = data.replace("lo_tok_wallet_expand_", "");
      const ca = db.getSysConfig(`lo_ca_map_${userId}_${caKeyExp}`) || caKeyExp;
      const curMsg8 = ctx.callbackQuery?.message?.message_id;
      if (curMsg8) db.setSysConfig(`lo_msg_${userId}`, String(curMsg8));
      return buildTokenOrdersScreen(ctx, userId, ca, true);
    }

    if (data.startsWith("lo_tok_wallet_") && !data.startsWith("lo_tok_wallet_expand_")) {
      await ctx.answerCallbackQuery("✅ Wallet set!");
      const parts = data.replace("lo_tok_wallet_", "").split("_");
      const caKey4 = parts[0];
      const wId2 = parseInt(parts[1]);
      const ca4 = db.getSysConfig(`lo_ca_map_${userId}_${caKey4}`) || caKey4;
      db.setSysConfig(`lo_token_wallet_${userId}_${ca4}`, String(wId2));
      const curMsg9 = ctx.callbackQuery?.message?.message_id;
      if (curMsg9) db.setSysConfig(`lo_msg_${userId}`, String(curMsg9));
      return buildTokenOrdersScreen(ctx, userId, ca4, false);
    }

    if (data === "lo_new_buy") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`lo_pending_ca_${userId}`, "");
      const existingCa = db.getSysConfig(`lo_pending_ca_${userId}`) || "";
      db.setSysConfig(`lo_type_${userId}`, "buy");
      if (existingCa) {
        const { getMockPrice: gmp3 } = require("../executor");
        const mp3 = gmp3(existingCa);
        const m = await ctx.reply(`🟢 *Add Limit Buy*\n\nToken: ${db.getSysConfig(`lo_pending_name_${userId}`) || existingCa.slice(0,8)}\nPrice: ${mp3.toFixed(8)}\n\nEnter target price:`, { parse_mode: "Markdown" });
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "lo_set_price");
      } else {
        const m = await ctx.reply("🟢 *New Limit Buy*\n\nPaste token CA:", { parse_mode: "Markdown" });
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "lo_paste_ca");
      }
      return true;
    }

    if (data === "lo_add_buy") {
      await ctx.answerCallbackQuery();
      const existingCa = db.getSysConfig(`lo_pending_ca_${userId}`) || "";
      db.setSysConfig(`lo_type_${userId}`, "buy");
      const { getMockPrice: gmp3b } = require("../executor");
      const mp3b = gmp3b(existingCa);
      const curMsg10 = ctx.callbackQuery?.message?.message_id;
      if (curMsg10) db.setSysConfig(`lo_msg_${userId}`, String(curMsg10));
      const m = await ctx.reply(`🟢 *Add Limit Buy*\n\nToken: ${db.getSysConfig(`lo_pending_name_${userId}`) || existingCa.slice(0,8)}\nPrice: ${mp3b.toFixed(8)}\n\nEnter target price:`, { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "lo_set_price");
      return true;
    }

    if (data === "lo_new_sell" || data === "lo_add_sell") {
      await ctx.answerCallbackQuery();
      const existingCa2 = db.getSysConfig(`lo_pending_ca_${userId}`) || "";
      db.setSysConfig(`lo_type_${userId}`, "sell");
      const curMsg11 = ctx.callbackQuery?.message?.message_id;
      if (curMsg11) db.setSysConfig(`lo_msg_${userId}`, String(curMsg11));
      if (existingCa2 && data === "lo_add_sell") {
        const { getMockPrice: gmp4 } = require("../executor");
        const mp4 = gmp4(existingCa2);
        const m2 = await ctx.reply(`🔴 *Add Limit Sell*\n\nToken: ${db.getSysConfig(`lo_pending_name_${userId}`) || existingCa2.slice(0,8)}\nPrice: ${mp4.toFixed(8)}\n\nEnter sell % (e.g. 50):`, { parse_mode: "Markdown" });
        db.setSysConfig(`prompt_msg_${userId}`, String(m2.message_id));
        db.setSysConfig(`pending_${userId}`, "lo_set_sell_pct_direct");
        return true;
      }
      const positions2 = db.getAllOpenPositions().filter(p => p.user_id === userId);
      if (!positions2.length) { await ctx.answerCallbackQuery("No open positions!"); return true; }
      const kb3 = { inline_keyboard: [
        ...Array.from({length: Math.ceil(positions2.slice(0,9).length/3)}, (_, i) =>
          positions2.slice(i*3, i*3+3).map(p => ({
            text: `📊 ${p.token_name||p.token_ca.slice(0,6)}`,
            callback_data: `lo_token_${p.position_id}`
          }))
        ),
        [{ text: "← Back", callback_data: "limit_orders_refresh" }]
      ]};
      try { await ctx.editMessageText("🔴 *New Limit Sell*\n\nSelect position:", { parse_mode: "Markdown", reply_markup: kb3 }); } catch {}
      return true;
    }

    if (data === "menu_limit_orders" || data === "limit_orders_refresh") {
      await ctx.answerCallbackQuery();
      // Save message ID for same page editing
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (msgId) db.setSysConfig(`lo_msg_${userId}`, String(msgId));
      return showLimitOrdersScreen(ctx, userId);
    }

    if (data.startsWith("limit_token_")) {
      const posId = parseInt(data.replace("limit_token_", ""));
      const pos = db.getPosition(posId, userId);
      const orders = db.getLimitOrders(userId);
      const hasBuy = orders.some(
        (o) => o.order_type === "buy" && pos && o.token_ca === pos.token_ca,
      );
      const hasSell = orders.some(
        (o) => o.order_type === "sell" && pos && o.token_ca === pos.token_ca,
      );
      await ctx.answerCallbackQuery();
      const name = pos?.token_name || pos?.token_ca?.slice(0, 8) || "Token";
      return safeEdit(
        ctx,
        `📋 *Limit Orders — ${name}*`,
        buildLimitOrderSetupMenu(pos, hasBuy, hasSell),
      );
    }

    if (data.startsWith("limit_cancel_")) {
      const id = parseInt(data.replace("limit_cancel_", ""));
      db.cancelLimitOrder(userId, id);
      await ctx.answerCallbackQuery("✅ Order cancelled.");
      return safeEdit(
        ctx,
        "📋 *Limit Orders*",
        buildLimitOrdersMenu(db.getLimitOrders(userId)),
      );
    }


    return false;
}

module.exports = { handleLimitOrderCallbacks };
