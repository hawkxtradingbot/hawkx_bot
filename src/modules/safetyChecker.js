// M17 — Safety Checker (Devnet: real API + mock fallback)
const axios = require('axios');

const cache = new Map();
const TTL = 60000;

async function checkSafety(ca) {
  const now = Date.now();
  if (cache.has(ca) && now - cache.get(ca).ts < TTL) return cache.get(ca).result;

  // Devnet/mock tokens — always safe
  if (ca.startsWith('DEVNET_TOKEN_')) {
    const result = { status: 'SAFE', reason: 'Devnet mock token', score: 0 };
    cache.set(ca, { result, ts: now });
    return result;
  }

  let result = { status: 'SAFE', reason: '', score: 0 };

  try {
    const [rugRes, gpRes] = await Promise.allSettled([
      axios.get(`https://api.rugcheck.xyz/v1/tokens/${ca}/report`, { timeout: 5000 }),
      axios.get(`https://api.gopluslabs.io/api/v1/token_security/solana?contract_addresses=${ca}`, { timeout: 5000 }),
    ]);

    const rugData = rugRes.status === 'fulfilled' ? rugRes.value.data : null;
    const gpData = gpRes.status === 'fulfilled' ? gpRes.value.data?.result?.[ca.toLowerCase()] : null;

    if (gpData?.is_honeypot === '1') result = { status: 'BLOCK', reason: 'Honeypot detected', score: 100 };
    else if (gpData?.can_sell === '0') result = { status: 'BLOCK', reason: 'Cannot sell', score: 100 };
    else if (rugData?.score > 70) result = { status: 'BLOCK', reason: `Rug score: ${rugData.score}`, score: rugData.score };
    else if (rugData?.score > 40) result = { status: 'WARNING', reason: `Medium risk: ${rugData.score}`, score: rugData.score };

  } catch {
    // API unavailable — warn but don't block in devnet
    result = { status: 'WARNING', reason: 'Safety API unavailable', score: 50 };
  }

  cache.set(ca, { result, ts: now });
  return result;
}

module.exports = { checkSafety };