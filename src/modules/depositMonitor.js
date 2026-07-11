// Deposit Monitor — polls wallet balances and notifies users when SOL arrives
// unexpectedly (i.e. not from a bot-initiated buy/sell/withdraw).
const db = require("../../database");

// Call this right after a bot-initiated balance change (sell proceeds, referral claim, etc.)
// so the next poll doesn't mistake it for an external deposit.
async function syncKnownBalance(publicKey) {
  try {
    const currentBal = await db.getWalletBalance(publicKey);
    db.setSysConfig(`last_bal_${publicKey}`, String(currentBal));
  } catch (e) {
    console.log("[DepositMonitor] syncKnownBalance failed:", e.message);
  }
}

async function checkDeposits(bot) {
  try {
    const wallets = db.getDb().prepare("SELECT wallet_id, user_id, public_key, label FROM wallets").all();
    for (const w of wallets) {
      try {
        const currentBal = await db.getWalletBalance(w.public_key);
        const lastKnownKey = `last_bal_${w.public_key}`;
        const lastKnownRaw = db.getSysConfig(lastKnownKey);
        const lastKnown = lastKnownRaw !== null && lastKnownRaw !== undefined ? parseFloat(lastKnownRaw) : null;

        // First time seeing this wallet — just record baseline, don't notify
        if (lastKnown === null) {
          db.setSysConfig(lastKnownKey, String(currentBal));
          continue;
        }

        const diff = currentBal - lastKnown;
        // Only notify on a MEANINGFUL increase (avoid noise from tiny rounding/rent changes)
        if (diff > 0.0005) {
          const user = db.getUser(w.user_id);
          if (user) {
            const depositTime = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
            try {
              await bot.api.sendMessage(
                user.telegram_id || user.user_id,
                `💰 *Deposit Received*\n\n+${diff.toFixed(6)} SOL\nWallet: ${w.label || "W" + w.wallet_id}\n🕐 ${depositTime}\n\nNew balance: *${currentBal.toFixed(4)} SOL*`,
                { parse_mode: "Markdown" }
              );
            } catch (e) {
              console.log("[DepositMonitor] notify failed for user", w.user_id, e.message);
            }
          }
        }
        db.setSysConfig(lastKnownKey, String(currentBal));
      } catch (e) {
        // Skip this wallet this cycle on error, try again next cycle
      }
    }
  } catch (e) {
    console.log("[DepositMonitor] cycle error:", e.message);
  }
}

function startDepositMonitor(bot) {
  if (process.env.MOCK_TRADES === "false") {
    setInterval(() => checkDeposits(bot), 45000); // every 45s
    console.log("[DepositMonitor] started (mainnet)");
  }
}

module.exports = { startDepositMonitor, checkDeposits, syncKnownBalance };
