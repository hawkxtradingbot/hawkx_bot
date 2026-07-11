// Birdeye Data Services integration — fast token data for Solana
const axios = require("axios");

const BASE = "https://public-api.birdeye.so";
const KEY  = () => process.env.BIRDEYE_API_KEY || "";

function headers() {
  return { "X-API-KEY": KEY(), "x-chain": "solana" };
}

// Fast SOL/token price
async function getPrice(address) {
  try {
    const { data } = await axios.get(`${BASE}/defi/price?address=${address}`, { headers: headers(), timeout: 5000 });
    return data?.success ? (data.data?.value || 0) : 0;
  } catch { return 0; }
}

// Full token overview: price, mcap, liquidity, volume, holders, decimals
async function getTokenOverview(address) {
  try {
    const { data } = await axios.get(`${BASE}/defi/token_overview?address=${address}`, { headers: headers(), timeout: 8000 });
    if (!data?.success) return null;
    const d = data.data;
    return {
      address: d.address,
      symbol: d.symbol,
      name: d.name,
      decimals: d.decimals,
      price: d.price,
      mcap: d.marketCap || d.fdv || 0,
      liquidity: d.liquidity || 0,
      volume24h: d.v24hUSD || 0,
      holders: d.holder || 0,
      priceChange5m: d.priceChange5mPercent,
      priceChange1h: d.priceChange1hPercent,
      priceChange24h: d.priceChange24hPercent,
      buys24h: d.buy24h,
      sells24h: d.sell24h,
      totalSupply: d.totalSupply || d.supply || 0,
    };
  } catch { return null; }
}

// Top holders % (concentration). Needs total supply to compute percentages.
async function getTopHolders(address, totalSupply, limit = 10) {
  try {
    const { data } = await axios.get(`${BASE}/defi/v3/token/holder?address=${address}&offset=0&limit=${limit}`, { headers: headers(), timeout: 8000 });
    if (!data?.success) return null;
    const items = data.data?.items || [];
    if (!totalSupply || totalSupply <= 0) return { count: items.length, top10Pct: null, holders: items };
    const topSum = items.reduce((s, h) => s + (parseFloat(h.ui_amount) || 0), 0);
    const top10Pct = (topSum / totalSupply) * 100;
    return { count: items.length, top10Pct, holders: items };
  } catch { return null; }
}

// Total supply from token overview (needed for holder %)
async function getTotalSupply(address) {
  try {
    const { data } = await axios.get(`${BASE}/defi/token_overview?address=${address}`, { headers: headers(), timeout: 8000 });
    return data?.success ? (data.data?.supply || data.data?.totalSupply || 0) : 0;
  } catch { return 0; }
}

function isConfigured() { return !!KEY(); }

module.exports = { getPrice, getTokenOverview, getTopHolders, getTotalSupply, isConfigured };
