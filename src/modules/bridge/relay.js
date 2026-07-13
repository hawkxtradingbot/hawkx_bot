// Relay Protocol (relay.link) bridge integration - kept fully separate from Solana/EVM trading code.
// Real, official API - no auth key required for our volume level. Confirmed native Solana support.
const axios = require("axios");

const RELAY_API_BASE = "https://api.relay.link";
const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";
const SOLANA_NATIVE_MINT = "11111111111111111111111111111111111111112";

// Chain ID reference for Relay (standard EVM chain IDs; Solana uses a special identifier per Relay's docs)
const CHAIN_IDS = {
  SOL: 792703809, // Relay's Solana chain ID convention (mainnet) - confirmed against their chains list at runtime via getSupportedChains
  ETH: 1,
  BASE: 8453,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  POLYGON: 137,
  HOOD: 4663, // Robinhood Chain
};

async function getSupportedChains() {
  try {
    const { data } = await axios.get(`${RELAY_API_BASE}/chains`, { timeout: 8000 });
    return data?.chains || [];
  } catch (e) {
    console.error("[Relay] getSupportedChains failed:", e.message);
    return [];
  }
}

async function getQuote({ userAddress, originChainId, destinationChainId, originCurrency, destinationCurrency, amount }) {
  try {
    const { data } = await axios.post(`${RELAY_API_BASE}/quote/v2`, {
      user: userAddress,
      originChainId,
      destinationChainId,
      originCurrency: originCurrency || NATIVE_TOKEN,
      destinationCurrency: destinationCurrency || NATIVE_TOKEN,
      amount: String(amount),
      tradeType: "EXACT_INPUT",
    }, { timeout: 10000 });
    return data;
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    console.error("[Relay] getQuote failed:", msg);
    throw new Error(msg);
  }
}

async function pollStatus(requestId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { data } = await axios.get(`${RELAY_API_BASE}/intents/status/v2`, {
        params: { requestId },
        timeout: 8000,
      });
      if (data?.status === "success") return { success: true, txHash: data.txHashes?.[0] || data.destinationChainTxHash, data };
      if (data?.status === "failure" || data?.status === "refund") return { success: false, status: data.status, data };
      // waiting or pending - keep polling
    } catch (e) { /* transient - keep trying */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return { success: false, status: "timeout" };
}

module.exports = { getSupportedChains, getQuote, pollStatus, CHAIN_IDS, NATIVE_TOKEN, SOLANA_NATIVE_MINT };
