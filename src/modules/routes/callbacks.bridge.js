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
// A chain is bridgeable once chain_config has a row the bot can read balances from.
// SOL is exempt from rpc_url because it reads via HELIUS_RPC_URL from env, not chain_config.
// Chains listed here but not in chain_config stay hidden until their DB row exists.
function supportedChains() {
  const list = CHAIN_OPTIONS.filter(c => {
    try {
      const cc = db.getChainConfig(c.key);
      if (!cc) return false;
      return isSol(c.key) ? true : !!cc.rpc_url;
    } catch { return false; }
  });
  return list.length ? list : CHAIN_OPTIONS.filter(c => c.key === "SOL");
}
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
    const c = db.getChainConfig(chainKey); // no cross-chain fallback - a wrong balance is worse than none
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
  if (!s.toChain || s.toChain === s.fromChain) {
    const alt = supportedChains().find(c => c.key !== s.fromChain);
    s.toChain = alt ? alt.key : (s.fromChain === "SOL" ? "HOOD" : "SOL");
  }
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

  // Fixed relayer + destination-gas costs don't scale down, so tiny bridges lose most of
  // their value. Real case: 0.0024 SOL (~$0.36) lost ~68%. Below MIN_USD we block the send.
  const MIN_USD = 5;
  let usdIn = null, lossPct = null;
  if (s.amount) {
    try {
      const px = await (isSol(s.fromChain) ? db.getSolPriceUsdShared() : db.getEthPriceUsdShared());
      usdIn = s.amount * px;
      if (s.quoteOut) {
        const pxOut = await (isSol(s.toChain) ? db.getSolPriceUsdShared() : db.getEthPriceUsdShared());
        const usdOut = Number(s.quoteOut) * pxOut;
        if (usdIn > 0 && usdOut >= 0) lossPct = ((usdIn - usdOut) / usdIn) * 100;
      }
    } catch {}
  }
  // Balance guards: sending more than you hold fails on-chain, and spending down to zero
  // leaves nothing for the network fee. Reserve matches what the Max button already subtracts.
  const GAS_RESERVE  = isSol(s.fromChain) ? 0.003 : 0.0004;
  const insufficient = !!s.amount && s.amount > fBal;
  const noGasLeft    = !!s.amount && !insufficient && (fBal - s.amount) < GAS_RESERVE;
  const tooSmall = usdIn !== null && usdIn < MIN_USD;
  const blocked  = insufficient || noGasLeft || tooSmall || (lossPct !== null && lossPct >= 40);

  // ── text ──
  let t = `🌉 *Bridge*\n`;
  if (insufficient) {
    t += `\n🚫 *Not enough ${fC.sym}.*\nYou entered ${s.amount} but hold ${fBal.toFixed(4)}. Tap Max for the most you can send.\n`;
  } else if (noGasLeft) {
    t += `\n🚫 *Keep some ${fC.sym} for the network fee.*\nYou hold ${fBal.toFixed(4)} — leave at least ${GAS_RESERVE} back. Tap Max.\n`;
  } else if (tooSmall) {
    t += `\n🚫 *Too small — you'd lose most of it.*\nNetwork costs are fixed (~$0.25), so amounts under ~$${MIN_USD} lose a huge share. Send more.\n`;
  } else if (lossPct !== null && lossPct >= 25) {
    t += `\n⚠️ *You'd lose ~${lossPct.toFixed(0)}% of this.*\nSend a larger amount to make it worthwhile.\n`;
  } else if (lossPct !== null && lossPct >= 5) {
    t += `\n⚠️ *Cost ~${lossPct.toFixed(1)}%* — higher than usual for a small amount.\n`;
  }
  t += `━━━━━━━━━━━━━━━\n`;
  t += `*FROM*  ${fC.label}  ·  ${lbl(fList, fW)}\n`;
  t += `        ${fBal.toFixed(4)} ${fC.sym}\n\n`;
  t += `*TO*    ${tC.label}  ·  ${lbl(tList, tW)}\n`;
  t += `        ${tBal.toFixed(4)} ${tC.sym}\n`;
  t += `━━━━━━━━━━━━━━━\n`;
  if (s.amount) {
    t += `Amount:   *${s.amount} ${fC.sym}*`;
    t += usdIn !== null ? `  (~$${usdIn.toFixed(2)})\n` : `\n`;
    if (s.quoteOut) {
      t += `Receive:  *~${s.quoteOut} ${tC.sym}*\n`;
      t += lossPct !== null ? `Cost:     ~${lossPct.toFixed(2)}%  ·  ~30s\n` : `Cost:     ~0.15%  ·  ~30s\n`;
    } else {
      t += `Receive:  _fetching…_\n`;
    }
  } else {
    t += `_Pick an amount below._\n`;
  }
  const blockReason = insufficient ? `Not enough ${fC.sym} — you hold ${fBal.toFixed(4)}.`
    : noGasLeft ? `Keep at least ${GAS_RESERVE} ${fC.sym} back for the network fee.`
    : tooSmall ? `Amount too small — send at least ~$${MIN_USD}.`
    : blocked ? `This amount loses too much to network costs.` : null;
  return { text: t, reply_markup: buildBridgeKeyboard(userId, s, blocked), state: s, fromBal: fBal, blocked, blockReason, minUsd: MIN_USD };
}

function buildBridgeKeyboard(userId, s, blocked) {
  const rows = [];
  const fList = walletsFor(userId, s.fromChain), tList = walletsFor(userId, s.toChain);

  // expandable pickers — only one open at a time
  if (s.exp === "fchain") {
    rows.push([{ text: "FROM — pick chain:", callback_data: "noop" }]);
    supportedChains().forEach(c =>
      rows.push([{ text: c.key === s.fromChain ? `✅ ${c.label}` : c.label, callback_data: `bridge_from_${c.key}` }]));
  } else if (s.exp === "tchain") {
    rows.push([{ text: "TO — pick chain:", callback_data: "noop" }]);
    supportedChains().forEach(c =>
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
    if (s.amount && !blocked) rows.push([{ text: "✅ Confirm Bridge", callback_data: "bridge_confirm" }]);
  }
  // While a picker is open, the only exit shown is back to the bridge screen - no duplicate row.
  if (s.exp) { rows.push([{ text: "← Back to bridge", callback_data: `bridge_exp_${s.exp}` }]); return { inline_keyboard: rows }; }
  rows.push([{ text: "🔄 Reset", callback_data: "bridge_start" }, { text: "← Back", callback_data: "menu_wallets" }]);
  return { inline_keyboard: rows };
}

function currencyFor(chainKey) { return isSol(chainKey) ? NATIVE_SOL : NATIVE_EVM; }

module.exports = { CHAIN_OPTIONS, supportedChains, NATIVE_EVM, NATIVE_SOL, cfg, isSol, walletsFor, balanceOf, pick, seed, buildBridgeScreen, buildBridgeKeyboard, currencyFor };
