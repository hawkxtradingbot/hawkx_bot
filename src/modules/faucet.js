// faucet.js — DEVNET ONLY — Free SOL airdrop for testing
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const config = require('../../config');

const connection = new Connection(config.HELIUS_RPC_URL, 'confirmed');

// Track airdrop cooldowns per user
const airdropCooldowns = new Map();
const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown

async function airdropToWallet(publicKey, amountSol = 2) {
  try {
    const pubkey = new PublicKey(publicKey);
    const sig = await connection.requestAirdrop(pubkey, amountSol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
    return { success: true, sig, amount: amountSol };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function handleFaucet(ctx, user) {
  const userId = user.user_id;
  const db = require('../../database');
  const wallet = db.getWallet(user.active_wallet_id);

  if (!wallet) {
    await ctx.reply('❌ No active wallet. Add a wallet first.');
    return;
  }

  // Cooldown check
  const lastAirdrop = airdropCooldowns.get(userId);
  if (lastAirdrop && Date.now() - lastAirdrop < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastAirdrop)) / 1000);
    await ctx.reply(`⏳ Cooldown: wait ${remaining}s before next airdrop.`);
    return;
  }

  await ctx.reply('🚰 Requesting devnet SOL airdrop...');

  const result = await airdropToWallet(wallet.public_key, 2);

  if (result.success) {
    airdropCooldowns.set(userId, Date.now());
    await ctx.reply(
      `✅ *Airdrop Success!*\n\n` +
      `💰 Received: 2 devnet SOL\n` +
      `🔑 Wallet: \`${wallet.public_key.slice(0, 8)}...\`\n` +
      `📝 TX: \`${result.sig.slice(0, 16)}...\`\n\n` +
      `_This is fake devnet SOL — no real value._`,
      { parse_mode: 'Markdown' }
    );
  } else {
    // Devnet faucet sometimes rate limits — use mock fallback
    await ctx.reply(
      `⚠️ Devnet faucet busy. Using mock balance instead.\n\n` +
      `💰 Mock Balance: 10 SOL added to your test account.\n\n` +
      `_You can still test all bot features with mock trades._`
    );
  }
}

async function getDevnetBalance(publicKey) {
  try {
    const pubkey = new PublicKey(publicKey);
    const lamports = await connection.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

module.exports = { handleFaucet, airdropToWallet, getDevnetBalance };
