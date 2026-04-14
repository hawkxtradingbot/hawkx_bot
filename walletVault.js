// M45 — Wallet Vault (Devnet)
const crypto = require('crypto');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const db = require('../../database');
const config = require('../../config');
const { t } = require('./i18n');

const ALGORITHM = 'aes-256-gcm';

function deriveKey(salt) {
  return crypto.pbkdf2Sync(config.AES_MASTER_SECRET, salt, 100000, 32, 'sha256');
}

function encryptKey(privateKeyB58) {
  const salt = crypto.randomBytes(32).toString('hex');
  const iv = crypto.randomBytes(16);
  const key = deriveKey(salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyB58, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: encrypted.toString('hex'), salt, iv: iv.toString('hex'), tag: tag.toString('hex') };
}

function decryptKey(enc) {
  const key = deriveKey(enc.salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(enc.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(enc.encrypted, 'hex')), decipher.final()]).toString('utf8');
}

async function addWallet(ctx, user, privateKeyB58OrGenerate) {
  const limit = config.WALLET_LIMITS[user.rank] || 5;
  const count = db.countWallets(user.user_id);

  if (count >= limit) {
    await ctx.reply(t('wallet.limit', user.language, { limit }));
    return;
  }

  let keypair;
  try {
    if (privateKeyB58OrGenerate === 'generate') {
      keypair = Keypair.generate();
      await ctx.reply('🔑 Generating new devnet wallet...');
    } else {
      keypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58OrGenerate));
    }
  } catch (e) {
    await ctx.reply('❌ Invalid private key. Please send a valid base58 key, or tap Generate.');
    return;
  }

  const publicKey = keypair.publicKey.toBase58();
  const enc = encryptKey(bs58.encode(keypair.secretKey));
  const label = `Wallet ${count + 1}`;
  const walletId = db.addWallet(user.user_id, publicKey, enc.encrypted, enc.salt, enc.iv, enc.tag, label);

  if (!user.active_wallet_id) {
    db.updateUser(user.user_id, { active_wallet_id: walletId });
  }

  await ctx.reply(
    t('wallet.added', user.language, { address: publicKey }) +
    '\n\n💡 Tap /faucet to get free devnet SOL!',
    { parse_mode: 'Markdown' }
  );

  // Auto airdrop if devnet mode
  if (config.AUTO_AIRDROP) {
    const { airdropToWallet } = require('./faucet');
    const result = await airdropToWallet(publicKey, 2);
    if (result.success) {
      await ctx.reply('🚰 Auto-airdrop: 2 devnet SOL sent to your new wallet!');
    }
  }
}

function decryptWallet(walletId) {
  const wallet = db.getWallet(walletId);
  if (!wallet) throw new Error('Wallet not found');
  const privateKeyB58 = decryptKey({
    encrypted: wallet.encrypted_private_key,
    salt: wallet.encryption_salt,
    iv: wallet.encryption_iv,
    tag: wallet.encryption_tag,
  });
  return Keypair.fromSecretKey(bs58.decode(privateKeyB58));
}

module.exports = { addWallet, decryptWallet };
