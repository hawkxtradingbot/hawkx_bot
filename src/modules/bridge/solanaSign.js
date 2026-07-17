// Signs and sends Relay bridge deposit transactions originating from Solana.
// Handles the raw-instructions + address-lookup-table format Relay returns for Solana-origin quotes.
// Kept fully separate from core Solana trading code (walletVault.js/executor.js untouched).
const { Connection, PublicKey, TransactionMessage, VersionedTransaction, TransactionInstruction } = require("@solana/web3.js");
const config = require("../../../config");

async function signAndSendSolanaDeposit(keypair, stepItemData) {
  const connection = new Connection(config.HELIUS_RPC_URL, "confirmed");

  const instructions = stepItemData.instructions.map(ix => new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.keys.map(k => ({ pubkey: new PublicKey(k.pubkey), isSigner: k.isSigner, isWritable: k.isWritable })),
    data: Buffer.from(ix.data, "hex"),
  }));

  // Resolve address lookup tables if the route needs them (keeps transaction size under limits)
  let lookupTables = [];
  if (stepItemData.addressLookupTableAddresses?.length) {
    const altAccounts = await Promise.all(
      stepItemData.addressLookupTableAddresses.map(addr => connection.getAddressLookupTable(new PublicKey(addr)))
    );
    lookupTables = altAccounts.map(r => r.value).filter(Boolean);
  }

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTables);

  const tx = new VersionedTransaction(message);
  tx.sign([keypair]);

  const sig = await connection.sendTransaction(tx, { maxRetries: 5 });
  return sig;
}

module.exports = { signAndSendSolanaDeposit };
