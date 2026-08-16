// Uniswap V3 swap module for EVM chains (Robinhood Chain first). Kept fully separate from Solana/Jupiter code.
// Uses verified contract addresses stored in chain_config (never hardcoded/guessed here).
const { ethers } = require("ethers");
const db = require("../../../../database");

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
  // SwapRouter02 has NO deadline field on ExactInputSingleParams (confirmed against the real
  // deployed contract). Deadline protection instead comes from wrapping the call in multicall.
  "function multicall(uint256 deadline, bytes[] calldata data) external payable returns (bytes[] memory results)",
];
const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const DEFAULT_FEE_TIER = 3000; // 0.3% - fallback default
const FEE_TIERS = [3000, 10000, 500, 100]; // 0.3%, 1%, 0.05%, 0.01% - try in this order

// Quote across all standard Uniswap-V3 fee tiers and return the best (highest amountOut) with its tier.
async function getBestQuote(chain, tokenIn, tokenOut, amountIn) {
  const cfg = db.getChainConfig(chain);
  if (!cfg?.quoter) throw new Error("Quoter address not configured for this chain");
  const provider = new ethers.JsonRpcProvider(cfg.rpc_url);
  const quoter = new ethers.Contract(cfg.quoter, QUOTER_ABI, provider);
  let best = null;
  for (const fee of FEE_TIERS) {
    try {
      const result = await quoter.quoteExactInputSingle.staticCall({ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0 });
      const out = result[0];
      if (out > 0n && (!best || out > best.amountOut)) best = { amountOut: out, feeTier: fee };
    } catch { /* no pool at this tier — skip */ }
  }
  if (!best) throw new Error("No liquidity pool found for this pair at any fee tier");
  return best;
}

// Back-compat: returns just amountOut (best tier)
async function getQuote(chain, tokenIn, tokenOut, amountIn) {
  const best = await getBestQuote(chain, tokenIn, tokenOut, amountIn);
  return best.amountOut;
}

async function executeSwap({ chain, wallet, tokenIn, tokenOut, amountIn, slippagePct, isNativeIn }) {
  const cfg = db.getChainConfig(chain);
  if (!cfg?.swap_router) throw new Error("Swap router not configured for this chain");
  const provider = new ethers.JsonRpcProvider(cfg.rpc_url);
  const signer = wallet.connect(provider);

  // BUG 3 fix: pick the fee tier that actually has liquidity (not a hardcoded 0.3%)
  const best = await getBestQuote(chain, tokenIn, tokenOut, amountIn);
  const quotedOut = best.amountOut;
  const feeTier = best.feeTier;
  const minOut = quotedOut - (quotedOut * BigInt(Math.floor(slippagePct * 100)) / 10000n);

  // Approve if swapping FROM an ERC-20 (not needed when paying with native ETH directly)
  if (!isNativeIn) {
    const erc20 = new ethers.Contract(tokenIn, ERC20_ABI, signer);
    const currentAllowance = await erc20.allowance(await signer.getAddress(), cfg.swap_router);
    if (currentAllowance < amountIn) {
      const approveTx = await erc20.approve(cfg.swap_router, amountIn);
      await approveTx.wait();
    }
  }

  const router = new ethers.Contract(cfg.swap_router, SWAP_ROUTER_ABI, signer);
  // Deadline protection: SwapRouter02's ExactInputSingleParams has no deadline field, so we
  // wrap the call in multicall(deadline, [data]) instead — the standard SwapRouter02 pattern.
  const deadline = Math.floor(Date.now() / 1000) + 120; // 2 minutes
  const swapData = router.interface.encodeFunctionData("exactInputSingle", [
    { tokenIn, tokenOut, fee: feeTier, recipient: await signer.getAddress(), amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0 }
  ]);
  const tx = await router.multicall(deadline, [swapData],
    isNativeIn ? { value: amountIn } : {}
  );
  const receipt = await tx.wait();

  // BUG 5 fix: read the ACTUAL amount received from the swap logs, not the pre-trade quote.
  // Fall back to quotedOut only if log parsing fails.
  let actualOut = quotedOut;
  try {
    const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
    const me = (await signer.getAddress()).toLowerCase();
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== tokenOut.toLowerCase()) continue;
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.args.to.toLowerCase() === me) { actualOut = parsed.args.value; break; }
      } catch {}
    }
  } catch {}
  return { txHash: receipt.hash, amountOut: actualOut, quotedOut, feeTier };
}


async function getTokenInfo(chain, tokenAddress) {
  const cfg = db.getChainConfig(chain);
  const provider = new ethers.JsonRpcProvider(cfg.rpc_url);
  const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI.concat([
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
  ]), provider);
  let name = "Unknown", symbol = "", decimals = 18;
  try { name = await erc20.name(); } catch {}
  try { symbol = await erc20.symbol(); } catch {}
  try { decimals = await erc20.decimals(); } catch {}

  let priceInEth = 0;
  try {
    const oneToken = ethers.parseUnits("1", decimals);
    const quoted = await getQuote(chain, tokenAddress, cfg.weth_address, oneToken);
    priceInEth = parseFloat(ethers.formatEther(quoted));
  } catch {}

  return { name, symbol, decimals, priceInEth, address: tokenAddress };
}


async function getTokenDecimals(chain, tokenAddress) {
  const cfg = db.getChainConfig(chain);
  const provider = new ethers.JsonRpcProvider(cfg.rpc_url);
  const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  try {
    const d = await erc20.decimals();
    return Number(d);
  } catch {
    return 18; // fallback only if the call itself fails (rare) - most tokens are 18 but this is now the exception path, not the default assumption
  }
}

module.exports = { getQuote, executeSwap, getTokenInfo, getTokenDecimals, DEFAULT_FEE_TIER };
