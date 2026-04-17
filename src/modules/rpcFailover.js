// M47 — RPC Failover (Devnet)
const { Connection } = require('@solana/web3.js');
const config = require('../../config');
const db = require('../../database');

let activeRPC = config.HELIUS_RPC_URL;

function getConnection() { return new Connection(activeRPC, 'confirmed'); }
function getCurrentRPC() { return activeRPC; }

async function healthCheck() {
  try {
    await Promise.race([
      new Connection(config.HELIUS_RPC_URL).getSlot(),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000)),
    ]);
    activeRPC = config.HELIUS_RPC_URL;
    db.setSysConfig('rpc_primary', 'devnet_helius');
  } catch {
    activeRPC = config.BACKUP_RPC_URL;
    db.setSysConfig('rpc_primary', 'devnet_backup');
    console.warn('[RPC] Switched to backup devnet RPC');
  }
}

function startHealthMonitor() {
  setInterval(healthCheck, 30000);
  console.log('[RPC] Devnet health monitor started.');
}

async function getTokenMetadata(ca) {
  if (ca.startsWith('DEVNET_TOKEN_')) return { name: 'DevTest Token', symbol: 'DTT', price: '0.001' };
  try {
    const axios = require('axios');
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { timeout: 5000 });
    const pair = res.data?.pairs?.[0];
    return { name: pair?.baseToken?.name || 'Unknown', symbol: pair?.baseToken?.symbol || '???', price: pair?.priceNative || '0' };
  } catch { return { name: 'Unknown', symbol: '???', price: '0' }; }
}

module.exports = { getConnection, getCurrentRPC, startHealthMonitor, getTokenMetadata };