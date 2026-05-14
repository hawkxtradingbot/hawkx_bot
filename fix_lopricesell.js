const fs = require('fs');
let c = fs.readFileSync('src/modules/routes/messages.routes.js', 'utf8');
c = c.replace(
  'const price5 = parseFloat(text);\n      if (isNaN(price5) || price5 <= 0) { await ctx.reply("❌ Invalid price."); return; }',
  'const clean5 = text.trim().replace(/[$]/,"").toUpperCase();\n      let price5 = 0, mcap5 = 0;\n      if (clean5.endsWith("K")) { mcap5 = parseFloat(clean5) * 1000; }\n      else if (clean5.endsWith("M")) { mcap5 = parseFloat(clean5) * 1000000; }\n      else { const n5 = parseFloat(clean5); if (n5 >= 1000) mcap5 = n5; else price5 = n5; }\n      if (price5 <= 0 && mcap5 <= 0) { await ctx.reply("Invalid value"); return; }'
);
c = c.replace(
  'targetPrice: price5, solAmount: 0, sellPct: pct6, targetMcap: 0',
  'targetPrice: price5, solAmount: 0, sellPct: pct6, targetMcap: mcap5'
);
fs.writeFileSync('src/modules/routes/messages.routes.js', c);
console.log('Done');
