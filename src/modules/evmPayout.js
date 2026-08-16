// Shared EVM native-coin payout — pays ETH (or chain native) OUT of the EVM treasury.
// Used by referral / cashback / reward claims for HOOD/EVM earnings.
const { ethers } = require("ethers");
const db = require("../../database");

// Sends `amountEth` of the chain's native coin from EVM_TREASURY to `toAddr`.
// Returns { ok, txHash } or { ok:false, error }.
async function sendEvmNative(toAddr, amountEth, chain = "HOOD") {
  try {
    const key = process.env.EVM_TREASURY_PRIVATE_KEY || "";
    if (!key) return { ok: false, error: "EVM treasury not configured" };
    const cfg = db.getChainConfig(chain);
    if (!cfg?.rpc_url) return { ok: false, error: "chain RPC not configured" };
    if (!toAddr || !amountEth || amountEth <= 0) return { ok: false, error: "invalid payout params" };

    const provider = new ethers.JsonRpcProvider(cfg.rpc_url);
    const treasury = new ethers.Wallet(key, provider);
    const value = ethers.parseEther(String(amountEth));

    // Ensure treasury holds enough (value + a little for gas)
    const bal = await provider.getBalance(treasury.address);
    if (bal < value) return { ok: false, error: "treasury holds insufficient balance" };

    const tx = await treasury.sendTransaction({ to: toAddr, value });
    const receipt = await tx.wait();
    return { ok: true, txHash: receipt.hash };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

module.exports = { sendEvmNative };
