// tokenInfo.js — Fetch real token data
// DexScreener: price, mcap, liquidity, volume
// Helius: holders
// Falls back silently if API unavailable (devnet/Replit)

const axios = require("axios");
const config = require("../../config");

const cache = new Map();
const TTL   = 100; // 100ms cache - near real-time, just avoids duplicate simultaneous API calls within the same screen render

// Check if DexScreener "Enhanced Token Info" / paid orders are approved
async function getDexPaidStatus(ca) {
  try {
    const { data } = await axios.get(`https://api.dexscreener.com/orders/v1/solana/${ca}`, { timeout: 5000 });
    const orders = data?.orders || [];
    const paidApproved = orders.some(o => o.status === "approved" && (o.type === "tokenProfile" || o.type === "communityTakeover"));
    return paidApproved;
  } catch { return null; }
}

async function getTokenInfo(ca, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cache.has(ca) && now - cache.get(ca).ts < TTL) {
    return cache.get(ca).data;
  }

  // Devnet mock tokens — no real data
  if (ca.startsWith("DEVNET_") || ca.startsWith("MOCK_")) {
    return { name: "DevTest", symbol: "DEV", price: 0, mcap: 0, liquidity: 0, volume24h: 0, holders: 0 };
  }

  let data = { name: null, symbol: null, price: 0, mcap: 0, liquidity: 0, volume24h: 0, holders: 0, top10Pct: null, dexUrl: `https://dexscreener.com/solana/${ca}` };

  // ── PRIMARY: Birdeye (faster + richer) ──
  let birdeyeOk = false;
  try {
    const birdeye = require("./birdeye");
    if (birdeye.isConfigured()) {
      const ov = await birdeye.getTokenOverview(ca);
      if (ov && ov.price > 0) {
        data.name = ov.name; data.symbol = ov.symbol;
        data.price = ov.price; data.mcap = ov.mcap;
        data.liquidity = ov.liquidity; data.volume24h = ov.volume24h;
        data.holders = ov.holders;
        data.change5m = ov.priceChange5m; data.change1h = ov.priceChange1h; data.change24h = ov.priceChange24h;
        data.buys24h = ov.buys24h; data.sells24h = ov.sells24h;
        data.decimals = ov.decimals;
        birdeyeOk = true;
        // Top 10 holder concentration
        try {
          const th = await birdeye.getTopHolders(ca, ov.totalSupply, 10);
          if (th && th.top10Pct !== null) data.top10Pct = th.top10Pct;
        } catch {}
      }
    }
  } catch {}

  try {
    // DexScreener API — fallback / fills gaps (age, any missing fields)
    if (birdeyeOk && data.pairCreatedAt) throw new Error("skip-dex"); // have what we need
    const dexRes = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${ca}`,
      { timeout: 5000 }
    );
    const pairs = dexRes.data?.pairs;
    if (pairs && pairs.length > 0) {
      const pair       = pairs[0];
      data.name        = data.name || pair.baseToken?.name    || null;
      data.symbol      = data.symbol || pair.baseToken?.symbol  || null;
      if (!data.price)     data.price     = parseFloat(pair.priceUsd || 0);
      if (!data.mcap)      data.mcap      = pair.marketCap || pair.fdv || 0;
      if (!data.liquidity) data.liquidity = pair.liquidity?.usd || 0;
      if (!data.volume24h) data.volume24h = pair.volume?.h24 || 0;
      if (data.change24h === undefined) data.change24h = pair.priceChange?.h24;
      if (data.change1h === undefined)  data.change1h  = pair.priceChange?.h1;
      if (data.change5m === undefined)  data.change5m  = pair.priceChange?.m5;
      data.pairCreatedAt = pair.pairCreatedAt || data.pairCreatedAt || 0;
      if (!data.buys24h)   data.buys24h   = pair.txns?.h24?.buys || 0;
      if (!data.sells24h)  data.sells24h  = pair.txns?.h24?.sells || 0;
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
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000)     return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)         return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)             return `${(n / 1_000).toFixed(2)}K`;
  return `${n.toFixed(2)}`;
}

function formatPrice(p) {
  if (!p || p === 0) return "—";
  let s;
  if (p < 0.000001) s = p.toFixed(12);
  else if (p < 0.001) s = p.toFixed(8);
  else if (p < 1) s = p.toFixed(6);
  else s = p.toFixed(4);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return `${s}`;
}

// Token safety checks — mint/freeze authority, top holder, LP
// Real RPC on mainnet; mock fallback on devnet/mock tokens
async function getTokenSafety(ca) {
  // Devnet/mock tokens — return mock "safe" values
  if (ca.startsWith("DEVNET_") || ca.startsWith("MOCK_") || ca.startsWith("LAUNCH")) {
    return { mintRevoked: true, freezeRevoked: true, lpLocked: true, topHolderPct: 8, holders: 0, isMock: true };
  }

  const safety = { mintRevoked: null, freezeRevoked: null, lpLocked: null, topHolderPct: null, holders: null, rugScore: null, rugged: null, insiders: null, devPct: null, isMock: false };

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

  // RugCheck: rug risk score, rugged flag, insiders, dev holdings
  try {
    const rc = await axios.get(`https://api.rugcheck.xyz/v1/tokens/${ca}/report`, { timeout: 6000 });
    const d = rc.data || {};
    if (typeof d.score_normalised === "number") safety.rugScore = d.score_normalised;
    if (typeof d.rugged === "boolean") safety.rugged = d.rugged;
    if (typeof d.graphInsidersDetected === "number") safety.insiders = d.graphInsidersDetected;
    // Dev holdings: creatorBalance / total supply
    if (d.creatorBalance && d.token?.supply) {
      const supply = parseFloat(d.token.supply) / Math.pow(10, d.token.decimals || 0);
      if (supply > 0) safety.devPct = ((parseFloat(d.creatorBalance) / Math.pow(10, d.token.decimals || 0)) / supply) * 100;
    }
  } catch {}

  return safety;
}

// Formats token age from a created timestamp (ms) — real-time granular
function formatAge(createdMs) {
  if (!createdMs) return null;
  const diff = Date.now() - createdMs;
  if (diff < 0) return null;
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const months = Math.floor(days / 30);
  const yrs  = Math.floor(days / 365);
  if (yrs >= 1) return `${yrs}y ${Math.floor((days % 365) / 30)}mo`;
  if (months >= 1) return `${months}mo ${days % 30}d`;
  if (days >= 1) return `${days}d ${hrs % 24}h`;
  if (hrs >= 1) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

// Builds the 2-line safety card text from a safety object
function formatSafetyCard(safety) {
  const mark = (v) => v === true ? "✅" : v === false ? "🔴" : null;
  const bits1 = [];
  // Only include checks we could actually verify (not null)
  if (safety.mintRevoked === true) bits1.push("✅ Mint Revoked");
  else if (safety.mintRevoked === false) bits1.push("🔴 Mint Active");
  if (safety.freezeRevoked === true) bits1.push("✅ Freeze Revoked");
  else if (safety.freezeRevoked === false) bits1.push("🔴 Freeze Active");
  if (mark(safety.lpLocked)) bits1.push(`${mark(safety.lpLocked)} LP locked`);
  // Top holder % and holder count are shown in the main info section, not duplicated here
  const l1 = bits1.length ? bits1.join("  ") : null;
  const l2 = null;
  return { l1, l2 };
}

module.exports = { getTokenInfo, getTokenSafety, getDexPaidStatus, formatSafetyCard, formatAge, formatNum, formatPrice };
