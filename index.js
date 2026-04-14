// index.js — HawkX V10 DEVNET ENTRY POINT
require('dotenv').config();
const { Bot } = require('grammy');
const config = require('./config');
const db = require('./database');
const { setupRouter } = require('./src/modules/router');
const { startTrialCron, startRankCron } = require('./src/modules/ranks');
const { startDailyPayoutCron } = require('./src/modules/referrals');
const { startHealthMonitor } = require('./src/modules/rpcFailover');
const { setBotRef, notify } = require('./src/modules/notifications');
const { monitorPositions } = require('./src/modules/stopLoss');

// ── STARTUP ──
console.log('');
console.log('🦅 HawkX Bot V10 — DEVNET MODE');
console.log('================================');
console.log(`Network:    ${config.NETWORK}`);
console.log(`RPC:        ${config.HELIUS_RPC_URL}`);
console.log(`DB:         ${config.DB_PATH}`);
console.log(`Mock Trades: ${config.MOCK_TRADES}`);
console.log('');

// Init DB
db.getDb();
console.log('[DB] ✅ SQLite ready');

// Init bot
const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
setBotRef(bot);
console.log('[Bot] ✅ Telegram bot initialized');

const notifyCallback = (userId, eventType, data) => notify(userId, eventType, data);

// Setup router
setupRouter(bot).catch(e => console.error('[Router] Setup error:', e));
console.log('[Router] ✅ Commands and callbacks registered');

// Error handler
bot.catch((err) => {
  console.error('[Bot Error]', err.message);
});

// Start polling
bot.start({
  onStart: async (info) => {
    console.log('');
    console.log(`[Bot] ✅ @${info.username} is LIVE on DEVNET`);
    console.log(`[Kill-Switch] ${require('./src/modules/killSwitch').isActive() ? '🔴 ACTIVE' : '✅ OFF'}`);
    console.log('');
    console.log('─────────────────────────────────');
    console.log('🦅 HawkX Devnet Ready!');
    console.log('Always Watching. Always First.');
    console.log('─────────────────────────────────');
    console.log('');
    console.log('TEST COMMANDS:');
    console.log('  /start       — Register as new user');
    console.log('  /faucet      — Get free devnet SOL');
    console.log('  /mockbuy     — Simulate a buy trade');
    console.log('  /mocksell    — Simulate a sell');
    console.log('  /addvolume 5 — Add 5 SOL volume (rank up)');
    console.log('  /mystats     — Check your stats + rank');
    console.log('  /portfolio   — View open positions');
    console.log('  /referrals   — Referral stats');
    console.log('  /admin       — Admin panel');
    console.log('');
  },
});

// Background jobs
startTrialCron(bot);
startRankCron(notifyCallback);
startDailyPayoutCron(notifyCallback);
startHealthMonitor();

// Position monitor every 30s
setInterval(() => {
  monitorPositions().catch(e => console.error('[Monitor]', e.message));
}, 30000);

console.log('[Jobs] ✅ Trial cron, rank cron, payout cron, position monitor started');

process.on('SIGINT', () => { console.log('\n[HawkX] Shutting down...'); process.exit(0); });
process.on('uncaughtException', (e) => console.error('[Uncaught]', e.message));
