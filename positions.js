// M13 — Position Tracker
const db = require('../../database');
const { checkAndPromote } = require('./ranks');

function recordBuy(data, notifyCallback) {
  db.openPosition(data);
  db.addVolume(data.userId, data.solAmount);
  const tradeId = db.recordTrade({ ...data, action: 'buy', status: 'confirmed' });
  checkAndPromote(data.userId, notifyCallback);
  return tradeId;
}

function recordSell(data, notifyCallback) {
  if (data.positionId) db.closePosition(data.positionId);
  db.addVolume(data.userId, data.solAmount);
  const tradeId = db.recordTrade({ ...data, action: 'sell', status: 'confirmed' });
  checkAndPromote(data.userId, notifyCallback);
  return tradeId;
}

module.exports = { recordBuy, recordSell };