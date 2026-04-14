// M30 — Notifications
const db = require('../../database');
const { t } = require('./i18n');
const { buildRankUpBanner } = require('./keyboards');
const config = require('../../config');

let botRef = null;
function setBotRef(bot) { botRef = bot; }

async function notify(userId, eventType, data = {}) {
  if (!botRef) return;
  const user = db.getUser(userId);
  if (!user) return;
  const lang = user.language || 'en';

  let msg = '';
  switch (eventType) {
    case 'BUY_EXECUTED': msg = t('trade.buy.success', lang, data); break;
    case 'SELL_EXECUTED': msg = t('trade.sell.success', lang, data); break;
    case 'STOP_LOSS_HIT': msg = t('stop.loss.hit', lang, data); break;
    case 'TAKE_PROFIT_HIT': msg = t('take.profit.hit', lang, data); break;
    case 'RANK_UP': msg = buildRankUpBanner(user, data.rank, data.fee); break;
    case 'TRIAL_EXPIRED': msg = t('trial.expired', lang); break;
    case 'DAILY_PAYOUT': msg = t('referral.payout', lang, data); break;
    case 'KILL_SWITCH_ON': msg = t('killswitch.active', lang); break;
    default: msg = `[${eventType}] ${JSON.stringify(data)}`;
  }

  try {
    await botRef.api.sendMessage(userId, msg, { parse_mode: 'Markdown' });
  } catch (e) {
    if (!e.message?.includes('403')) console.error(`[Notify] ${userId}:`, e.message);
  }
}

async function notifyAllUsers(message) {
  if (!botRef) return;
  const users = db.getAllUsers();
  for (const u of users) {
    try { await botRef.api.sendMessage(u.user_id, message, { parse_mode: 'Markdown' }); await new Promise(r => setTimeout(r, 50)); }
    catch {}
  }
}

module.exports = { setBotRef, notify, notifyAllUsers };
