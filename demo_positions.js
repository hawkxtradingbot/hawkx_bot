const { Bot } = require('grammy');
const config = require('./config');
const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

const msg = `📂 <b>Positions</b> — All
━━━━━━━━━━━━━━━━━━━
💼 W1: <b>2.4500 SOL</b> | 3 positions

<b>Portfolio Summary</b>
├ Invested: <b>0.650 SOL</b>
├ Current: <b>0.820 SOL</b>
└ Total P&L: <b>🟢 +0.170 SOL (+26.1%)</b>
━━━━━━━━━━━━━━━━━━━

<b>1. BONK</b> 🟢 <code>+245.0%</code>
├ Invested: 0.100 SOL → Now: 0.345 SOL
├ Entry MCap: $50K → Now: $172K
├ Hold Time: 2h 15m
└ Source: 🏷 Manual

<b>2. WIF</b> 🔴 <code>-32.5%</code>
├ Invested: 0.300 SOL → Now: 0.202 SOL
├ Entry MCap: $2.1M → Now: $1.4M
├ Hold Time: 45m
└ Source: 🎯 Sniper

<b>3. PEPE</b> 🟢 <code>+12.3%</code>
├ Invested: 0.250 SOL → Now: 0.280 SOL
├ Entry MCap: $800K → Now: $898K
├ Hold Time: 5h 30m
└ Source: 📡 Channel
━━━━━━━━━━━━━━━━━━━`;

const kb = {
  inline_keyboard: [
    [{ text: '💼 W1 ▼', callback_data: 'noop' }, { text: '📂 All ▼', callback_data: 'noop' }],
    [{ text: '🟢 BONK ✅', callback_data: 'noop' }, { text: '🔴 WIF', callback_data: 'noop' }, { text: '🟢 PEPE', callback_data: 'noop' }],
    [{ text: '🟢 Buy', callback_data: 'noop' }, { text: '🔴 Sell 25%', callback_data: 'noop' }, { text: '🔴 Sell 50%', callback_data: 'noop' }, { text: '🔴 Sell 100%', callback_data: 'noop' }],
    [{ text: '📌 Limit Order', callback_data: 'noop' }, { text: '🔔 Set Alert', callback_data: 'noop' }],
    [{ text: '🔄 Refresh', callback_data: 'noop' }, { text: '← Back', callback_data: 'noop' }],
  ]
};

bot.api.sendMessage(config.ADMIN_IDS[0], msg, { parse_mode: 'HTML', reply_markup: kb })
  .then(() => { console.log('Sent!'); process.exit(0); })
  .catch(e => { console.log('Error:', e.message); process.exit(1); });
