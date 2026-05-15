const db = require("../../../database");
const { buildReferralScreen } = require("./helpers.routes");
const { InputFile } = require("grammy");

async function handleReferralCallbacks(ctx, data, userId, user, bot, ks) {
    // ── REFERRALS ─────────────────────────────────────────────
    if (data === "menu_referrals") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, false);
    }

    if (data === "referral_refresh") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, false);
    }

    if (data === "referral_set_payout") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, true);
    }

    if (data.startsWith("payout_wallet_select_")) {
      const walletId = parseInt(data.replace("payout_wallet_select_", ""));
      const wallet = db.getWallet(walletId);
      if (!wallet) {
        await ctx.answerCallbackQuery("Not found.");
        return true;
      }
      const wallets = db.getWallets(userId) || [];
      const num = wallets.findIndex((w) => w.wallet_id === walletId) + 1;
      db.setSysConfig(`payout_wallet_${userId}`, wallet.public_key);
      await ctx.answerCallbackQuery(`✅ Payout set to W${num}`);
      return buildReferralScreen(ctx, userId, true);
    }

    if (data === "payout_wallet_custom") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        "✏️ *Custom Payout Address*\n\nSend any Solana wallet address:\n\n_Does not have to be a HawkX wallet._",
        { parse_mode: "Markdown" },
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "referral_payout_address");
      return true;
    }
    if (data.startsWith("pnlcard_toggle_")) {
      const parts = data.split("_");
      const posId = parseInt(parts[2]);
      const hideAmts = parts[3] === "1";
      await ctx.answerCallbackQuery("⏳ Regenerating...");
      return handlePnlCard(ctx, user, posId, hideAmts);
    }

    if (data === "gen_rank_card") {
      await ctx.answerCallbackQuery("⏳ Generating rank card...");
      try {
        const { generateRankCard } = require("../statsCard");
        const freshUser = db.getUser(userId);
        const { RANKS } = require("../keyboards");
        const rank = RANKS[freshUser.rank] || RANKS[1];
        const vol = freshUser.cumulative_volume_sol || 0;
        const nextRankSol = rank.nextSol || 0;
        const rankProgress = nextRankSol > 0 ? Math.min(99, (vol / nextRankSol) * 100) : 100;
        const result = await generateRankCard({
          username: freshUser.username || "Trader",
          rankName: rank.name,
          rankNum: freshUser.rank || 1,
          volume: vol,
          nextRankSol,
          rankProgress,
          fee: rank.fee,
        });
        console.log("[RankCard] Result:", result?.type, result?.buffer?.length);
        if (result && result.type === "photo") {
          await ctx.replyWithPhoto(
            new InputFile(result.buffer, "rank_card.png"),
          );
        } else if (result && result.type === "text") {
          await ctx.reply(result.text, { parse_mode: "Markdown" });
        } else {
          await ctx.reply("❌ Card not available.");
        }
      } catch (e) {
        await ctx.reply("❌ Could not generate card. " + e.message);
      }
      return true;
    }

    return false;
}

module.exports = { handleReferralCallbacks };
