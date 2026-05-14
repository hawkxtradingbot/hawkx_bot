const fs = require('fs');
let c = fs.readFileSync('src/modules/routes/helpers.routes.js', 'utf8');

// Split into lines, find line 502 (index 501), modify it
const lines = c.split('\n');
const idx = lines.findIndex(l => l.includes('📋 *${name} — Limit Orders*'));
console.log('Found at line:', idx + 1);
console.log('Current:', lines[idx].substring(0, 100));

if (idx >= 0) {
  // Remove ${priceInfo}\n from after the title
  lines[idx] = lines[idx].replace('*\\n${priceInfo}\\n\\n━━━', '*\\n\\n━━━');
  console.log('Updated:', lines[idx].substring(0, 100));
  fs.writeFileSync('src/modules/routes/helpers.routes.js', lines.join('\n'));
  console.log('Done');
}
