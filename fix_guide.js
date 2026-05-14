const fs = require('fs');
let c = fs.readFileSync('src/modules/routes/helpers.routes.js', 'utf8');

// Find the msg line and rebuild it
const oldMsg = 'const msg = `📋 *${name} — Limit Orders*\\n${priceInfo}\\n\\n━━━ 📚 GUIDE ━━━\\n🟢 Buy triggers at or below target\\n🔴 Sell triggers at or above target\nTap order → Pause or Delete\\n━━━━━━━━━━━━━━━━━━━\\n\\n🪙 *${name}*\\n${priceInfo}\\n\\n${tokenOrders.length ? `*Orders: ${tokenOrders.length}*` : "*No orders yet*"}`;';

const newMsg = 'const msg = `📋 *${name} — Limit Orders*\\n\\n━━━ 📚 GUIDE ━━━\\n🟢 Buy triggers at or below target\\n🔴 Sell triggers at or above target\\nTap order → Pause or Delete\\n━━━━━━━━━━━━━━━━━━━\\n\\n🪙 *${name}*\\n${priceInfo}\\n\\n${tokenOrders.length ? `*Orders: ${tokenOrders.length}*` : "*No orders yet*"}`;';

console.log('Old found:', c.includes('const msg = `📋 *${name} — Limit Orders*'));

// Use regex to replace the msg line
c = c.replace(
  /const msg = `📋 \*\$\{name\} — Limit Orders\*\\n.*?"\*No orders yet\*"\}`\s*`;/s,
  newMsg
);

fs.writeFileSync('src/modules/routes/helpers.routes.js', c);
console.log('Done');
