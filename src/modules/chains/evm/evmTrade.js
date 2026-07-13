// EVM buy/sell execution (Robinhood Chain etc). Mirrors the mockBuy/mockSell dual-mode
// pattern from executor.js: MOCK_TRADES=true simulates (for safe testing), false executes
// real swaps via Uniswap. Kept fully separate from Solana code.
const db = require("../../../../database");

async function evmBuy(ctx, user, tokenAddress, amountEth, source, sourceRef, opts = {}, chain) {
  const REAL = process.env.MOCK_TRADES === "false";
  const chainCfg = db.getChainConfig(chain);
  const wallet = db.getWalletForChain(user.user_id, chain);
  if (!wallet) {
    if (!opts.silent) await ctx.reply(`❌ No ${chainCfg?.label || chain} wallet found. Switch to this chain first to create one.`);
    return null;
  }

  const processingMsg = opts.silent ? null : await ctx.reply(
    `🔄 *Processing buy...*\n\nToken: \`${tokenAddress.slice(0,12)}...\`\nAmount: *${amountEth} ${chainCfg?.native_symbol || 'ETH'}*`,
    { parse_mode: "Markdown" }
  );

  if (!REAL) {
    // Simulated mode - same testing philosophy as Solana's mock path, no real chain interaction
    const simPrice = 1 + Math.random() * 0.01; // placeholder simulated price for testing UI/DB flow only
    const tokenAmount = amountEth / simPrice;
    const txHash = `EVM_MOCK_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

    const tradeId = db.recordTrade({
      userId: user.user_id, walletId: wallet.wallet_id,
      tokenCa: tokenAddress, tokenName: tokenAddress.slice(0,8),
      platform: "evm_mock", action: "buy",
      solAmount: amountEth, tokenAmount, priceSol: simPrice,
      feeSol: 0, feeRate: 0, txHash, status: "confirmed",
      chain,
    });
    db.openPosition({
      userId: user.user_id, walletId: wallet.wallet_id,
      tokenCa: tokenAddress, tokenName: tokenAddress.slice(0,8),
      buyPrice: simPrice, solInvested: amountEth, tokenAmount,
      platform: "evm_mock", source, sourceRef, chain,
    });

    if (processingMsg) { try { await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, `✅ [SIMULATED] Bought ${tokenAmount.toFixed(4)} tokens for ${amountEth} ${chainCfg?.native_symbol}`); } catch {} }
    return { tradeId, txHash, tokenAmount };
  }

  // ── REAL EXECUTION ──────────────────────────────────────────
  try {
    const { decryptEvmWallet } = require("./wallet");
    const { getQuote, executeSwap } = require("./uniswap");
    const { ethers } = require("ethers");
    const evmWallet = decryptEvmWallet(wallet);
    const amountInWei = ethers.parseEther(String(amountEth));
    const settings = db.getSettings(user.user_id) || {};
    const slippage = settings.slippage_pct || 10;

    const result = await executeSwap({
      chain, wallet: evmWallet,
      tokenIn: chainCfg.weth_address, tokenOut: tokenAddress,
      amountIn: amountInWei, slippagePct: slippage, isNativeIn: true,
    });

    const tokenAmountFloat = parseFloat(ethers.formatUnits(result.amountOut, 18)); // assumes 18 decimals - real decimals lookup is a follow-up improvement
    const tradeId = db.recordTrade({
      userId: user.user_id, walletId: wallet.wallet_id,
      tokenCa: tokenAddress, tokenName: tokenAddress.slice(0,8),
      platform: "evm_real", action: "buy",
      solAmount: amountEth, tokenAmount: tokenAmountFloat, priceSol: amountEth / tokenAmountFloat,
      feeSol: 0, feeRate: 0, txHash: result.txHash, status: "confirmed",
      chain,
    });
    db.openPosition({
      userId: user.user_id, walletId: wallet.wallet_id,
      tokenCa: tokenAddress, tokenName: tokenAddress.slice(0,8),
      buyPrice: amountEth / tokenAmountFloat, solInvested: amountEth, tokenAmount: tokenAmountFloat,
      platform: "evm_real", source, sourceRef, chain,
    });

    if (processingMsg) { try { await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, `✅ Bought ${tokenAmountFloat.toFixed(4)} tokens\nTx: ${result.txHash.slice(0,12)}...`); } catch {} }
    return { tradeId, txHash: result.txHash, tokenAmount: tokenAmountFloat };
  } catch (e) {
    console.error("[EVM Buy] failed:", e.message);
    const errMsg = "❌ Buy failed: " + String(e.message || "unknown error").slice(0,100);
    if (processingMsg) { try { await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, errMsg); } catch {} }
    else if (!opts.silent) { await ctx.reply(errMsg); }
    try { require("../../adminAlert").alertAdmin("EVM Buy", e.message).catch(()=>{}); } catch {}
    return null;
  }
}

module.exports = { evmBuy };
