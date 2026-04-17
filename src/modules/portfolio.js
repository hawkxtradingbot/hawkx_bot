// M26 — Portfolio Dashboard (Devnet)
const db = require('../../database');
const { getMockPrice, simulatePriceMovement } = require('./executor');

async function getPortfolio(ctx, user) {
  const positions = db.getOpenPositions(user.user_id);

  if (!positions.length) {
    const msg = '📊 *Portfolio* [DEVNET]\n\nNo open positions.\n\nTry /mockbuy or tap 🧪 Test Trade.';
    try { await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🧪 Mock Buy', callback_data: 'devnet_mock_buy' }]] } }); }
    catch { await ctx.reply(msg, { parse_mode: 'Markdown' }); }
    return;
  }

  let msg = '📊 *Open Positions* [DEVNET]\n\n';
  let totalInvested = 0, totalCurrent = 0;

  for (const pos of positions) {
    // Simulate price movement for realism
    const currentPrice = simulatePriceMovement(pos.token_ca);
    const pnlPct = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
    const currentValue = pos.sol_invested * (1 + pnlPct / 100);
    totalInvested += pos.sol_invested;
    totalCurrent += currentValue;

    const icon = pnlPct >= 0 ? '🟢' : '🔴';
    const sign = pnlPct >= 0 ? '+' : '';
    msg += `${icon} *${pos.token_name || pos.token_ca.slice(0, 8)}*\n`;
    msg += `  Invested: ${pos.sol_invested.toFixed(4)} SOL | P&L: ${sign}${pnlPct.toFixed(1)}%\n\n`;
  }

  const totalPnl = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested * 100) : 0;
  msg += `─────────────\n`;
  msg += `💰 Invested: ${totalInvested.toFixed(4)} SOL\n`;
  msg += `📈 Total P&L: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}%`;

  const kb = { inline_keyboard: [
    [{ text: '🔄 Refresh', callback_data: 'menu_portfolio' }, { text: '🧪 Mock Sell', callback_data: 'devnet_mock_sell' }],
    [{ text: '🔙 Back', callback_data: 'menu_main' }],
  ]};

  try { await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: kb }); }
  catch { await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb }); }
}

module.exports = { getPortfolio };