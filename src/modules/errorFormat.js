// Central error formatter. Splits every error into two audiences:
//  - user: plain message + what they can do (no jargon, no signatures)
//  - admin: only alerted for SYSTEM errors they can actually fix (RPC/Jito/treasury/API),
//    NOT for user-side mistakes (balance, slippage) which would just spam.
function formatError(err, context = "trade") {
  const raw = String((err && err.message) || err || "").toLowerCase();

  // ── USER-SIDE (their fault, they fix it — NO admin alert) ──
  if (raw.includes("insufficient") || raw.includes("0x1") || raw.includes("balance") || raw.includes("debit an account"))
    return { userMsg: "Not enough SOL for this trade plus network fees. Try a smaller amount.", alert: false };
  if (raw.includes("slippage") || raw.includes("0x1771") || raw.includes("price moved") || raw.includes("exceeds desired"))
    return { userMsg: "Price moved too much before the trade landed. Increase slippage in Settings or try again.", alert: false };
  if (raw.includes("no route") || raw.includes("no quote") || raw.includes("liquidity") || raw.includes("not tradable"))
    return { userMsg: "No trading route for this token right now — liquidity may be too low. Try again shortly or a smaller amount.", alert: false };
  if (raw.includes("too large") || raw.includes("overrun"))
    return { userMsg: "This trade was too complex to fit in one transaction. Try again, or a smaller amount.", alert: true, adminDetail: "TX SIZE overflow: " + raw };
  if (raw.includes("invalid") && raw.includes("address"))
    return { userMsg: "That address doesn't look valid. Double-check and try again.", alert: false };

  // ── SYSTEM-SIDE (your fault, you fix it — DO alert admin) ──
  if (raw.includes("jito") || raw.includes("rpc") || raw.includes("timeout") || raw.includes("fetch failed") || raw.includes("econnrefused") || raw.includes("503") || raw.includes("429"))
    return { userMsg: "🦅 HawkX Team here — the network is congested right now. Please try again in a moment.", alert: true, adminDetail: "RPC/Jito/network: " + raw };
  if (raw.includes("treasury") || raw.includes("publickey") || raw.includes("env"))
    return { userMsg: "🦅 HawkX Team here — something went wrong on our side and we've been alerted. Please try again shortly.", alert: true, adminDetail: "CONFIG/treasury: " + raw };
  if (raw.includes("did not confirm") || raw.includes("failed on-chain"))
    return { userMsg: "The trade didn't confirm on-chain. No funds were lost — please try again.", alert: false };

  // ── UNKNOWN → generic user msg, DO alert admin with full detail ──
  return { userMsg: "🦅 HawkX Team here — something went wrong with this " + context + " and we've been alerted. Please try again; if it keeps happening, contact support.", alert: true, adminDetail: "UNMAPPED: " + raw };
}
module.exports = { formatError };
