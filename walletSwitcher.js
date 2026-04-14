// M46 — Wallet Switcher
const db = require('../../database');
const config = require('../../config');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

function getActiveWallet(userId) {
  const user = db.getUser(userId);
  if (!user || !user.active_wallet_id) return null;
  return db.getWallet(user.active_wallet_id);
}

function setActiveWallet(userId, walletId) {
  db.updateUser(userId, { active_wallet_id: walletId });
}

async function getBalance(publicKey) {
  try {
    const conn = new Connection(config.HELIUS_RPC_URL, 'confirmed');
    const lamports = await conn.getBalance(new PublicKey(publicKey));
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

module.exports = { getActiveWallet, setActiveWallet, getBalance };
