// M12 — Auto-Buy (Devnet)
const db = require('../../database');
const killSwitch = require('./killSwitch');
const { checkSafety } = require('./safetyChecker');
const { checkHoneypot } = require('./honeypot');
const { applyFilters, getTokenData } = require('./filters');
const { isDuplicate } = require('./dupeFilter');
const { mockBuy } = require('./executor');

const userQueues = new Set();

async function processCA(ca, source, bot) {
  if (killSwitch.isActive()) return;
  console.log(`[AutoBuy] CA: ${ca} from ${source}`);

  const [honeypot, safety] = await Promise.all([checkHoneypot(ca), checkSafety(ca)]);
  if (honeypot.blocked || safety.status === 'BLOCK') return;

  const users = db.getAllUsers();
  await Promise.allSettled(users.map(async user => {
    const s = db.getSettings(user.user_id);
    if (!s?.auto_buy || !user.active_wallet_id) return;
    if (isDuplicate(user.user_id, ca)) return;

    const qKey = `${user.user_id}_${ca}`;
    if (userQueues.has(qKey)) return;
    userQueues.add(qKey);

    try {
      const fakeCtx = {
        reply: async (msg, opts) => {
          try { await bot.api.sendMessage(user.user_id, msg, opts); } catch {}
        },
        message: null,
      };
      await mockBuy(fakeCtx, user, ca, s.max_buy_sol || 0.1);
    } finally {
      userQueues.delete(qKey);
    }
  }));
}

module.exports = { processCA };
