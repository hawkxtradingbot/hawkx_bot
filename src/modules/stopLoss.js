// M14 — Stop Loss & Take Profit (Devnet)
const db = require('../../database');
const { simulatePriceMovement } = require('./executor');
const { notify } = require('./notifications');

async function monitorPositions() {
  const positions = db.getAllOpenPositions();
  for (const pos of positions) {
    const currentPrice = simulatePriceMovement(pos.token_ca);
    const pnlPct = pos.buy_price > 0 ? ((currentPrice - pos.buy_price) / pos.buy_price * 100) : 0;
    const settings = db.getSettings(pos.user_id);

    if (pnlPct <= (pos.stop_loss_pct || -30)) {
      console.log(`[StopLoss] User ${pos.user_id} token ${pos.token_ca.slice(0,8)} P&L: ${pnlPct.toFixed(1)}%`);
      db.closePosition(pos.position_id);
      notify(pos.user_id, 'STOP_LOSS_HIT', {
        token: pos.token_name || pos.token_ca.slice(0, 8),
        pct: pnlPct.toFixed(1),
        sol: (pos.sol_invested * Math.abs(pnlPct) / 100).toFixed(4),
      });
    } else if (pnlPct >= (pos.take_profit_pct || 150)) {
      console.log(`[TakeProfit] User ${pos.user_id} token P&L: ${pnlPct.toFixed(1)}%`);
      db.closePosition(pos.position_id);
      notify(pos.user_id, 'TAKE_PROFIT_HIT', {
        token: pos.token_name || pos.token_ca.slice(0, 8),
        pct: pnlPct.toFixed(1),
        sol: (pos.sol_invested * pnlPct / 100).toFixed(4),
      });
    }
  }
}

module.exports = { monitorPositions };