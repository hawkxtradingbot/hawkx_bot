// Scans a wallet's REAL on-chain SPL token balances using Helius's DAS API (getAssetsByOwner),
// which has proven reliable where the standard getParsedTokenAccountsByOwner RPC call missed
// real, confirmed holdings on at least one tested wallet. Shows tokens from ANY source: external
// wallets, CEX withdrawals, other DEXs, airdrops, etc - not just HawkX-tracked trades.
const axios = require("axios");
const config = require("../../config");

async function getWalletTokenBalances(publicKeyStr) {
  try {
    const { data } = await axios.post(config.HELIUS_RPC_URL, {
      jsonrpc: "2.0", id: "hawkx-scan", method: "getAssetsByOwner",
      params: { ownerAddress: publicKeyStr, page: 1, limit: 100, displayOptions: { showFungible: true } },
    }, { timeout: 10000 });

    const items = data?.result?.items || [];
    return items
      .filter(i => i.token_info && i.token_info.balance > 0)
      .map(i => ({
        mint: i.id,
        amount: i.token_info.balance / Math.pow(10, i.token_info.decimals || 0),
        decimals: i.token_info.decimals || 0,
        symbol: i.token_info.symbol || null,
      }));
  } catch (e) {
    console.error("[WalletScanner] failed:", e.message);
    return [];
  }
}

module.exports = { getWalletTokenBalances };
