// M19 — Honeypot Detector (Devnet: mock tokens always pass)
const axios = require('axios');
const cache = new Map();

async function checkHoneypot(ca) {
  if (cache.has(ca) && Date.now() - cache.get(ca).ts < 30000) return cache.get(ca).result;

  // Mock devnet tokens always safe
  if (ca.startsWith('DEVNET_TOKEN_')) {
    const r = { blocked: false, warning: false, reason: '' };
    cache.set(ca, { result: r, ts: Date.now() });
    return r;
  }

  try {
    const res = await axios.get(
      `https://api.gopluslabs.io/api/v1/token_security/solana?contract_addresses=${ca}`,
      { timeout: 5000 }
    );
    const data = res.data?.result?.[ca.toLowerCase()];
    if (!data) { const r = { blocked: false, warning: true, reason: 'Unverified' }; cache.set(ca, { result: r, ts: Date.now() }); return r; }

    if (data.is_honeypot === '1' || data.can_sell === '0') {
      const r = { blocked: true, reason: 'Honeypot' };
      cache.set(ca, { result: r, ts: Date.now() });
      return r;
    }
    const sellTax = parseFloat(data.sell_tax || 0);
    const r = { blocked: sellTax > 25, warning: sellTax > 10, reason: sellTax > 10 ? `Tax: ${sellTax}%` : '' };
    cache.set(ca, { result: r, ts: Date.now() });
    return r;
  } catch {
    return { blocked: false, warning: true, reason: 'API unavailable' };
  }
}

module.exports = { checkHoneypot };