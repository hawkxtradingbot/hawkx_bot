const fs = require('fs');
let c = fs.readFileSync('src/modules/routes/helpers.routes.js', 'utf8');

const oldFn = `async function showLimitOrdersScreen(ctx, userId) {
  const orders = db.getLimitOrders(userId);
  const wallets = db.getWallets(userId) || [];
  const user = db.getUser(userId);
  const activeWallet = wallets.find(w => w.wallet_id === user.active_wallet_id) || wallets[0];
  const walletNum = wallets.indexOf(activeWallet) + 1;
  const balance = activeWallet ? (activeWallet.balance || 0) : 0;
  const allPos = db.getAllOpenPositions().filter(p => p.user_id === userId && p.wallet_id === user.active_wallet_id);`;

const newFn = `async function showLimitOrdersScreen(ctx, userId) {
  const orders = db.getLimitOrders(userId);
  const wallets = db.getWallets(userId) || [];
  const user = db.getUser(userId);
  // Use lo_selected_wallet if set, otherwise use active wallet
  const selWalletId = parseInt(db.getSysConfig(\`lo_sel_wallet_\${userId}\`) || user.active_wallet_id);
  const activeWallet = wallets.find(w => w.wallet_id === selWalletId) || wallets[0];
  const walletNum = wallets.indexOf(activeWallet) + 1;
  const balance = activeWallet ? (activeWallet.balance || 0) : 0;
  // Filter positions by SELECTED wallet
  const allPos = db.getAllOpenPositions().filter(p => p.user_id === userId && p.wallet_id === selWalletId);
  // Filter orders by selected wallet
  const walletOrders = orders.filter(o => !o.wallet_id || o.wallet_id === selWalletId);`;

if (c.includes(oldFn)) {
  c = c.replace(oldFn, newFn);
  console.log('Step 1 done');
} else {
  console.log('Step 1 pattern not found');
}

// Update guide text
c = c.replace(
  '💡 Tap token to manage its orders',
  '💡 Switch wallet to see its tokens & orders\n💼 Each wallet executes its own orders'
);

// Update byToken to use walletOrders
c = c.replace(
  '  const byToken = {};\n  orders.forEach(o => { if (!byToken[o.token_ca]) byToken[o.token_ca] = []; byToken[o.token_ca].push(o); });',
  '  const byToken = {};\n  walletOrders.forEach(o => { if (!byToken[o.token_ca]) byToken[o.token_ca] = []; byToken[o.token_ca].push(o); });'
);

// Update tokenMap to use walletOrders
c = c.replace(
  '  orders.forEach(o => { if (!tokenMap[o.token_ca]) tokenMap[o.token_ca] = { token_ca: o.token_ca, token_name: o.token_name }; });',
  '  walletOrders.forEach(o => { if (!tokenMap[o.token_ca]) tokenMap[o.token_ca] = { token_ca: o.token_ca, token_name: o.token_name }; });'
);

// Update wallet selector to use lo_setwallet_lo_ prefix
c = c.replace(
  'return { text: isSel ? `W${num} ✅` : `W${num}`, callback_data: `lo_setwallet_${w.wallet_id}` };',
  'return { text: isSel ? `W${num} ✅` : `W${num}`, callback_data: `lo_switch_wallet_${w.wallet_id}` };'
);

// Update wallet button
c = c.replace(
  '{ text: `💼 W${walletNum} — ${balance.toFixed(3)} SOL ▼`, callback_data: "lo_wallet_expand" }',
  '{ text: `💼 W${walletNum} ✅ — ${balance.toFixed(3)} SOL ▼`, callback_data: "lo_wallet_expand" }'
);

fs.writeFileSync('src/modules/routes/helpers.routes.js', c);
console.log('All done');
