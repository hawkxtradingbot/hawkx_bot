// M06 — Onboarding V12
const db     = require("../../database");
const config = require("../../config");
const { buildMainMenu } = require("./keyboards");
const { applyJoinerDiscount } = require("./referrals");
const { addWallet } = require("./walletVault");

async function handleStart(ctx, bot, forceNew) {
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
  const isNew = forceNew !== undefined ? forceNew : !user;

  // Real Terms/Privacy acceptance gate - must tap "I Agree" before an account or wallet is created.
  // (Previously this silently marked terms as "accepted" without ever showing/asking the user - removed.)
  if (isNew) {
    const alreadyAccepted = db.getSysConfig(`terms_accepted_${userId}`);
    if (!alreadyAccepted) {
      if (referrerId) db.setSysConfig(`pending_referrer_${userId}`, String(referrerId));
      const termsMsg =
        "🦅 *Welcome to HawkX*\n" +
        "━━━━━━━━━━━━━━━━━━\n\n" +
        "Before you start, please review:\n\n" +
        "📜 *Terms of Service* — non-custodial service, you control your wallet, trading involves real financial risk, HawkX cannot recover lost keys/PINs.\n\n" +
        "🔒 *Privacy Policy* — we store your Telegram ID, encrypted wallet data, and trade history to operate the Bot; your wallet's private key is encrypted (AES-256-GCM) and never shared.\n\n" +
        "By tapping *I Agree*, you confirm you are 18+, accept the full Terms of Service and Privacy Policy, and understand that trading crypto carries real risk of loss.";
      const kb = { inline_keyboard: [
        [{ text: "📜 Read Full Terms", url: "https://github.com/hawkxtradingbot/hawkx_bot/blob/main/HawkX_Terms_of_Service.md" }],
        [{ text: "🔒 Read Privacy Policy", url: "https://github.com/hawkxtradingbot/hawkx_bot/blob/main/HawkX_Privacy_Policy.md" }],
        [{ text: "✅ I Agree - Start Trading", callback_data: "terms_agree" }],
        [{ text: "❌ Decline", callback_data: "terms_decline" }],
      ]};
      await ctx.reply(termsMsg, { parse_mode: "Markdown", reply_markup: kb });
      return;
    }
  }

  // Only create the account/wallet if it TRULY doesn't exist yet - forceNew only controls
  // which WELCOME MESSAGE is shown below, it should never re-trigger account/wallet creation
  // for a user that handleTermsResponse already created moments ago.
  if (isNew && !user) {
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
    `🦅 Welcome to HawkX\n` +
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
    const isMainnet = process.env.MOCK_TRADES === "false";
    const startLine = isMainnet
      ? "💰 Deposit SOL to your wallet to start trading."
      : "🚰 Get free test SOL from the faucet to start.";
    const newMsg =
      "🦅 *Welcome to HawkX*\n" +
      "━━━━━━━━━━━━━━━━━━\n\n" +
      "The fastest Solana trading bot.\n" +
      "✅ Your wallet is ready.\n" +
      startLine + "\n\n" +
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


async function handleTermsResponse(ctx) {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  if (data === "terms_decline") {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("You must accept the Terms of Service and Privacy Policy to use HawkX. Send /start anytime to review again.");
    return true;
  }

  if (data === "terms_agree") {
    await ctx.answerCallbackQuery("✅ Accepted!");
    db.setSysConfig(`terms_accepted_${userId}`, new Date().toISOString() + "|v1");

    const referrerId = db.getSysConfig(`pending_referrer_${userId}`);
    db.setSysConfig(`pending_referrer_${userId}`, "");

    let user = db.getUser(userId);
    if (!user) {
      const tgUser = ctx.from;
      const lang = tgUser.language_code?.slice(0, 2) || "en";
      db.createUser({
        userId,
        username: tgUser.username || tgUser.first_name || "Trader",
        language: lang,
        referrerId: referrerId ? parseInt(referrerId) : null,
      });
      user = db.getUser(userId);
      db.ensureReferralCode(userId);
      try { await addWallet(ctx, user, "generate"); } catch {}
      if (referrerId) {
        db.buildReferralChain(userId, parseInt(referrerId));
        applyJoinerDiscount(userId);
      }
    }

    try { await ctx.deleteMessage(); } catch {}
    await handleStart(ctx, null, true);
    return true;
  }

  return false;
}

module.exports = { handleStart, handleTermsResponse };
