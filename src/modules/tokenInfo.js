// tokenInfo.js — Fetch real token data
// DexScreener: price, mcap, liquidity, volume
// Helius: holders
// Falls back silently if API unavailable (devnet/Replit)

const axios = require("axios");
const config = require("../../config");

const cache = new Map();
const TTL   = 30000; // 30 second cache

async function getTokenInfo(ca) {
  const now = Date.now();
  if (cache.has(ca) && now - cache.get(ca).ts < TTL) {
    return cache.get(ca).data;
  }

  // Devnet mock tokens — no real data
  if (ca.startsWith("DEVNET_") || ca.startsWith("MOCK_")) {
    return { name: "DevTest", symbol: "DEV", price: 0, mcap: 0, liquidity: 0, volume24h: 0, holders: 0 };
  }

  let data = { name: null, symbol: null, price: 0, mcap: 0, liquidity: 0, volume24h: 0, holders: 0, dexUrl: `https://dexscreener.com/solana/${ca}` };

  try {
    // DexScreener API — price, mcap, liquidity, volume
    const dexRes = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
      { timeout: 5000 }
    );
    const pairs = dexRes.data?.pairs;
    if (pairs && pairs.length > 0) {
      const pair       = pairs[0];
      data.name        = pair.baseToken?.name    || null;
      data.symbol      = pair.baseToken?.symbol  || null;
      data.price       = parseFloat(pair.priceUsd || 0);
      data.mcap        = pair.fdv               || pair.marketCap || 0;
      data.liquidity   = pair.liquidity?.usd    || 0;
      data.volume24h   = pair.volume?.h24       || 0;
      data.change24h   = pair.priceChange?.h24  || 0;
      data.change6h    = pair.priceChange?.h6   || 0;
      data.change1h    = pair.priceChange?.h1   || 0;
      data.change5m    = pair.priceChange?.m5   || 0;
    }
  } catch {}

  try {
    // Helius API — holders count
    if (config.HELIUS_API_KEY) {
      const heliusRes = await axios.post(
        `https://mainnet.helius-rpc.com/?api-key=${config.HELIUS_API_KEY}`,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccounts",
          params: { mint: ca, limit: 1 },
        },
        { timeout: 5000 }
      );
      data.holders = heliusRes.data?.result?.total || 0;
    }
  } catch {}

  cache.set(ca, { data, ts: now });
  return data;
}

// Format large numbers
function formatNum(n) {
  if (!n || n === 0) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(p) {
  if (!p || p === 0) return "—";
  if (p < 0.000001) return `$${p.toFixed(12)}`;
  if (p < 0.001)    return `$${p.toFixed(8)}`;
  if (p < 1)        return `$${p.toFixed(6)}`;
  return `$${p.toFixed(4)}`;
}

// Token safety checks — mint/freeze authority, top holder, LP
// Real RPC on mainnet; mock fallback on devnet/mock tokens
async function getTokenSafety(ca) {
  // Devnet/mock tokens — return mock "safe" values
  if (ca.startsWith("DEVNET_") || ca.startsWith("MOCK_") || ca.startsWith("LAUNCH")) {
    return { mintRevoked: true, freezeRevoked: true, lpLocked: true, topHolderPct: 8, holders: 0, isMock: true };
  }

  const safety = { mintRevoked: null, freezeRevoked: null, lpLocked: null, topHolderPct: null, holders: null, isMock: false };

  try {
    const rpcUrl = config.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${config.HELIUS_API_KEY}`
      : "https://api.mainnet-beta.solana.com";

    // 1. Mint + freeze authority via getAccountInfo (parsed)
    const mintRes = await axios.post(rpcUrl, {
      jsonrpc: "2.0", id: 1, method: "getAccountInfo",
      params: [ca, { encoding: "jsonParsed" }],
    }, { timeout: 4000 });
    const parsed = mintRes.data?.result?.value?.data?.parsed?.info;
    if (parsed) {
      safety.mintRevoked = parsed.mintAuthority === null;
      safety.freezeRevoked = parsed.freezeAuthority === null;
    }

    // 2. Top holder % via getTokenLargestAccounts
    const largeRes = await axios.post(rpcUrl, {
      jsonrpc: "2.0", id: 2, method: "getTokenLargestAccounts", params: [ca],
    }, { timeout: 4000 });
    const accounts = largeRes.data?.result?.value || [];
    const supplyRes = await axios.post(rpcUrl, {
      jsonrpc: "2.0", id: 3, method: "getTokenSupply", params: [ca],
    }, { timeout: 4000 });
    const totalSupply = parseFloat(supplyRes.data?.result?.value?.uiAmount || 0);
    if (accounts.length && totalSupply > 0) {
      const topAmount = parseFloat(accounts[0]?.uiAmount || 0);
      safety.topHolderPct = Math.round((topAmount / totalSupply) * 100);
    }
  } catch {}

  return safety;
}

// Builds the 2-line safety card text from a safety object
function formatSafetyCard(safety) {
  const mark = (v) => v === true ? "✅" : v === false ? "🔴" : "⬜";
  // Line 1: Mint, Freeze, LP
  let l1 = `${mark(safety.mintRevoked)} Mint  ${mark(safety.freezeRevoked)} Freeze  ${mark(safety.lpLocked)} LP locked`;
  // Line 2: Top holder %, holders
  let topMark = "⬜", topTxt = "Top holder —";
  if (safety.topHolderPct !== null && safety.topHolderPct !== undefined) {
    topMark = safety.topHolderPct < 20 ? "✅" : safety.topHolderPct < 35 ? "⚠️" : "🔴";
    topTxt = `Top ${safety.topHolderPct}%`;
  }
  const holdersTxt = safety.holders ? `✅ ${safety.holders.toLocaleString()} holders` : "";
  let l2 = `${topMark} ${topTxt}` + (holdersTxt ? `  ${holdersTxt}` : "");
  return { l1, l2 };
}

module.exports = { getTokenInfo, getTokenSafety, formatSafetyCard, formatNum, formatPrice };
