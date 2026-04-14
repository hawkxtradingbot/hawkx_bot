const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const kp = Keypair.generate();
console.log('Public Key:', kp.publicKey.toBase58());
console.log('Private Key:', bs58.default.encode(kp.secretKey));
