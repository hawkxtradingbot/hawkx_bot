// Token-agnostic SPL transfer helper. Used by cashback + token rewards.
// sendSplToken sends `uiAmount` of any SPL `mint` from a funded Keypair to a destination wallet.
// Reads the mint's real decimals, creates the recipient's associated token account if missing
// (payer = sender), and returns { ok, signature } or { ok:false, error }.
const {
  Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  getOrCreateAssociatedTokenAccount, createTransferCheckedInstruction, getMint,
} = require("@solana/spl-token");

function conn() {
  const url = process.env.HELIUS_RPC_URL || process.env.BACKUP_RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(url, "confirmed");
}

// fromKeypair: sender (funded, holds the token AND some SOL for fees + ATA rent)
// mintAddr: the SPL token mint (string)
// toAddr: recipient wallet (string)
// uiAmount: human amount (e.g. 1.5) — converted to base units using the mint's decimals
async function sendSplToken(fromKeypair, mintAddr, toAddr, uiAmount) {
  try {
    const c = conn();
    const mint = new PublicKey(mintAddr);
    const dest = new PublicKey(toAddr);

    const mintInfo = await getMint(c, mint);
    const decimals = mintInfo.decimals;
    const rawAmount = BigInt(Math.round(uiAmount * Math.pow(10, decimals)));
    if (rawAmount <= 0n) return { ok: false, error: "amount too small" };

    // Sender's token account (must already exist + hold enough)
    const fromAta = await getOrCreateAssociatedTokenAccount(c, fromKeypair, mint, fromKeypair.publicKey);
    if (BigInt(fromAta.amount) < rawAmount) return { ok: false, error: "treasury holds insufficient token balance" };

    // Recipient's token account (created if missing, sender pays rent)
    const toAta = await getOrCreateAssociatedTokenAccount(c, fromKeypair, mint, dest);

    const ix = createTransferCheckedInstruction(
      fromAta.address, mint, toAta.address, fromKeypair.publicKey, rawAmount, decimals
    );
    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(c, tx, [fromKeypair], { commitment: "confirmed" });
    return { ok: true, signature: sig, decimals };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

module.exports = { sendSplToken };
