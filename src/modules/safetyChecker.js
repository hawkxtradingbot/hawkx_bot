// M17 — Safety Checker V12
// Auto-block: honeypots, freeze auth, mint auth, rug score >70
// Warning: rug score 40-70
// Beginner: hard block | Pro: can override warnings

const axios = require("axios");
const cache = new Map();
const TTL   = 60000;

async function checkSafety(ca, userMode = "beginner") {
  const now = Date.now();
  if (cache.has(ca) && now - cache.get(ca).ts < TTL) return cache.get(ca).result;

  if (ca.startsWith("DEVNET_") || ca.startsWith("MOCK_")) {
    const result = { status: "SAFE", reason: "Devnet mock token", score: 0, canOverride: false };
    cache.set(ca, { result, ts: now });
    return result;
  }

  let result = { status: "SAFE", reason: "", score: 0, canOverride: false };

  try {
    const [rugRes, gpRes] = await Promise.allSettled([
      axios.get(`https://api.rugcheck.xyz/v1/tokens/${ca}/report`, { timeout: 5000 }),
      axios.get(`https://api.gopluslabs.io/api/v1/token_security/solana?contract_addresses=${ca}`, { timeout: 5000 }),
    ]);

    const rugData = rugRes.status === "fulfilled" ? rugRes.value.data : null;
    const gpData  = gpRes.status  === "fulfilled" ? gpRes.value.data?.result?.[ca.toLowerCase()] : null;

    if (gpData?.is_honeypot === "1") {
      result = { status: "BLOCK", reason: "🍯 Honeypot — cannot sell", score: 100, canOverride: false };
    } else if (gpData?.can_sell === "0") {
      result = { status: "BLOCK", reason: "🔒 Token cannot be sold", score: 100, canOverride: false };
    } else if (gpData?.freeze_authority && gpData.freeze_authority !== "0") {
      result = { status: "BLOCK", reason: "🧊 Freeze authority active", score: 90, canOverride: userMode === "pro" };
    } else if (gpData?.mint_authority && gpData.mint_authority !== "0") {
      result = { status: "BLOCK", reason: "🖨 Mint authority active", score: 85, canOverride: userMode === "pro" };
    } else if (rugData?.score > 70) {
      result = { status: "BLOCK", reason: `☠️ Rug score: ${rugData.score}/100`, score: rugData.score, canOverride: userMode === "pro" };
    } else if (rugData?.score > 40) {
      result = { status: "WARNING", reason: `⚠️ Medium risk: ${rugData.score}/100`, score: rugData.score, canOverride: true };
    }
  } catch {
    result = { status: "WARNING", reason: "⚠️ Safety API unavailable", score: 0, canOverride: true };
  }

  cache.set(ca, { result, ts: now });
  return result;
}

module.exports = { checkSafety };
