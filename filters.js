// M18 — Token Filters
const axios = require('axios');

async function getTokenData(ca) {
  if (ca.startsWith('DEVNET_TOKEN_')) {
    return { liquidity: 100, mcap: 500, volume24h: 10000, name: 'DevTest Token', symbol: 'DTT', priceUsd: 0.001 };
  }
  try {
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { timeout: 5000 });
    const pair = (res.data?.pairs || []).find(p => p.chainId === 'solana') || res.data?.pairs?.[0];
    if (!pair) return null;
    return {
      liquidity: parseFloat(pair.liquidity?.usd || 0) / 150,
      mcap: parseFloat(pair.fdv || 0) / 150,
      volume24h: parseFloat(pair.volume?.h24 || 0),
      name: pair.baseToken?.name || 'Unknown',
      symbol: pair.baseToken?.symbol || '???',
      priceUsd: parseFloat(pair.priceUsd || 0),
    };
  } catch { return null; }
}

function applyFilters(ca, tokenData, settings) {
  if (!tokenData) return { pass: true, reason: '' }; // Pass if no data in devnet
  if (settings.min_liquidity_sol > 0 && tokenData.liquidity < settings.min_liquidity_sol) {
    return { pass: false, reason: `Low liquidity: ${tokenData.liquidity.toFixed(2)} SOL` };
  }
  return { pass: true, reason: '' };
}

module.exports = { getTokenData, applyFilters };
