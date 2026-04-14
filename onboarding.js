// M06 — Onboarding (Devnet)
const db = require('../../database');
const { t } = require('./i18n');
const config = require('../../config');
const { buildMainMenu } = require('./keyboards');

async function handleStart(ctx) {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name || 'Trader';
  const rawLang = ctx.from.language_code || 'en';
  const lang = ['en','ar','zh','ru'].includes(rawLang.slice(0,2)) ? rawLang.slice(0,2) : 'en';

  const startParam = ctx.match || '';
  let referrerId = null;
  let joinerDiscount = false;

  if (config.INVITE_CODE_REQUIRED && startParam !== config.INVITE_CODE) {
    await ctx.reply('❌ Invalid invite code.');
    return;
  }

  if (startParam && startParam.startsWith('REF_')) {
    referrerId = parseInt(startParam.replace('REF_', ''));
    if (referrerId === userId) referrerId = null;
    if (referrerId) joinerDiscount = true;
  }

  let user = db.getUser(userId);
  if (!user) {
    user = db.createUser(userId, username, lang, referrerId, joinerDiscount);
    if (referrerId) db.buildReferralChain(userId, referrerId);
    console.log(`[Onboarding] New user: ${userId} (@${username})`);
  }

  await ctx.reply(
    t('welcome', user.language, { inviteCode: `REF_${userId}` }),
    { parse_mode: 'Markdown', reply_markup: buildMainMenu(user) }
  );

  setTimeout(async () => {
    try {
      await ctx.reply(
        t('onboarding.wallet', user.language),
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🆕 Generate Devnet Wallet (FREE)', callback_data: 'wallet_generate' }],
              [{ text: '📥 Import Existing Key', callback_data: 'wallet_import' }],
            ],
          },
        }
      );
    } catch {}
  }, 800);
}

module.exports = { handleStart };
