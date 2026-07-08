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
    // Old format: REF_userId_username (backward compatible)
    const parts = startParam.replace("REF_", "").split("_");
    const refId = parseInt(parts[0]);
    if (!isNaN(refId) && refId !== userId) referrerId = refId;
  } else if (startParam) {
    // New format: a referral code (auto HAWKxxxxx or custom)
    const refUser = db.getUserByReferralCode(startParam);
    if (refUser && refUser.user_id !== userId) referrerId = refUser.user_id;
  }

  let user    = db.getUser(userId);
  const isNew = !user;
  if (isNew) { try { db.setSysConfig(`terms_accepted_${ctx.from.id}`, new Date().toISOString() + "|v1"); } catch {} }

  if (isNew) {
    db.createUser({
      userId,
      username:   tgUser.username || tgUser.first_name || "Trader",
      language:   lang,
      referrerId: referrerId || null,
    });
    user = db.getUser(userId);
    db.ensureReferralCode(userId);
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
  const myCode       = freshUser.custom_code || freshUser.referral_code || db.ensureReferralCode(userId);
  const refLink      = `https://t.me/${botUsername}?start=${myCode}`;

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

  if (isNew) {
    // CLEAN onboarding — ONE message: short welcome + mode pick
    const newMsg =
      "🦅 *Welcome to HawkX* [DEVNET]\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "The fastest Solana trading bot.\n" +
      "✅ Your wallet is ready.\n\n" +
      "Pick how you want to start 👇\n\n" +
      "_By continuing, you agree to our Terms & Privacy Policy. HawkX is non-custodial and not financial advice — trade at your own risk. You must be 18+. See 📜 Terms in Help._";
    await ctx.reply(newMsg, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌱 Beginner", callback_data: "mode_set_beginner" },
           { text: "⚡ Pro",       callback_data: "mode_set_pro" }],
        ],
      },
    });
  } else {
    // Returning user — normal welcome + main menu
    await ctx.reply(welcomeMsg, {
      reply_markup: buildMainMenu(freshUser, todayStats, ks),
    });
  }
}

module.exports = { handleStart };
