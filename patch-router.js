const fs   = require("fs");
const path = require("path");
const DRY  = process.argv.includes("--dry");
const FILE = path.resolve(__dirname, "src/modules/router.js");
let src = fs.readFileSync(FILE, "utf8");
const original = src;
let applied = 0;

function patch(label, find, replace) {
  if (!src.includes(find)) { console.warn(`⚠️  SKIP [${label}] — pattern not found`); return; }
  src = src.replace(find, replace);
  console.log(`✅  APPLIED [${label}]`);
  applied++;
}

patch("FIX 1 — guide in copy_channel_view_",
`const chMsg = \`📡 *\${name}*\\n\\nStatus: \${ch.status === "active" ? "🟢 Active" : "⏸ Paused"}\\nSignals: *\${ch.signals_caught||0}* | Trades: *\${ch.trades_executed||0}*\\n\\n💰 Buy: *\${ch.buy_amount||0.1} SOL*\\n📊 Slip: *\${ch.slippage||50}%*\\n⛽ Gas: *\${ch.tip||0.005} SOL*\\n🛡 MEV: *\${ch.mev_protection ? "ON ✅" : "OFF ❌"}*\\n🤖 Auto Sell: *\${ch.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*\`;`,
`const chMsg = \`📡 *\${name}*\\n\\n━━━━━━━━━━━━━━━━━━━\\n💰 = buy amount  📊 = slippage  ⛽ = gas\\n🛡 = MEV  🤖 = auto sell  ⏸ = pause  🗑 = delete\\n━━━━━━━━━━━━━━━━━━━\\n\\nStatus: \${ch.status === "active" ? "🟢 Active" : "⏸ Paused"}\\nSignals: *\${ch.signals_caught||0}* | Trades: *\${ch.trades_executed||0}*\\n\\n💰 Buy: *\${ch.buy_amount||0.1} SOL*\\n📊 Slip: *\${ch.slippage||50}%*\\n⛽ Gas: *\${ch.tip||0.005} SOL*\\n🛡 MEV: *\${ch.mev_protection ? "ON ✅" : "OFF ❌"}*\\n🤖 Auto Sell: *\${ch.auto_sell_enabled ? "ON ✅" : "OFF ❌"}*\`;`
);

console.log(`Patches applied: ${applied}`);
if (DRY) { console.log("DRY RUN — no file written."); process.exit(0); }
fs.writeFileSync(FILE, src);
console.log("File updated!");
