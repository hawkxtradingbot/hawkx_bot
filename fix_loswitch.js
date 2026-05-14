const fs = require('fs');
let c = fs.readFileSync('src/modules/routes/callbacks.limitorders.js', 'utf8');

const switchHandler = `
    if (data.startsWith("lo_switch_wallet_")) {
      const wId = parseInt(data.replace("lo_switch_wallet_", ""));
      db.setSysConfig(\`lo_sel_wallet_\${userId}\`, String(wId));
      await ctx.answerCallbackQuery("✅ Wallet switched!");
      return showLimitOrdersScreen(ctx, userId);
    }

`;

c = c.replace(
  'async function handleLimitOrderCallbacks(ctx, data, userId, user, bot, ks) {\n',
  'async function handleLimitOrderCallbacks(ctx, data, userId, user, bot, ks) {\n' + switchHandler
);

fs.writeFileSync('src/modules/routes/callbacks.limitorders.js', c);
console.log('Done');
