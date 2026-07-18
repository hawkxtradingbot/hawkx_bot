// Universal Bridge UI — single screen, everything visible.
// Layout: totals on top, FROM/TO rows with chain+wallet pickers, live quote, % amount buttons.
const db = require("../../../database");

const CHAIN_OPTIONS = [
  { key: "SOL",      label: "🟣 Solana",    short: "Solana",    relayId: 792703809, sym: "SOL", dec: 9  },
  { key: "HOOD",     label: "🪶 Robinhood", short: "Robinhood", relayId: 4663,      sym: "ETH", dec: 18 },
  { key: "ETH",      label: "⚪ Ethereum",  short: "Ethereum",  relayId: 1,         sym: "ETH", dec: 18 },
  { key: "BASE",     label: "🔵 Base",      short: "Base",      relayId: 8453,      sym: "ETH", dec: 18 },
  { key: "ARBITRUM", label: "🔷 Arbitrum",  short: "Arbitrum",  relayId: 42161,     sym: "ETH", dec: 18 },
];

const NATIVE_EVM = "0x0000000000000000000000000000000000000000";
const NATIVE_SOL = "11111111111111111111111111111111";

const cfg = k => CHAIN_OPTIONS.find(c => c.key === k);
const isSol = k => k === "SOL";

// EVM wallets share one address across every EVM chain, so any non-SOL wallet works for all of them.
function walletsFor(userId, chainKey) {
  const all = db.getWallets(userId) || [];
  return isSol(chainKey) ? all.filter(w => (w.chain || "SOL") === "SOL")
                         : all.filter(w => (w.chain || "SOL") !== "SOL");
}

async function balanceOf(chainKey, address) {
  try {
    if (isSol(chainKey)) return await db.getWalletBalance(address);
    const { ethers } = require("ethers");
    const c = db.getChainConfig(chainKey) || db.getChainConfig("HOOD");
    if (!c || !c.rpc_url) return 0;
    const bal = await new ethers.JsonRpcProvider(c.rpc_url).getBalance(address);
    return Number(ethers.formatEther(bal));
  } catch { return 0; }
}

function pick(userId, state, side) {
  const chainKey = side === "from" ? state.fromChain : state.toChain;
  const wid      = side === "from" ? state.fromWallet : state.toWallet;
  const list     = walletsFor(userId, chainKey);
  return list.find(w => w.wallet_id === wid) || list[0] || null;
}

// Defaults so the screen is usable on first open with zero taps.
function seed(userId, state) {
  const s = { ...state };
  if (!s.fromChain) s.fromChain = db.getActiveChain(userId) || "SOL";
  if (!s.toChain || s.toChain === s.fromChain) s.toChain = s.fromChain === "SOL" ? "HOOD" : "SOL";
  const fw = pick(userId, s, "from"); if (fw) s.fromWallet = fw.wallet_id;
  const tw = pick(userId, s, "to");   if (tw) s.toWallet   = tw.wallet_id;
  return s;
}

async function buildBridgeScreen(userId, rawState) {
  const s  = seed(userId, rawState || {});
  const fC = cfg(s.fromChain), tC = cfg(s.toChain);
  const fW = pick(userId, s, "from"), tW = pick(userId, s, "to");

  const fBal = fW ? await balanceOf(s.fromChain, fW.public_key) : 0;
  const tBal = tW ? await balanceOf(s.toChain,   tW.public_key) : 0;

  const lbl = (list, w) => { const i = list.findIndex(x => x.wallet_id === w?.wallet_id); return i >= 0 ? `W${i+1}` : "—"; };
  const fList = walletsFor(userId, s.fromChain), tList = walletsFor(userId, s.toChain);

  // ── text ──
  let t  = `🌉 *Bridge*\n`;
  t += `━━━━━━━━━━━━━━━\n`;
  t += `*FROM*  ${fC.label}  ·  ${lbl(fList, fW)}\n`;
  t += `        ${fBal.toFixed(4)} ${fC.sym}\n\n`;
  t += `*TO*    ${tC.label}  ·  ${lbl(tList, tW)}\n`;
  t += `        ${tBal.toFixed(4)} ${tC.sym}\n`;
  t += `━━━━━━━━━━━━━━━\n`;
  if (s.amount) {
    t += `Amount:   *${s.amount} ${fC.sym}*\n`;
    t += s.quoteOut ? `Receive:  *~${s.quoteOut} ${tC.sym}*\nFee:      ~0.15%  ·  ~30s\n`
                    : `Receive:  _fetching…_\n`;
  } else {
    t += `_Pick an amount below._\n`;
  }
  return { text: t, reply_markup: buildBridgeKeyboard(userId, s), state: s, fromBal: fBal };
}

function buildBridgeKeyboard(userId, s) {
  const rows = [];
  const fList = walletsFor(userId, s.fromChain), tList = walletsFor(userId, s.toChain);

  // expandable pickers — only one open at a time
  if (s.exp === "fchain") {
    rows.push([{ text: "FROM — pick chain:", callback_data: "noop" }]);
    CHAIN_OPTIONS.filter(c => c.key !== s.toChain).forEach(c =>
      rows.push([{ text: c.key === s.fromChain ? `✅ ${c.label}` : c.label, callback_data: `bridge_from_${c.key}` }]));
  } else if (s.exp === "tchain") {
    rows.push([{ text: "TO — pick chain:", callback_data: "noop" }]);
    CHAIN_OPTIONS.filter(c => c.key !== s.fromChain).forEach(c =>
      rows.push([{ text: c.key === s.toChain ? `✅ ${c.label}` : c.label, callback_data: `bridge_to_${c.key}` }]));
  } else if (s.exp === "fwallet") {
    rows.push([{ text: "FROM — pick wallet:", callback_data: "noop" }]);
    fList.forEach((w, i) => rows.push([{ text: `${w.wallet_id === s.fromWallet ? "✅ " : ""}W${i+1}  ${w.public_key.slice(0,6)}…`, callback_data: `bridge_fw_${w.wallet_id}` }]));
  } else if (s.exp === "twallet") {
    rows.push([{ text: "TO — pick wallet:", callback_data: "noop" }]);
    tList.forEach((w, i) => rows.push([{ text: `${w.wallet_id === s.toWallet ? "✅ " : ""}W${i+1}  ${w.public_key.slice(0,6)}…`, callback_data: `bridge_tw_${w.wallet_id}` }]));
  } else {
    rows.push([
      { text: `${cfg(s.fromChain).short} ▾`, callback_data: "bridge_exp_fchain" },
      { text: "⇅",                            callback_data: "bridge_reverse"   },
      { text: `${cfg(s.toChain).short} ▾`,   callback_data: "bridge_exp_tchain" },
    ]);
    if (fList.length > 1 || tList.length > 1) rows.push([
      { text: "From wallet ▾", callback_data: "bridge_exp_fwallet" },
      { text: "To wallet ▾",   callback_data: "bridge_exp_twallet" },
    ]);
    rows.push([
      { text: "25%",  callback_data: "bridge_pct_25"  },
      { text: "50%",  callback_data: "bridge_pct_50"  },
      { text: "Max",  callback_data: "bridge_pct_100" },
      { text: "✏️",   callback_data: "bridge_enter_amount" },
    ]);
    if (s.amount) rows.push([{ text: "✅ Confirm Bridge", callback_data: "bridge_confirm" }]);
  }
  rows.push([{ text: "🔄 Reset", callback_data: "bridge_start" }, { text: "← Back", callback_data: "menu_wallets" }]);
  return { inline_keyboard: rows };
}

function currencyFor(chainKey) { return isSol(chainKey) ? NATIVE_SOL : NATIVE_EVM; }

module.exports = { CHAIN_OPTIONS, NATIVE_EVM, NATIVE_SOL, cfg, isSol, walletsFor, balanceOf, pick, seed, buildBridgeScreen, buildBridgeKeyboard, currencyFor };
