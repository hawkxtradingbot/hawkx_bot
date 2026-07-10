// jupiterSwap.js — Real Solana swap execution via Jupiter v6 + priority fees + Jito
const {
  Connection, Keypair, VersionedTransaction, PublicKey,
} = require("@solana/web3.js");
const axios = require("axios");
const config = require("../../config");

const { SystemProgram, TransactionMessage, PublicKey: PK } = require("@solana/web3.js");
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JITO_ENGINE = process.env.JITO_BLOCK_ENGINE_URL || "https://mainnet.block-engine.jito.wtf";
const JITO_TIP_ACCOUNT = process.env.JITO_TIP_ACCOUNT || "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5";
// Jupiter API base — configurable via .env. Free tier: lite-api.jup.ag/swap/v1. Pro (with key): api.jup.ag/swap/v1
const JUP_BASE  = process.env.JUPITER_API_BASE || "https://lite-api.jup.ag/swap/v1";
const JUP_QUOTE = JUP_BASE + "/quote";
const JUP_SWAP  = JUP_BASE + "/swap";

function getConnection() {
  const url = process.env.HELIUS_RPC_URL || process.env.BACKUP_RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(url, "confirmed");
}

// speed: "standard" | "fast" | "turbo" -> priority fee in micro-lamports
function priorityFeeForSpeed(speed, customFeeSol) {
  if (speed === "custom" && customFeeSol && customFeeSol > 0) {
    return Math.floor(customFeeSol * 1e9); // user-set SOL -> lamports
  }
  if (speed === "turbo") return 1000000;   // ~0.01 SOL-ish ceiling via Jupiter
  if (speed === "fast")  return 200000;
  return 50000;                              // standard
}

// Get a quote. amountLamports = integer string. inputMint/outputMint are mints.
async function getQuote(inputMint, outputMint, amountLamports, slippageBps) {
  const url = JUP_QUOTE + "?inputMint=" + inputMint + "&outputMint=" + outputMint +
    "&amount=" + amountLamports + "&slippageBps=" + (slippageBps || 100) +
    "&onlyDirectRoutes=false&asLegacyTransaction=false";
  const { data } = await axios.get(url, { timeout: 15000 });
  return data;
}

// Build + send a swap. Returns { ok, signature, error }.
async function executeSwap({ keypair, quote, speed, jitoTipLamports, customFeeSol }) {
  const connection = getConnection();
  const priorityFee = priorityFeeForSpeed(speed, customFeeSol);

  // Ask Jupiter to build the swap transaction
  const useJito = jitoTipLamports && jitoTipLamports > 0;
  const body = {
    quoteResponse: quote,
    userPublicKey: keypair.publicKey.toBase58(),
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    // When using Jito, Jupiter can add the tip directly to the swap tx (goes IN the transaction)
    prioritizationFeeLamports: useJito ? { jitoTipLamports } : priorityFee,
  };
  const { data: swapData } = await axios.post(JUP_SWAP, body, { timeout: 20000 });
  if (!swapData || !swapData.swapTransaction) {
    return { ok: false, error: "No swap transaction from Jupiter" };
  }

  // Deserialize, sign
  const txBuf = Buffer.from(swapData.swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([keypair]);

  // Send: via Jito bundle (tip in tx, fastest) or normal RPC
  const raw = tx.serialize();
  let signature;
  if (useJito) {
    const b64 = Buffer.from(raw).toString("base64");
    const jres = await sendViaJito(b64);
    if (!jres.ok) {
      // Fallback to normal RPC if Jito fails
      try {
        signature = await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 3, preflightCommitment: "confirmed" });
      } catch (e) { return { ok: false, error: "Jito + RPC both failed: " + e.message }; }
    } else {
      signature = jres.signature;
    }
  } else {
    try {
      signature = await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 3, preflightCommitment: "confirmed" });
    } catch (e) {
      return { ok: false, error: "send failed: " + e.message };
    }
  }

  // Confirm — poll signature status quickly (real confirmation, faster than confirmTransaction)
  try {
    const started = Date.now();
    let confirmed = false;
    while (Date.now() - started < 30000) { // up to 30s
      const st = await connection.getSignatureStatuses([signature]);
      const s = st && st.value && st.value[0];
      if (s) {
        if (s.err) return { ok: false, error: "transaction failed on-chain", signature };
        if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") { confirmed = true; break; }
      }
      await new Promise(r => setTimeout(r, 1000)); // poll every 1s
    }
    if (!confirmed) {
      // Do a final check via searchTransactionHistory before giving up
      try {
        const finalSt = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
        const fs2 = finalSt && finalSt.value && finalSt.value[0];
        if (fs2 && !fs2.err && (fs2.confirmationStatus === "confirmed" || fs2.confirmationStatus === "finalized")) {
          return { ok: true, signature };
        }
      } catch {}
      // Genuinely not confirmed — treat as FAILURE so we never record a fake trade
      return { ok: false, error: "transaction did not confirm on-chain (timeout)", signature };
    }
  } catch (e) {
    // Confirmation check errored — verify once more, else fail safe
    try {
      const chk = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
      const c = chk && chk.value && chk.value[0];
      if (c && !c.err && (c.confirmationStatus === "confirmed" || c.confirmationStatus === "finalized")) {
        return { ok: true, signature };
      }
    } catch {}
    return { ok: false, error: "could not verify confirmation — assumed failed", signature };
  }

  return { ok: true, signature };
}

// High-level: buy a token with SOL
async function getTokenDecimals(mint) {
  try {
    const conn = getConnection();
    const { PublicKey } = require("@solana/web3.js");
    const info = await conn.getParsedAccountInfo(new PublicKey(mint));
    const dec = info?.value?.data?.parsed?.info?.decimals;
    return (typeof dec === "number") ? dec : 9;
  } catch { return 9; }
}

async function realBuy({ keypair, tokenMint, solLamports, slippageBps, speed, jitoTipLamports, customFeeSol }) {
  const quote = await getQuote(SOL_MINT, tokenMint, String(solLamports), slippageBps);
  if (!quote || quote.error) return { ok: false, error: quote && quote.error ? quote.error : "no quote" };
  const res = await executeSwap({ keypair, quote, speed, jitoTipLamports, customFeeSol });
  const decimals = await getTokenDecimals(tokenMint);
  return { ...res, outAmount: quote.outAmount, inAmount: quote.inAmount, decimals };
}

// High-level: sell a token for SOL. tokenAmountRaw = integer string in token base units.
async function realSell({ keypair, tokenMint, tokenAmountRaw, slippageBps, speed, jitoTipLamports, customFeeSol }) {
  const quote = await getQuote(tokenMint, SOL_MINT, String(tokenAmountRaw), slippageBps);
  if (!quote || quote.error) return { ok: false, error: quote && quote.error ? quote.error : "no quote" };
  const res = await executeSwap({ keypair, quote, speed, jitoTipLamports, customFeeSol });
  const decimals = await getTokenDecimals(tokenMint);
  return { ...res, outAmount: quote.outAmount, inAmount: quote.inAmount, decimals };
}

// Send a signed, serialized transaction as a Jito bundle (tip must already be in the tx or Jupiter's fee)
async function sendViaJito(base64Tx) {
  const url = JITO_ENGINE + "/api/v1/transactions";
  try {
    const { data } = await axios.post(url, {
      jsonrpc: "2.0", id: 1, method: "sendTransaction",
      params: [base64Tx, { encoding: "base64" }],
    }, { timeout: 15000, headers: { "Content-Type": "application/json" } });
    if (data && data.result) return { ok: true, signature: data.result };
    return { ok: false, error: "Jito: no result" };
  } catch (e) {
    return { ok: false, error: "Jito send failed: " + e.message };
  }
}

module.exports = {
  sendViaJito, getConnection, getQuote, executeSwap, realBuy, realSell, getTokenDecimals, priorityFeeForSpeed, SOL_MINT };
