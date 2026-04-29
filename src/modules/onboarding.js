// M06 — Onboarding V12
const db     = require("../../database");
const config = require("../../config");
const { buildMainMenu } = require("./keyboards");
const { applyJoinerDiscount } = require("./referrals");
const { addWallet } = require("./walletVault");

async function handleStart(ctx, bot) {
  const tgUser = ctx.from;
  const userId = tgUser.id;
  const lang   = tgUser.language_code?.slice(0, 2) || "en";

  const startParam = ctx.match || "";
  let referrerId   = null;
  if (startParam.startsWith("REF_")) {
    const parts = startParam.replace("REF_", "").split("_");
    const refId = parseInt(parts[0]);
    if (!isNaN(refId) && refId !== userId) referrerId = refId;
  }

  let user    = db.getUser(userId);
  const isNew = !user;

  if (isNew) {
    db.createUser({
      userId,
      username:   tgUser.username || tgUser.first_name || "Trader",
      language:   lang,
      referrerId: referrerId || null,
    });
    user = db.getUser(userId);
    try { await addWallet(ctx, user, "generate"); } catch {}
    if (referrerId) {
      db.buildReferralChain(userId, referrerId);
      applyJoinerDiscount(userId);
    }
  }

  const freshUser    = db.getUser(userId);
  const ks           = require("./killSwitch").isActive();
  const { RANKS }    = require("./keyboards");
  const rank         = RANKS[freshUser.rank] || RANKS[1];
  const hasDiscount  = freshUser.joiner_discount && freshUser.rank === 1;
  const effectiveFee = hasDiscount ? (rank.fee * 0.9).toFixed(2) : rank.fee.toFixed(2);
  const botUsername  = ctx.me?.username || "HawkXBot";
  const refLink      = `https://t.me/${botUsername}?start=REF_${userId}_${freshUser.username || "user"}`;

  const welcomeMsg =
    `🦅 Welcome to HawkX [DEVNET]\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `The fastest Solana trading bot.\n\n` +
    `Rank: ${rank.name} (${freshUser.rank}/7)\n` +
    `Fee: ${effectiveFee}%\n` +
    `Rank up by trading more — fee drops automatically.\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `What you can do:\n` +
    `- Buy and sell tokens on Solana\n` +
    `- Copy trade any wallet or channel\n` +
    `- Snipe token launches\n` +
    `- Set limit orders, Stop Loss, Take Profit\n` +
    `- Earn 30% referral commission\n\n` +
    `Referral Rates:\n` +
    `L1: 30% | L2: 4% | L3: 3% | L4: 2% | L5: 1.5% | L6: 1%\n\n` +
    `Use a referral code to get 10% discount on fee at Rank 1.` +
    (hasDiscount ? `\n\nWelcome bonus: You joined via referral and get a 10% fee discount! Your fee: ${effectiveFee}%` : ``) +
    (ks ? `\n\nTrading is currently paused. Your account is ready when trading resumes.` : ``);

  const todayStats = db.getTodayStats(userId);
  await ctx.reply(welcomeMsg, {
    reply_markup: buildMainMenu(freshUser, todayStats, ks),
  });

  if (isNew) {
    await ctx.reply(
      "Choose your mode:\n\nBeginner Mode — Clean 8-button menu. Easy for new traders.\n\nPro Mode — Full access: sniper, copy trade, limit orders, advanced settings and more.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🌱 Beginner Mode", callback_data: "mode_set_beginner" },
              { text: "⚡ Pro Mode",       callback_data: "mode_set_pro" },
            ],
          ],
        },
      }
    );
  }
}

module.exports = { handleStart };
