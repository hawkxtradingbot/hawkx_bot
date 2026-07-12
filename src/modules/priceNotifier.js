const db = require("../../database");

// Sends each user a notification about how their held tokens moved vs their buy price.
// DEVNET: uses mock/current price from executor. MAINNET: real DexScreener/Helius live price.
// Only notifies when movement crosses a threshold since the last alert (avoids spam).

const THRESHOLDS = [25, 50, 100, 200, -25, -50]; // % moves worth alerting on

async function getRealPrice(tokenCa) {
  try {
    const axios = require("axios");
    const { data } = await axios.get("https://api.dexscreener.com/latest/dex/tokens/" + tokenCa, { timeout: 5000 });
    const pairs = data && data.pairs;
    if (pairs && pairs.length > 0 && pairs[0].priceUsd) return parseFloat(pairs[0].priceUsd);
  } catch {}
  return null;
}

async function runPriceNotifier(bot) {
  try {
    const REAL = process.env.MOCK_TRADES === "false";
    // Keep a fresh cached SOL/USD price available globally for PnL card USD conversions (stopLoss.js etc.)
    if (REAL) {
      try { global.__hawkxSolPx = await db.getSolPriceUsdShared(); } catch {}
    }
    const { getMockPrice } = require("./executor");
    const positions = db.getAllOpenPositionsForNotify();
    for (const p of positions) {
      try {
        const cur = REAL ? await getRealPrice(p.token_ca) : getMockPrice(p.token_ca);
        if (!cur || !p.buy_price) continue;
        const pct = ((cur - p.buy_price) / p.buy_price) * 100;

        // Find the biggest threshold crossed
        let crossed = null;
        for (const th of THRESHOLDS) {
          if (th > 0 && pct >= th) { if (!crossed || th > crossed) crossed = th; }
          if (th < 0 && pct <= th) { if (!crossed || th < crossed) crossed = th; }
        }
        if (crossed === null) continue;

        // Respect the user's price-notification on/off setting (default ON) - same settings table as other toggles
        const uSettings = db.getSettings(p.user_id) || {};
        if ((uSettings.price_notif ?? 1) === 0) continue;

        // Only alert once per threshold per position (store last alerted threshold)
        const key = `notif_${p.user_id}_${p.token_ca}_${p.wallet_id}`;
        const last = db.getSysConfig(key) || "";
        if (last === String(crossed)) continue;
        db.setSysConfig(key, String(crossed));

        const name = p.token_name || p.token_ca.slice(0, 8);
        const emoji = pct >= 0 ? "🚀" : "📉";
        const arrow = pct >= 0 ? "+" : "";
        const msg = `${emoji} *${name}* is *${arrow}${pct.toFixed(0)}%* from your buy!\n\nEntry: ${p.buy_price.toFixed(8)}\nNow: ${cur.toFixed(8)}`;
        try { await bot.api.sendMessage(p.user_id, msg, { parse_mode: "Markdown" }); } catch {}
      } catch {}
    }

    // Watchlist price alerts - previously created but NEVER checked/fired (no monitor existed at all)
    try {
      const allAlerts = db.getDb().prepare("SELECT * FROM price_alerts WHERE fired = 0").all();
      for (const a of allAlerts) {
        try {
          const cur = REAL ? await getRealPrice(a.token_ca) : getMockPrice(a.token_ca);
          if (!cur) continue;
          const hit = a.direction === "below" ? cur <= a.target_price : cur >= a.target_price;
          if (!hit) continue;
          db.getDb().prepare("UPDATE price_alerts SET fired = 1 WHERE id = ?").run(a.id);
          const name = a.token_name || a.token_ca.slice(0, 8);
          const dirWord = a.direction === "below" ? "dropped to" : "reached";
          const alertMsg = `🔔 *${name}* ${dirWord} your target!\n\nTarget: ${a.target_price}\nNow: ${cur}`;
          try { await bot.api.sendMessage(a.user_id, alertMsg, { parse_mode: "Markdown" }); } catch {}
        } catch {}
      }
    } catch (e) {
      console.log("[PriceNotifier] watchlist alert error:", e.message.slice(0, 60));
    }
  } catch (e) {
    console.log("[PriceNotifier] error:", e.message.slice(0, 60));
  }
}

function startPriceNotifier(bot) {
  // Runs every 60s
  setInterval(() => runPriceNotifier(bot), 60000);
  console.log("[PriceNotifier] ✅ Started — watching positions every 60s");
}

module.exports = { startPriceNotifier, runPriceNotifier };
