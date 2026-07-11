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


// Decompile a VersionedTransaction's message, add a SystemProgram.transfer instruction, recompile.
// Must actually FETCH the address lookup table accounts from chain - the message only carries
// their addresses + index lists, not the resolved account data. Without this, decompile() fails
// or produces a broken message for any Jupiter swap that uses ALTs (which is nearly all of them).
async function injectTransferInstruction(tx, fromPubkey, toPubkey, lamports, connection) {
  const message = tx.message;
  const altLookups = message.addressTableLookups || [];
  const resolvedALTs = [];
  for (const lookup of altLookups) {
    const res = await connection.getAddressLookupTable(lookup.accountKey);
    if (res && res.value) resolvedALTs.push(res.value);
  }
  const decompiled = TransactionMessage.decompile(message, { addressLookupTableAccounts: resolvedALTs });
  const transferIx = SystemProgram.transfer({ fromPubkey, toPubkey, lamports });
  decompiled.instructions.push(transferIx);
  const newMessage = decompiled.compileToV0Message(resolvedALTs);
  return new VersionedTransaction(newMessage);
}


// Solana Memo Program - adds a visible "HawkX" tag to transactions on Solscan/explorers
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
function buildMemoInstruction(text) {
  const { TransactionInstruction } = require("@solana/web3.js");
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(text, "utf8"),
  });
}

// Inject one or more extra instructions (memo, fee transfer, etc.) into a swap tx, handling ALTs correctly
// Cache resolved address lookup tables (they rarely change) to skip repeat RPC round-trips -
// this was measured at ~538ms per trade for Jupiter's typical single-ALT route, pure overhead
// from our fee/memo injection feature. 5 min TTL balances speed against staleness risk.
const _altCache = new Map();
const ALT_CACHE_TTL = 5 * 60 * 1000;
async function getCachedALT(connection, accountKey) {
  const key = accountKey.toBase58();
  const cached = _altCache.get(key);
  if (cached && Date.now() - cached.t < ALT_CACHE_TTL) return cached.value;
  const res = await connection.getAddressLookupTable(accountKey);
  if (res && res.value) {
    _altCache.set(key, { value: res.value, t: Date.now() });
    return res.value;
  }
  return null;
}

async function injectInstructions(tx, extraInstructions, connection) {
  const message = tx.message;
  const altLookups = message.addressTableLookups || [];
  const resolvedALTs = [];
  for (const lookup of altLookups) {
    const alt = await getCachedALT(connection, lookup.accountKey);
    if (alt) resolvedALTs.push(alt);
  }
  const decompiled = TransactionMessage.decompile(message, { addressLookupTableAccounts: resolvedALTs });
  for (const ix of extraInstructions) decompiled.instructions.push(ix);
  const newMessage = decompiled.compileToV0Message(resolvedALTs);
  return new VersionedTransaction(newMessage);
}

// Build + send a swap. Returns { ok, signature, error }.
async function executeSwap({ keypair, quote, speed, jitoTipLamports, customFeeSol, feeLamports }) {
  // returns feeCollected: true/false so callers know if the fee actually made it into the tx
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

  // Deserialize
  const txBuf = Buffer.from(swapData.swapTransaction, "base64");
  let tx = VersionedTransaction.deserialize(txBuf);

  // Fold the fee transfer (user -> treasury) AND the HawkX memo into this same transaction
  const extraIx = [];
  let feeInjected = false;
  if (feeLamports && feeLamports > 0 && process.env.TREASURY_WALLET) {
    extraIx.push(SystemProgram.transfer({ fromPubkey: keypair.publicKey, toPubkey: new PublicKey(process.env.TREASURY_WALLET), lamports: feeLamports }));
    feeInjected = true;
  }
  extraIx.push(buildMemoInstruction("HawkX"));

  if (extraIx.length > 0) {
    try {
      tx = await injectInstructions(tx, extraIx, connection);
    } catch (e) {
      console.log("[Instruction Inject] failed, proceeding WITHOUT fee/memo:", e.message);
      feeInjected = false;
    }
  }

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
      await new Promise(r => setTimeout(r, 150)); // poll every 150ms (was 1s - detects confirmation as soon as it happens instead of up to 1s late)
    }
    if (!confirmed) {
      // Do a final check via searchTransactionHistory before giving up
      try {
        const finalSt = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
        const fs2 = finalSt && finalSt.value && finalSt.value[0];
        if (fs2 && !fs2.err && (fs2.confirmationStatus === "confirmed" || fs2.confirmationStatus === "finalized")) {
          return { ok: true, signature, feeCollected: feeInjected };
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
        return { ok: true, signature, feeCollected: feeInjected };
      }
    } catch {}
    return { ok: false, error: "could not verify confirmation — assumed failed", signature };
  }

  return { ok: true, signature, feeCollected: feeInjected };
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

async function realBuy({ keypair, tokenMint, solLamports, slippageBps, speed, jitoTipLamports, customFeeSol, feeLamports }) {
  const quote = await getQuote(SOL_MINT, tokenMint, String(solLamports), slippageBps);
  if (!quote || quote.error) return { ok: false, error: quote && quote.error ? quote.error : "no quote" };
  const res = await executeSwap({ keypair, quote, speed, jitoTipLamports, customFeeSol, feeLamports });
  const decimals = await getTokenDecimals(tokenMint);
  return { ...res, outAmount: quote.outAmount, inAmount: quote.inAmount, decimals };
}

// High-level: sell a token for SOL. tokenAmountRaw = integer string in token base units.
async function realSell({ keypair, tokenMint, tokenAmountRaw, slippageBps, speed, jitoTipLamports, customFeeSol, feeRate }) {
  const quote = await getQuote(tokenMint, SOL_MINT, String(tokenAmountRaw), slippageBps);
  if (!quote || quote.error) return { ok: false, error: quote && quote.error ? quote.error : "no quote" };
  // Compute the fee from the quote's expected SOL output (outAmount is in lamports already)
  const expectedOutLamports = Number(quote.outAmount) || 0;
  const feeLamports = (feeRate && feeRate > 0) ? Math.floor(expectedOutLamports * feeRate) : 0;
  const res = await executeSwap({ keypair, quote, speed, jitoTipLamports, customFeeSol, feeLamports });
  const decimals = await getTokenDecimals(tokenMint);
  return { ...res, outAmount: quote.outAmount, inAmount: quote.inAmount, decimals, feeLamports };
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
