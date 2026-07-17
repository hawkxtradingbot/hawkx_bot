// Universal Bridge UI - single expandable screen (chain -> token -> chain -> token -> amount -> confirm)
// Uses Relay Protocol (src/modules/bridge/relay.js) for real cross-chain execution.
const db = require("../../../database");

const CHAIN_OPTIONS = [
  { key: "SOL", label: "🟣 Solana", relayId: 792703809 },
  { key: "ETH", label: "⚪ Ethereum", relayId: 1 },
  { key: "BASE", label: "🔵 Base", relayId: 8453 },
  { key: "ARBITRUM", label: "🔷 Arbitrum", relayId: 42161 },
  { key: "HOOD", label: "🟢 Robinhood Chain", relayId: 4663 },
];

const TOKEN_OPTIONS = {
  SOL: [{ symbol: "SOL", address: "11111111111111111111111111111111111111112" }],
  ETH: [{ symbol: "ETH", address: "0x0000000000000000000000000000000000000000" }, { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }],
  BASE: [{ symbol: "ETH", address: "0x0000000000000000000000000000000000000000" }],
  ARBITRUM: [{ symbol: "ETH", address: "0x0000000000000000000000000000000000000000" }],
  HOOD: [{ symbol: "ETH", address: "0x0000000000000000000000000000000000000000" }],
};

function buildBridgeText(state) {
  let msg = `🌉 *Universal Bridge*\n\nMove funds from one chain to another, directly in HawkX.\n\n`;
  msg += `*From:* ${state.fromChain ? CHAIN_OPTIONS.find(c=>c.key===state.fromChain)?.label : "— tap to select —"}`;
  if (state.fromToken) msg += ` (${state.fromToken})`;
  msg += `\n*To:* ${state.toChain ? CHAIN_OPTIONS.find(c=>c.key===state.toChain)?.label : "— tap to select —"}`;
  if (state.toToken) msg += ` (${state.toToken})`;
  msg += `\n*Amount:* ${state.amount || "— not set —"}\n`;
  return msg;
}

function buildBridgeKeyboard(state) {
  const rows = [];
  if (!state.fromChain) {
    CHAIN_OPTIONS.forEach(c => rows.push([{ text: c.label, callback_data: `bridge_from_${c.key}` }]));
  } else if (!state.fromToken) {
    (TOKEN_OPTIONS[state.fromChain] || []).forEach(t => rows.push([{ text: t.symbol, callback_data: `bridge_ftok_${t.symbol}` }]));
    rows.push([{ text: "← Change From Chain", callback_data: "bridge_reset_from" }]);
  } else if (!state.toChain) {
    CHAIN_OPTIONS.filter(c => c.key !== state.fromChain).forEach(c => rows.push([{ text: c.label, callback_data: `bridge_to_${c.key}` }]));
  } else if (!state.toToken) {
    (TOKEN_OPTIONS[state.toChain] || []).forEach(t => rows.push([{ text: t.symbol, callback_data: `bridge_ttok_${t.symbol}` }]));
    rows.push([{ text: "← Change To Chain", callback_data: "bridge_reset_to" }]);
  } else if (!state.amount) {
    rows.push([{ text: "✏️ Enter Amount", callback_data: "bridge_enter_amount" }]);
  } else {
    rows.push([{ text: "✅ Confirm Bridge", callback_data: "bridge_confirm" }]);
  }
  rows.push([{ text: "🔄 Start Over", callback_data: "bridge_start" }, { text: "← Back", callback_data: "menu_wallets" }]);
  return { inline_keyboard: rows };
}

module.exports = { CHAIN_OPTIONS, TOKEN_OPTIONS, buildBridgeText, buildBridgeKeyboard };
