// M45 — Wallet Vault V12
// #08 — Delete wallet function added
// #09 — Wallet limit enforced by rank
// New — deposit/withdraw helpers

const crypto  = require("crypto");
const { Keypair } = require("@solana/web3.js");
const bs58    = require("bs58");
const db      = require("../../database");
const config  = require("../../config");
const { t }   = require("./i18n");

const ALGORITHM = "aes-256-gcm";

// ── Encryption ───────────────────────────────────────────────
function deriveKey(salt) {
  return crypto.pbkdf2Sync(config.AES_MASTER_SECRET, salt, 100000, 32, "sha256");
}

function encryptKey(privateKeyB58) {
  const salt      = crypto.randomBytes(32).toString("hex");
  const iv        = crypto.randomBytes(16);
  const key       = deriveKey(salt);
  const cipher    = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyB58, "utf8"), cipher.final()]);
  const tag       = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString("hex"),
    salt,
    iv:  iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

function decryptKey(enc) {
  const key      = deriveKey(enc.salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(enc.iv, "hex"));
  decipher.setAuthTag(Buffer.from(enc.tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.encrypted, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

// ── Add Wallet ───────────────────────────────────────────────
async function addWallet(ctx, user, privateKeyB58OrGenerate) {
  const limit = config.WALLET_LIMITS[user.rank] || 5;
  const count = db.countWallets(user.user_id);

  if (count >= limit) {
    await ctx.reply(
      `❌ Wallet limit reached (${limit} wallets for your rank).\n\n` +
      `Delete an existing wallet first, or rank up to unlock more.`
    );
    return;
  }

  let keypair;
  try {
    if (privateKeyB58OrGenerate === "generate") {
      keypair = Keypair.generate();
    } else {
      keypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58OrGenerate));
    }
  } catch (e) {
    await ctx.reply("❌ Invalid private key. Please send a valid base58 key.");
    return;
  }

  const publicKey = keypair.publicKey.toBase58();
  const enc       = encryptKey(bs58.encode(keypair.secretKey));
  const label     = `W${count + 1}`;
  const walletId  = db.addWallet(
    user.user_id, publicKey,
    enc.encrypted, enc.salt, enc.iv, enc.tag, label
  );

  if (!user.active_wallet_id) {
    db.updateUser(user.user_id, { active_wallet_id: walletId });
  }

  // Only show the detailed screen for IMPORT; generate shows a short confirmation in the handler
  if (privateKeyB58OrGenerate !== "generate") {
    await ctx.reply(
      `✅ *Wallet Imported!*\n\n` +
      `🏷 Label: *${label}*\n` +
      `📋 Address:\n\`${publicKey}\`\n\n` +
      `💡 Tap the address to copy it.`,
      { parse_mode: "Markdown" }
    );
  }

  if (config.AUTO_AIRDROP) {
    const { airdropToWallet } = require("./faucet");
    const result = await airdropToWallet(publicKey, 2);
    if (result.success) {
      await ctx.reply("🚰 Auto-airdrop: 2 devnet SOL sent!");
    }
  }
}

// ── Delete Wallet ────────────────────────────────────────────
async function deleteWallet(ctx, user, walletId) {
  const wallets = db.getWallets(user.user_id);

  // Can't delete if only 1 wallet left
  if (wallets.length <= 1) {
    await ctx.answerCallbackQuery("❌ Can't delete your only wallet.");
    return false;
  }

  const wallet = db.getWallet(walletId);
  if (!wallet || wallet.user_id !== user.user_id) {
    await ctx.answerCallbackQuery("❌ Wallet not found.");
    return false;
  }

  // If deleting active wallet — switch to another first
  if (user.active_wallet_id === walletId) {
    const other = wallets.find((w) => w.wallet_id !== walletId);
    if (other) {
      db.updateUser(user.user_id, { active_wallet_id: other.wallet_id });
    }
  }

  // Delete from DB
  db.getDb()
    .prepare("DELETE FROM wallets WHERE wallet_id = ? AND user_id = ?")
    .run(walletId, user.user_id);

  return true;
}

// ── Decrypt Wallet ───────────────────────────────────────────
function decryptWallet(walletId) {
  const wallet = db.getWallet(walletId);
  if (!wallet) throw new Error("Wallet not found");
  const privateKeyB58 = decryptKey({
    encrypted: wallet.encrypted_private_key,
    salt:      wallet.encryption_salt,
    iv:        wallet.encryption_iv,
    tag:       wallet.encryption_tag,
  });
  return Keypair.fromSecretKey(bs58.decode(privateKeyB58));
}

// ── Validate Solana Address ──────────────────────────────────
function isSolanaAddress(address) {
  if (!address || typeof address !== "string") return false;
  if (address.length < 32 || address.length > 44) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(address)) return false;
  try {
    const { PublicKey } = require("@solana/web3.js");
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

module.exports = { addWallet, deleteWallet, decryptWallet, isSolanaAddress };
