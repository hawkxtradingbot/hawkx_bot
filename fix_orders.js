const fs = require('fs');
let c = fs.readFileSync('src/modules/routes/helpers.routes.js', 'utf8');

const oldCode = `    const status = o.paused ? "⏸" : "🟢";
    const det = o.order_type === "buy"
      ? \`\${status} Buy \${o.sol_amount||0.1}SOL @ \$\${parseFloat(o.target_price||0).toFixed(6)}\`
      : \`\${status} Sell \${o.sell_pct||100}% @ \$\${parseFloat(o.target_price||0).toFixed(6)}\`;
    kb.inline_keyboard.push([
      { text: det, callback_data: \`lo_pause_\${o.id}\` },
      { text: "🗑", callback_data: \`lo_del_\${o.id}\` },
    ]);`;

const newCode = `    const status = o.paused ? "⏸" : "🟢";
    const mcapLabel = o.target_mcap > 0
      ? \`MC:\${o.target_mcap >= 1000000 ? (o.target_mcap/1000000).toFixed(1)+"M" : (o.target_mcap/1000).toFixed(0)+"K"}\`
      : \`\$\${parseFloat(o.target_price||0).toFixed(4)}\`;
    const det = o.order_type === "buy"
      ? \`\${status} Buy \${o.sol_amount||0.1}◎ @\${mcapLabel}\`
      : \`\${status} Sell \${o.sell_pct||100}% @\${mcapLabel}\`;
    const isSelected = db.getSysConfig(\`lo_selected_\${userId}\`) === String(o.id);
    kb.inline_keyboard.push([
      { text: det, callback_data: \`lo_select_\${o.id}\` },
    ]);
    if (isSelected) {
      kb.inline_keyboard.push([
        { text: o.paused ? "▶ Resume" : "⏸ Pause", callback_data: \`lo_pause_\${o.id}\` },
        { text: "🗑 Delete", callback_data: \`lo_del_\${o.id}\` },
      ]);
    }`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  fs.writeFileSync('src/modules/routes/helpers.routes.js', c);
  console.log('Done');
} else {
  console.log('Pattern not found');
}
