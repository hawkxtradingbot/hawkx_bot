const fs = require('fs');
let c = fs.readFileSync('src/modules/routes/callbacks.menu.js', 'utf8');

const oldCode = `    if (data === "menu_stats") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const today = db.getTodayStats(userId, freshUser.active_wallet_id);
      const allTime = db.getUserStats(userId);
      const weekly = db.getWeeklyPnl(userId);
      const monthly = db.getMonthlyPnl(userId);
      const vol = freshUser.cumulative_volume_sol || 0;
      const { RANKS } = require("../keyboards");
      const rank = RANKS[freshUser.rank] || RANKS[1];
      let msg = \`📊 *Your Stats* [DEVNET]\\n\\n\`;
      msg += \`🏅 Rank: *\${rank.name}* (\${freshUser.rank}/7)\\n\`;
      msg += \`💎 Fee: *\${rank.fee.toFixed(2)}%*\\n\`;
      msg += \`📈 Total Volume: *\${vol.toFixed(4)} SOL*\\n\\n\`;
      const ts = (today.pnl || 0) >= 0 ? "+" : "";
      msg += \`*Today:* P&L: *\${ts}\${(today.pnl || 0).toFixed(4)} SOL* · \${today.trades || 0} trades · \${today.winRate || 0}% win\\n\`;
      const ws = weekly >= 0 ? "+" : "";
      const ms = monthly >= 0 ? "+" : "";
      msg += \`*Weekly:* *\${ws}\${weekly.toFixed(4)} SOL*\\n\`;
      msg += \`*Monthly:* *\${ms}\${monthly.toFixed(4)} SOL*\\n\`;
      msg += \`*Win Rate:* \${allTime.winRate || 0}% · *Loss Rate:* \${allTime.lossRate || 0}%\\n\`;
      return ctx.reply(msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🏅 My Rank Card", callback_data: "gen_rank_card" }],[{ text: "🔄 Refresh", callback_data: "menu_stats" }],[{ text: "← Back", callback_data: "menu_main" }]] } });
    }`;

const newCode = `    if (data === "menu_stats") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const today = db.getTodayStats(userId, freshUser.active_wallet_id);
      const allTime = db.getUserStats(userId);
      const weekly = db.getWeeklyPnl(userId);
      const monthly = db.getMonthlyPnl(userId);
      const vol = freshUser.cumulative_volume_sol || 0;
      const { RANKS } = require("../keyboards");
      const rank = RANKS[freshUser.rank] || RANKS[1];
      const ts = (today.pnl || 0) >= 0 ? "+" : "";
      const ws = weekly >= 0 ? "+" : "";
      const ms = monthly >= 0 ? "+" : "";
      let msg = \`📊 *Your Trading Stats*\\n\\n\`;
      msg += \`🏅 *\${rank.name}* (\${freshUser.rank}/7) — Fee: *\${rank.fee.toFixed(2)}%*\\n\`;
      msg += \`━━━━━━━━━━━━━━━━━━━\\n\\n\`;
      msg += \`📅 *Today*\\n\`;
      msg += \`P&L: *\${ts}\${(today.pnl || 0).toFixed(4)} SOL* · *\$\${Math.abs((today.pnl||0)*150).toFixed(2)}*\\n\`;
      msg += \`Trades: *\${today.trades || 0}* · Win Rate: *\${today.winRate || 0}%*\\n\\n\`;
      msg += \`📆 *This Week:* *\${ws}\${weekly.toFixed(4)} SOL*\\n\`;
      msg += \`🗓 *This Month:* *\${ms}\${monthly.toFixed(4)} SOL*\\n\\n\`;
      msg += \`📈 *All Time*\\n\`;
      msg += \`Volume: *\${vol.toFixed(4)} SOL*\\n\`;
      msg += \`Win: *\${allTime.winRate || 0}%* · Loss: *\${allTime.lossRate || 0}%*\\n\`;
      msg += \`━━━━━━━━━━━━━━━━━━━\`;
      const kb = { inline_keyboard: [
        [{ text: "📤 Today's Card", callback_data: "stats_card_today" }, { text: "📤 Weekly Card", callback_data: "stats_card_week" }],
        [{ text: "📤 Monthly Card", callback_data: "stats_card_month" }, { text: "🏅 Rank Card", callback_data: "gen_rank_card" }],
        [{ text: "🔄 Refresh", callback_data: "menu_stats" }, { text: "← Back", callback_data: "menu_main" }],
      ]};
      return ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
    }

    if (data === "stats_card_today" || data === "stats_card_week" || data === "stats_card_month") {
      await ctx.answerCallbackQuery("⏳ Generating card...");
      const freshUser = db.getUser(userId);
      const { RANKS } = require("../keyboards");
      const rank = RANKS[freshUser.rank] || RANKS[1];
      const period = data === "stats_card_today" ? "today" : data === "stats_card_week" ? "week" : "month";
      const today = db.getTodayStats(userId, freshUser.active_wallet_id);
      const weekly = db.getWeeklyPnl(userId);
      const monthly = db.getMonthlyPnl(userId);
      const allTime = db.getUserStats(userId);
      const pnlSol = period === "today" ? (today.pnl || 0) : period === "week" ? weekly : monthly;
      const { generateStatsCard } = require("../statsCard");
      const result = await generateStatsCard({
        username: freshUser.username || "Trader",
        rankName: rank.name,
        rankNum: freshUser.rank || 1,
        period,
        pnlSol,
        pnlUsd: Math.abs(pnlSol * 150),
        trades: today.trades || 0,
        winRate: allTime.winRate || 0,
        volume: freshUser.cumulative_volume_sol || 0,
      });
      if (result.type === "photo") {
        const { InputFile } = require("grammy");
        await ctx.replyWithDocument(new InputFile(Buffer.from(result.buffer), \`hawkx_\${period}_pnl.png\`));
      } else {
        await ctx.reply(result.text, { parse_mode: "Markdown" });
      }
      return true;
    }`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  fs.writeFileSync('src/modules/routes/callbacks.menu.js', c);
  console.log('Done');
} else {
  console.log('Pattern not found');
}
