// M07 — Settings
const db = require('../../database');
const { t } = require('./i18n');
const { buildSettingsMenu } = require('./keyboards');

async function showSettings(ctx, user) {
  const settings = db.getSettings(user.user_id);
  try {
    await ctx.editMessageText('⚙️ *Settings*', {
      parse_mode: 'Markdown',
      reply_markup: buildSettingsMenu({ ...user, settings }),
    });
  } catch {
    await ctx.reply('⚙️ *Settings*', {
      parse_mode: 'Markdown',
      reply_markup: buildSettingsMenu({ ...user, settings }),
    });
  }
}

async function handleSettingCallback(ctx, user, action) {
  const settings = db.getSettings(user.user_id);
  switch (action) {
    case 'set_autobuy':
      db.updateSettings(user.user_id, { auto_buy: settings.auto_buy ? 0 : 1 });
      await ctx.answerCallbackQuery(`Auto-buy: ${settings.auto_buy ? 'OFF' : 'ON'}`);
      break;
    case 'set_slippage':
      await ctx.reply('Enter slippage % (1–50):');
      db.setSysConfig(`pending_${user.user_id}`, 'set_slippage');
      break;
    case 'set_maxbuy':
      await ctx.reply('Enter max SOL per trade (e.g. 0.1):');
      db.setSysConfig(`pending_${user.user_id}`, 'set_maxbuy');
      break;
    case 'set_speed':
      const modes = ['standard', 'manual', 'turbo'];
      const next = modes[(modes.indexOf(settings.speed_mode) + 1) % modes.length];
      db.updateSettings(user.user_id, { speed_mode: next });
      await ctx.answerCallbackQuery(`Speed: ${next}`);
      break;
    case 'set_language':
      await ctx.reply('Select language:', {
        reply_markup: {
          inline_keyboard: [
                        [
              { text: '🇺🇸 English', callback_data: 'lang_en' }, 
              { text: '🇸🇦 العربية', callback_data: 'lang_ar' }
            ],
            [
              { text: '🇨🇳 中文', callback_data: 'lang_zh' }, 
              { text: '🇷🇺 Русский', callback_data: 'lang_ru' }
            ]
          ]
        },
      });
      break;
  }
}

async function handleTextInput(ctx, user, pendingKey) {
  const text = ctx.message.text.trim();
  switch (pendingKey) {
    case 'set_slippage': {
      const val = parseFloat(text);
      if (isNaN(val) || val < 1 || val > 50) { await ctx.reply('❌ Enter 1–50.'); return; }
      db.updateSettings(user.user_id, { slippage_pct: val });
      db.setSysConfig(`pending_${user.user_id}`, '');
      await ctx.reply(t('settings.saved', user.language));
      break;
    }
    case 'set_maxbuy': {
      const val = parseFloat(text);
      if (isNaN(val) || val <= 0) { await ctx.reply('❌ Invalid amount.'); return; }
      db.updateSettings(user.user_id, { max_buy_sol: val });
      db.setSysConfig(`pending_${user.user_id}`, '');
      await ctx.reply(t('settings.saved', user.language));
      break;
    }
  }
}

module.exports = { showSettings, handleSettingCallback, handleTextInput };
