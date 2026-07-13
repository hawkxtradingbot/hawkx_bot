// EVM wallet module (Robinhood Chain + future EVM chains) - kept fully separate from Solana code.
// Reuses the same AES-256-GCM encryption pattern from walletVault.js.
const { ethers } = require("ethers");
const { encryptKey, decryptKey } = require("../../walletVault");
const db = require("../../../../database");

async function createEvmWallet(userId, chain, label) {
  const wallet = ethers.Wallet.createRandom();
  const enc = encryptKey(wallet.privateKey);
  const walletId = db.addWallet(
    userId, wallet.address,
    enc.encrypted, enc.salt, enc.iv, enc.tag,
    label || "W1", chain
  );
  return { walletId, address: wallet.address };
}

async function importEvmWallet(userId, chain, privateKey, label) {
  let wallet;
  try {
    wallet = new ethers.Wallet(privateKey);
  } catch (e) {
    throw new Error("Invalid EVM private key");
  }
  const enc = encryptKey(wallet.privateKey);
  const walletId = db.addWallet(
    userId, wallet.address,
    enc.encrypted, enc.salt, enc.iv, enc.tag,
    label || "W1", chain
  );
  return { walletId, address: wallet.address };
}

function decryptEvmWallet(dbWallet) {
  const privateKey = decryptKey({
    encrypted: dbWallet.encrypted_private_key,
    salt: dbWallet.encryption_salt,
    iv: dbWallet.encryption_iv,
    tag: dbWallet.encryption_tag,
  });
  return new ethers.Wallet(privateKey);
}

async function getEvmBalance(address, rpcUrl) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const balWei = await provider.getBalance(address);
  return parseFloat(ethers.formatEther(balWei));
}

module.exports = { createEvmWallet, importEvmWallet, decryptEvmWallet, getEvmBalance };
