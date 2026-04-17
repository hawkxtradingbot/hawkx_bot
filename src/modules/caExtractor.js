// M24 — CA Extractor
const { PublicKey } = require('@solana/web3.js');

const KNOWN_PROGRAMS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf8Ss623VQ5DA',
  'So11111111111111111111111111111111111111112',
]);

function extractCAs(text) {
  if (!text) return [];
  const found = new Set();

  const urlPatterns = [
    /dexscreener\.com\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})/g,
    /pump\.fun\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})/g,
    /birdeye\.so\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/g,
  ];

  for (const p of urlPatterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      if (isValid(m[1])) found.add(m[1]);
    }
  }

  const re = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (isValid(m[0]) && !KNOWN_PROGRAMS.has(m[0])) found.add(m[0]);
  }

  return Array.from(found);
}

function isValid(str) {
  try { new PublicKey(str); return true; } catch { return false; }
}

module.exports = { extractCAs, isValid };