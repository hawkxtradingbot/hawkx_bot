// M21 — Dupe & FOMO Filter
const db = require('../../database');

function isDuplicate(userId, ca) {
  return db.getOpenPositions(userId).some(p => p.token_ca === ca);
}

function isFOMO(currentPrice, launchPrice, threshold) {
  if (!launchPrice) return false;
  return ((currentPrice - launchPrice) / launchPrice * 100) > (threshold || 300);
}

module.exports = { isDuplicate, isFOMO };
