const fs = require('fs');
let c = fs.readFileSync('src/modules/routes/callbacks.limitorders.js', 'utf8');

const selectHandler = `
    if (data.startsWith("lo_select_")) {
      const id = parseInt(data.replace("lo_select_", ""));
      const current = db.getSysConfig(\`lo_selected_\${userId}\`) || "";
      // Toggle — click again to deselect
      if (current === String(id)) {
        db.setSysConfig(\`lo_selected_\${userId}\`, "");
      } else {
        db.setSysConfig(\`lo_selected_\${userId}\`, String(id));
      }
      await ctx.answerCallbackQuery();
      const ca = db.getSysConfig(\`lo_pending_ca_\${userId}\`) || "";
      if (ca) return buildTokenOrdersScreen(ctx, userId, ca, false);
      return showLimitOrdersScreen(ctx, userId);
    }

`;

// Add before the first if statement in the function
c = c.replace(
  'async function handleLimitOrderCallbacks(ctx, data, userId, user, bot, ks) {\n',
  'async function handleLimitOrderCallbacks(ctx, data, userId, user, bot, ks) {\n' + selectHandler
);

fs.writeFileSync('src/modules/routes/callbacks.limitorders.js', c);
console.log('Done');
