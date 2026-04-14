// M22 — Blacklist & Whitelist
const db = require('../../database');
let cache = new Set();
let cacheTime = 0;

function isBlacklisted(deployer, userId) {
  if (Date.now() - cacheTime > 3600000) { cache = new Set(db.getGlobalBlacklist()); cacheTime = Date.now(); }
  if (cache.has(deployer)) return true;
  return db.getUserBlacklist(userId).some(e => e.address === deployer);
}

function isWhitelisted(wallet, userId) {
  return db.getUserWhitelist(userId).some(e => e.wallet_address === wallet);
}

module.exports = { isBlacklisted, isWhitelisted };
