const db = require("../../../database");
const { buildReferralScreen } = require("./helpers.routes");
const { InputFile } = require("grammy");

async function handleReferralCallbacks(ctx, data, userId, user, bot, ks) {
    // ── REFERRALS ─────────────────────────────────────────────
    if (data === "menu_referrals") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, false);
    }

    // ── CLAIM EARNINGS ────────────────────────────────────────
    if (data === "referral_claim") {
      const pending = db.getPendingEarnings(userId)?.total || 0;
      const MIN = 0.01;
      if (pending < MIN) {
        await ctx.answerCallbackQuery({
          text: `⏳ You need at least ${MIN} SOL to claim.\nYou have ${pending.toFixed(4)} SOL.\nKeep referring to reach the minimum!`,
          show_alert: true,
        });
        return true;
      }
      // Show confirm with destination
      const wallets = db.getWallets(userId) || [];
      let payoutAddr = db.getSysConfig(`payout_wallet_${userId}`) || (wallets[0]?.public_key || "");
      const pw = wallets.find(w => w.public_key === payoutAddr);
      const pwLabel = pw ? `W${wallets.indexOf(pw)+1}` : "Custom";
      await ctx.answerCallbackQuery();
      return ctx.reply(
        `💰 *Claim Referral Earnings*\n\nAmount: *${pending.toFixed(4)} SOL*\nTo: *${pwLabel}*\n\`${payoutAddr.slice(0,16)}...\`\n\nConfirm the claim?`,
        { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[
          { text: "✅ Confirm Claim", callback_data: "referral_claim_confirm" },
          { text: "❌ Cancel", callback_data: "menu_referrals" },
        ]]}}
      );
    }

    if (data === "referral_claim_confirm") {
      const wallets = db.getWallets(userId) || [];
      let payoutAddr = db.getSysConfig(`payout_wallet_${userId}`) || (wallets[0]?.public_key || "");
      const pw = wallets.find(w => w.public_key === payoutAddr);
      const pwLabel = pw ? `W${wallets.indexOf(pw)+1}` : "Custom";
      const REAL_P = process.env.MOCK_TRADES === "false";

      if (REAL_P) {
        // Real payout from treasury — check treasury is configured
        const treasuryKey = process.env.TREASURY_PRIVATE_KEY || "";
        if (!treasuryKey) {
          await ctx.answerCallbackQuery({ text: "Payouts not active yet. Contact support.", show_alert: true });
          return true;
        }
        // Peek pending BEFORE marking paid, so we know how much to send
        const pendingRow = db.getPendingEarnings(userId);
        const pendingSol = (pendingRow && pendingRow.total) ? pendingRow.total : 0;
        if (pendingSol < 0.01) {
          await ctx.answerCallbackQuery({ text: `Need 0.01 SOL. You have ${pendingSol.toFixed(4)}.`, show_alert: true });
          return true;
        }
        try {
          const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } = require("@solana/web3.js");
          const bs58 = require("bs58");
          const connection = new Connection(process.env.HELIUS_RPC_URL || process.env.BACKUP_RPC_URL, "confirmed");
          const treasury = Keypair.fromSecretKey(bs58.decode(treasuryKey));
          const dest = new PublicKey(payoutAddr);
          const lamports = Math.floor(pendingSol * LAMPORTS_PER_SOL);
          const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: treasury.publicKey, toPubkey: dest, lamports }));
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
          tx.recentBlockhash = blockhash; tx.feePayer = treasury.publicKey; tx.sign(treasury);
          const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
          // Only mark paid AFTER the transfer confirms
          db.claimEarnings(userId, 0.01);
          // Tell the deposit monitor this balance change was expected (referral payout, not an external deposit)
          try {
            const { syncKnownBalance } = require("../depositMonitor");
            await syncKnownBalance(payoutAddr);
          } catch {}
          await ctx.answerCallbackQuery("✅ Sent!");
          await ctx.reply(
            `✅ *Claimed ${pendingSol.toFixed(4)} SOL!*\n\nSent to: *${pwLabel}*\n\`${payoutAddr.slice(0,16)}...\`\n\n🔗 [Solscan](https://solscan.io/tx/${sig})`,
            { parse_mode: "Markdown", disable_web_page_preview: true }
          );
        } catch (err) {
          const em = String(err.message||"error").replace(/[_*\`[\]]/g,"");
          await ctx.answerCallbackQuery({ text: "Payout failed: " + em.slice(0,60), show_alert: true });
          return true;
        }
        return buildReferralScreen(ctx, userId, false);
      }

      // DEVNET simulated
      const result = db.claimEarnings(userId, 0.01);
      if (!result.ok) {
        await ctx.answerCallbackQuery({ text: `⏳ Need ${result.min} SOL. You have ${result.pending.toFixed(4)} SOL.`, show_alert: true });
        return true;
      }
      await ctx.answerCallbackQuery("✅ Claimed!");
      await ctx.reply(
        `✅ *Claimed ${result.claimed.toFixed(4)} SOL!*\n\nSent to: *${pwLabel}*\n\`${payoutAddr.slice(0,16)}...\`\n\n_[DEVNET — simulated. Real transfer on mainnet.]_`,
        { parse_mode: "Markdown" }
      );
      return buildReferralScreen(ctx, userId, false);
    }

    // ── ENTER REFERRAL CODE ───────────────────────────────────
    if (data === "referral_enter_code") {
      const freshUser = db.getUser(userId);
      if (freshUser.referrer_id) {
        await ctx.answerCallbackQuery({ text: "✅ You already have a referrer. It can't be changed.", show_alert: true });
        return true;
      }
      await ctx.answerCallbackQuery();
      const m = await ctx.reply(
        "🎟 *Enter Referral Code*\n\nSend the username of who referred you (e.g. @fazle or fazle):\n\n_You can only set this once._",
        { parse_mode: "Markdown" }
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "referral_enter_code");
      return true;
    }

    if (data === "referral_refresh") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, false);
    }

    if (data === "referral_set_payout") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, true);
    }

    if (data === "referral_payout_close") {
      await ctx.answerCallbackQuery();
      return buildReferralScreen(ctx, userId, false);
    }

    if (data === "referral_customize_code") {
      await ctx.answerCallbackQuery();
      const u = db.getUser(userId);
      const cur = u.custom_code || u.referral_code || db.ensureReferralCode(userId);
      const m = await ctx.reply(
        "✏️ *Set Your Referral Code*\n\n" +
        "Current: `" + cur + "`\n\n" +
        "Enter a custom code:\n" +
        "• 3-15 characters\n" +
        "• Letters & numbers only\n" +
        "• Example: FAZLE, MOON, APEX99\n\n" +
        "Your old auto-code keeps working too, so existing links won't break.",
        { parse_mode: "Markdown" }
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "referral_customize_code");
      return true;
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
        const allTimeStats = db.getUserStats(freshUser.user_id);
        const result = await generateRankCard({
          username: freshUser.username || "Trader",
          rankName: rank.name,
          rankNum: freshUser.rank || 1,
          volume: vol,
          nextRankSol,
          rankProgress,
          fee: rank.fee,
          totalTrades: allTimeStats?.totalTrades || 0,
          winRate: allTimeStats?.winRate || 0,
          referralCode: freshUser.custom_code || freshUser.referral_code || db.ensureReferralCode(freshUser.user_id),
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
