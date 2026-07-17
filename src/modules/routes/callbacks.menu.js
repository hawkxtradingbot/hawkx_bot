const db = require("../../../database");
const { safeEdit, refreshMsnipeScreen } = require("./helpers.routes");
const { showSettings, handleSettingCallback } = require("../settings/index");
const { handleAutoBuy, executeRealtimeSnipe, mockBuy, mockSell } = require("../executor");
const { buildMainMenu, getModeLabel, getGuide, buildRankInfoMessage, RANKS } = require("../keyboards");

async function handleMenuCallbacks(ctx, data, userId, user, bot, ks) {
    // ── NOOP ──────────────────────────────────────────────────
    if (data === "noop") {
      await ctx.answerCallbackQuery();
      return true;
    }

    // ── LEADERBOARD ───────────────────────────────────────────
    if (data === "menu_leaderboard" || data.startsWith("lb_")) {
      await ctx.answerCallbackQuery();
      // Single volume-ranked board. Callback: lb_<period>
      let period = "day";
      if (data.startsWith("lb_")) period = data.split("_")[1] || "day";
      if (!["day","week","month"].includes(period)) period = "day";

      const { InlineKeyboard } = require("grammy");
      const rankNames = ["","Scout","Tracker","Hunter","Predator","Apex","Hawk","Hawk Elite"];
      const medals = ["🥇","🥈","🥉"];
      const periodLabel = { day: "Today", week: "This Week", month: "This Month" }[period];

      const rows = db.getVolumeLeaderboard(period, 10);

      let msg = `🏆 *HawkX Leaderboard*\n📊 Top Traders — ${periodLabel}\n━━━━━━━━━━━━━━━━━━━\n\n`;

      if (!rows.length) {
        msg += `_No trades yet ${period === "day" ? "today" : "this " + period}.\nStart trading to claim the top spot!_\n`;
      } else {
        rows.forEach(r => {
          const pos = r.position <= 3 ? medals[r.position-1] : `${r.position}.`;
          const rn = rankNames[r.rank] || "Scout";
          // Line 1 (bold): medal + name + volume | Line 2 (dim, indented): rank + refs
          msg += `${pos} *${r.name}* · *${r.volume.toFixed(2)} SOL*\n`;
          msg += `      ${rn} · 👥 ${r.referrals} refs\n\n`;
        });
      }

      const mine = db.getUserVolumeRank(userId, period);
      msg += `━━━━━━━━━━━━━━━━━━━\n📍 *You:* #${mine.position} · ${mine.volume.toFixed(2)} SOL · ${mine.referrals} refs`;

      const kb = new InlineKeyboard();
      kb.text(period === "day" ? "📅 Day ✅" : "📅 Day", "lb_day")
        .text(period === "week" ? "🗓 Week ✅" : "🗓 Week", "lb_week")
        .text(period === "month" ? "📆 Month ✅" : "📆 Month", "lb_month").row();
      kb.text("🔄 Refresh", `lb_${period}`).text("← Back", "menu_main").row();

      return safeEdit(ctx, msg, kb);
    }

    // ── MAIN MENU ─────────────────────────────────────────────
    if (data === "menu_main" || data === "menu_main_refresh") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const todayStats = db.getTodayStats(userId, db.getUser(userId).active_wallet_id);
      const mode = getModeLabel(freshUser);
      const rank = freshUser.rank || 1;
      const rankNames = ["","Scout","Tracker","Hunter","Predator","Apex","Hawk","Hawk Elite"];
      const fees = [0,1.00,0.85,0.80,0.75,0.70,0.60,0.50];
      const _chainIcons = { SOL: '🟣', HOOD: '🟢' };
      const _activeChain = db.getActiveChain(userId);
      const _chainCfg = db.getChainConfig(_activeChain);
      const menuMsg = 
        `🦅 *HawkX* — ${mode} Mode\n` +
        `${_chainIcons[_activeChain] || '🔗'} Chain: *${_chainCfg?.label || _activeChain}*\n\n` +
        `🏅 Rank: *${rankNames[rank]||"Scout"}* (${rank}/7)\n` +
        `💸 Fee: *${fees[rank]||1.00}%*\n\n` +
        `${getGuide(freshUser.mode === "pro" ? "main_pro" : "main_beginner")}`;
      return safeEdit(ctx, menuMsg, buildMainMenu(freshUser, todayStats, ks));
    }

    // ── MODE SWITCH ───────────────────────────────────────────
    if (data === "mode_set_pro" || data === "mode_set_beginner") {
      const mode = data === "mode_set_pro" ? "pro" : "beginner";
      db.setUserMode(userId, mode);
      await ctx.answerCallbackQuery(mode === "pro" ? "⚡ Pro Mode activated!" : "🌱 Beginner Mode activated!");
      const freshUser = db.getUser(userId);
      // First-time fund prompt: only if wallet is empty (brand new)
      const w = (db.getWallets(userId) || [])[0];
      const bal = w ? parseFloat(db.getSysConfig(`mock_balance_${w.public_key}`) || "0") : 0;
      const seenFund = db.getSysConfig(`seen_fund_${userId}`) === "1";
      if (w && bal === 0 && !seenFund) {
        db.setSysConfig(`seen_fund_${userId}`, "1");
        const fundMsg =
          "💰 *Fund Your Wallet*\n" +
          "━━━━━━━━━━━━━━━━━━\n\n" +
          "Send SOL to this address to start trading:\n\n" +
          "`" + w.public_key + "`\n" +
          "_(tap to copy)_\n\n" +
          "🔐 Non-custodial — your keys, your coins.";
        db.setSysConfig(`onboarding_pin_flow_${userId}`, "1");
        return safeEdit(ctx, fundMsg, { inline_keyboard: [
          [{ text: "🔐 Set Security PIN", callback_data: "set_sap" }],
          [{ text: "✅ Start Trading", callback_data: "menu_main" }],
        ]});
      }
      const guide = mode === "pro" ? "main_pro" : "main_beginner";
      const label = mode === "pro" ? "⚡ Pro Mode" : "🌱 Beginner Mode";
      return safeEdit(ctx, `🦅 *HawkX* — ${label}\n\n${getGuide(guide)}`, buildMainMenu(freshUser, db.getTodayStats(userId, freshUser.active_wallet_id), ks));
    }

    // ── CHAIN SWITCHER (single tap cycles to next enabled chain, updates same message in place) ──
    if (data === "chain_switch_do") {
      const chains = db.getEnabledChains();
      const activeChain = db.getActiveChain(userId);
      const idx = chains.findIndex(c => c.chain === activeChain);
      const nextChain = chains[(idx + 1) % chains.length];
      if (!nextChain || chains.length < 2) {
        await ctx.answerCallbackQuery("Only one chain available right now.");
        return true;
      }
      let wallet = db.getWalletForChain(userId, nextChain.chain);
      let createdNew = false;
      if (!wallet) {
        if (nextChain.chain === "SOL") {
          const { addWallet } = require("../walletVault");
          await addWallet(ctx, user, "generate");
          createdNew = true;
        } else {
          try {
            const { createEvmWallet } = require("../chains/evm/wallet");
            await createEvmWallet(userId, nextChain.chain, "W1");
            createdNew = true;
          } catch (e) {
            console.error("[EVM Wallet] creation failed:", e.message);
            await ctx.answerCallbackQuery("Couldn't create wallet for this chain. Try again shortly.");
            return true;
          }
        }
      }
      db.setActiveChain(userId, nextChain.chain);
      const chainIcons = { SOL: '🟣', HOOD: '🟢' };
      await ctx.answerCallbackQuery(`${chainIcons[nextChain.chain] || ''} Switched to ${nextChain.label}${createdNew ? ' - wallet created' : ''}`);

      const freshUser = db.getUser(userId);
      const todayS = db.getTodayStats(userId, freshUser.active_wallet_id);
      const rank = freshUser.rank || 1;
      const rankNames2 = ["","Scout","Tracker","Hunter","Predator","Apex","Hawk","Hawk Elite"];
      const fees2 = [0,1.00,0.85,0.80,0.75,0.70,0.60,0.50];
      const modeLabel = getModeLabel(freshUser);
      const menuMsg2 =
        `🦅 *HawkX* — ${modeLabel} Mode\n` +
        `${chainIcons[nextChain.chain] || '🔗'} Chain: *${nextChain.label}*\n\n` +
        `🏅 Rank: *${rankNames2[rank]||"Scout"}* (${rank}/7)\n` +
        `💸 Fee: *${fees2[rank]||1.00}%*\n\n` +
        `${getGuide(freshUser.mode === "pro" ? "main_pro" : "main_beginner")}`;
      try { await ctx.editMessageText(menuMsg2, { parse_mode: "Markdown", reply_markup: buildMainMenu(freshUser, todayS, ks) }); }
      catch { await safeEdit(ctx, menuMsg2, buildMainMenu(freshUser, todayS, ks)); }
      return true;
    }


    // ── RANK INFO ─────────────────────────────────────────────
    // ── UNIVERSAL BRIDGE (Relay Protocol) ────────────────────
    if (data === "bridge_start" || data === "bridge_reset_from" || data === "bridge_reset_to") {
      await ctx.answerCallbackQuery();
      const { buildBridgeText, buildBridgeKeyboard } = require("./callbacks.bridge");
      let state = JSON.parse(db.getSysConfig(`bridge_state_${userId}`) || "{}");
      if (data === "bridge_start") state = {};
      if (data === "bridge_reset_from") { state.fromChain = null; state.fromToken = null; }
      if (data === "bridge_reset_to") { state.toChain = null; state.toToken = null; }
      db.setSysConfig(`bridge_state_${userId}`, JSON.stringify(state));
      try { await ctx.editMessageText(buildBridgeText(state), { parse_mode: "Markdown", reply_markup: buildBridgeKeyboard(state) }); }
      catch { await ctx.reply(buildBridgeText(state), { parse_mode: "Markdown", reply_markup: buildBridgeKeyboard(state) }); }
      return true;
    }

    if (data.startsWith("bridge_from_") || data.startsWith("bridge_ftok_") || data.startsWith("bridge_to_") || data.startsWith("bridge_ttok_")) {
      await ctx.answerCallbackQuery();
      const { buildBridgeText, buildBridgeKeyboard } = require("./callbacks.bridge");
      let state = JSON.parse(db.getSysConfig(`bridge_state_${userId}`) || "{}");
      if (data.startsWith("bridge_from_")) state.fromChain = data.replace("bridge_from_", "");
      if (data.startsWith("bridge_ftok_")) state.fromToken = data.replace("bridge_ftok_", "");
      if (data.startsWith("bridge_to_")) state.toChain = data.replace("bridge_to_", "");
      if (data.startsWith("bridge_ttok_")) state.toToken = data.replace("bridge_ttok_", "");
      db.setSysConfig(`bridge_state_${userId}`, JSON.stringify(state));
      try { await ctx.editMessageText(buildBridgeText(state), { parse_mode: "Markdown", reply_markup: buildBridgeKeyboard(state) }); }
      catch (e) { console.error("[Bridge] render failed:", e.message); }
      return true;
    }

    if (data === "bridge_enter_amount") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`pending_${userId}`, "bridge_amount_input");
      const sent = await ctx.reply("✏️ Enter the amount you want to bridge:");
      db.setSysConfig(`pending_msg_${userId}`, String(sent.message_id));
      return true;
    }

    if (data === "bridge_confirm") {
      await ctx.answerCallbackQuery("⏳ Fetching quote...");
      const state = JSON.parse(db.getSysConfig(`bridge_state_${userId}`) || "{}");
      const { CHAIN_OPTIONS, TOKEN_OPTIONS } = require("./callbacks.bridge");
      const fromCfg = CHAIN_OPTIONS.find(c => c.key === state.fromChain);
      const toCfg = CHAIN_OPTIONS.find(c => c.key === state.toChain);
      const fromWallet = db.getWalletForChain(userId, state.fromChain) || db.getWalletForChain(userId, "SOL");
      if (!fromWallet) { await ctx.reply("❌ No wallet found for the source chain."); return true; }
      try {
        const relay = require("../bridge/relay");
        const fromTokenAddr = (TOKEN_OPTIONS[state.fromChain] || []).find(t => t.symbol === state.fromToken)?.address;
        const toTokenAddr = (TOKEN_OPTIONS[state.toChain] || []).find(t => t.symbol === state.toToken)?.address;
        const amountRaw = String(Math.floor(parseFloat(state.amount) * 1e9)); // lamports/wei-style base unit, chain-dependent - simplified for now
        const quote = await relay.getQuote({
          userAddress: fromWallet.public_key,
          originChainId: fromCfg.relayId, destinationChainId: toCfg.relayId,
          originCurrency: fromTokenAddr, destinationCurrency: toTokenAddr,
          amount: amountRaw,
        });
        await ctx.reply(
          `🌉 *Bridge Quote*\n\n${state.amount} ${state.fromToken} (${fromCfg.label}) → ${state.toToken} (${toCfg.label})\n\n_Real execution wiring is the next build step - quote fetch confirmed working._`,
          { parse_mode: "Markdown" }
        );
      } catch (e) {
        await ctx.reply("❌ Couldn't fetch bridge quote: " + e.message);
      }
      return true;
    }

    if (data === "scan_wallet_tokens") {
      await ctx.answerCallbackQuery("🔍 Scanning wallet...");
      const activeChain = db.getActiveChain(userId);
      if (activeChain !== "SOL") {
        await ctx.reply("🔍 Wallet scanning is currently available for Solana only.");
        return true;
      }
      const freshUser = db.getUser(userId);
      const activeWallet = db.getWallet(freshUser.active_wallet_id);
      if (!activeWallet) { await ctx.reply("❌ No active wallet found."); return true; }

      const { getWalletTokenBalances } = require("../walletScanner");
      const allTokens = await getWalletTokenBalances(activeWallet.public_key);

      // Exclude tokens already tracked as open positions
      const trackedCas = new Set(db.getOpenPositions(userId).map(p => p.token_ca));
      const untracked = allTokens.filter(t => !trackedCas.has(t.mint));

      if (!untracked.length) {
        await ctx.reply("✅ No untracked tokens found — everything in this wallet is already tracked, or the wallet only holds tokens bought through HawkX.");
        return true;
      }

      let msg = `🔍 *Other Wallet Tokens*\n\nFound ${untracked.length} token(s) not bought through HawkX:\n\n`;
      const rows = untracked.slice(0, 10).map(t => {
        const label = t.symbol || t.mint.slice(0,8);
        msg += `• ${label}: ${t.amount.toLocaleString()}\n`;
        return [{ text: `🔗 Adopt ${label}`, callback_data: `adopt_token_${t.mint}` }];
      });
      msg += `\n💡 Tap Adopt to start tracking a token (uses current market price as entry).`;
      // Pre-store amounts for each so adopt_token_ handler can use them without a second query
      untracked.forEach(t => db.setSysConfig(`adopt_pending_${userId}_${t.mint}`, String(t.amount)));
      await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } });
      return true;
    }

    if (data.startsWith("adopt_token_")) {
      const ca = data.replace("adopt_token_", "");
      await ctx.answerCallbackQuery("⏳ Adopting token...");
      const pending = db.getSysConfig(`adopt_pending_${userId}`);
      let heldAmount = 0;
      try { const parsed = JSON.parse(pending || "{}"); if (parsed.ca === ca) heldAmount = parsed.amount || 0; } catch {}
      if (heldAmount <= 0) {
        await ctx.reply("❌ Couldn't confirm your holding - please try again from the sell screen.");
        return true;
      }
      const { getTokenInfo } = require("../tokenInfo");
      const tInfo = await getTokenInfo(ca).catch(() => null);
      const currentPrice = tInfo?.price || 0;
      if (currentPrice <= 0) {
        await ctx.reply("❌ Couldn't fetch current price for this token - please try again shortly.");
        return true;
      }
      const freshUser = db.getUser(userId);
      db.openPosition({
        userId, walletId: freshUser.active_wallet_id,
        tokenCa: ca, tokenName: tInfo?.name || ca.slice(0,8),
        buyPrice: currentPrice, solInvested: heldAmount * currentPrice, tokenAmount: heldAmount,
        platform: process.env.MOCK_TRADES === "false" ? "adopted_real" : "adopted_mock",
        source: "adopted", sourceRef: "", chain: "SOL",
      });
      db.setSysConfig(`adopt_pending_${userId}`, "");
      await ctx.reply(
        `✅ *Token Adopted!*\n\n${tInfo?.name || ca.slice(0,8)} is now tracked in your Portfolio, using the current market price as its entry point. You can sell it through HawkX going forward.\n\n_Note: since this wasn't bought through HawkX, the P&L shown reflects price movement from adoption time, not your true original cost._`,
        { parse_mode: "Markdown" }
      );
      return true;
    }

    if (data === "menu_rank_info") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const { buildRankInfoMessage } = require("../keyboards");
      const _feeSavedSol = db.getAllTimeFeeSaved(freshUser.user_id);
      const _rankSolPx = await db.getSolPriceUsdShared().catch(() => 150);
      const rankMsg = buildRankInfoMessage(freshUser, _feeSavedSol * _rankSolPx);
      const rankKb = { inline_keyboard: [[{ text: "← Back", callback_data: "menu_main" }]] };
      try { await ctx.editMessageText(rankMsg, { parse_mode: "Markdown", reply_markup: rankKb }); }
      catch { await ctx.reply(rankMsg, { parse_mode: "Markdown", reply_markup: rankKb }); }
      return;
    }

    // ── STATS ─────────────────────────────────────────────────
    if (data === "menu_stats") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const _statsSolPx = await db.getSolPriceUsdShared().catch(() => 150);
      const today = db.getTodayStats(userId, freshUser.active_wallet_id);
      const allTime = db.getUserStats(userId);
      const weekly = db.getWeeklyPnl(userId);
      const monthly = db.getMonthlyPnl(userId);
      const vol = freshUser.cumulative_volume_sol || 0;
      const { RANKS } = require("../keyboards");
      const rank = RANKS[freshUser.rank] || RANKS[1];
      const ts = (today.pnl || 0) >= 0 ? "+" : "";
      const ws = weekly >= 0 ? "+" : "";
      const ms = monthly >= 0 ? "+" : "";
      // Fee savings
      const dailyFee = db.getDailyFeeSaved(userId);
      const weeklyFee = db.getWeeklyFeeSaved(userId);
      const monthlyFee = db.getMonthlyFeeSaved(userId);
      const nextRank = rank.nextSol || 0;
      const rankPct = nextRank > 0 ? Math.min(99, (vol / nextRank) * 100) : 100;
      const barLen = 16;
      const filled = Math.round((rankPct / 100) * barLen);
      const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
      const nextRankNames = ["","Tracker","Hunter","Predator","Apex","Hawk","Hawk Elite","MAX"];
      let msg = `📊 *Your Trading Stats*\n\n`;
      msg += `🏅 *${rank.name}* (${freshUser.rank}/7) — Fee: *${rank.fee.toFixed(2)}%*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━\n\n`;
      msg += `📅 *Today*\n`;
      msg += `P&L: *${ts}${(today.pnl || 0).toFixed(4)} SOL* · *$${Math.abs((today.pnl||0)*_statsSolPx).toFixed(2)}*\n`;
      msg += `Trades: *${today.trades || 0}* · Win Rate: *${today.winRate || 0}%*\n`;
      msg += `Fee Saved Today: *$${dailyFee.toFixed(4)}*\n\n`;
      msg += `📆 *This Week:* *${ws}${weekly.toFixed(4)} SOL* · Saved: *$${weeklyFee.toFixed(4)}*\n`;
      msg += `🗓 *This Month:* *${ms}${monthly.toFixed(4)} SOL* · Saved: *$${monthlyFee.toFixed(4)}*\n\n`;
      msg += `📈 *All Time*\n`;
      msg += `Volume: *${vol.toFixed(4)} SOL*\n`;
      msg += `Win: *${allTime.winRate || 0}%* · Loss: *${allTime.lossRate || 0}%*\n`;
      const _chainBreakdown = db.getChainBreakdown(userId);
      const _chainIcons2 = { SOL: '🟣', HOOD: '🟢' };
      const _breakdownParts = Object.entries(_chainBreakdown).map(([ch, cnt]) => `${_chainIcons2[ch] || '🔗'} ${ch}: ${cnt}`);
      if (_breakdownParts.length > 1) {
        msg += `By Chain: ${_breakdownParts.join(' · ')}\n`;
      }
      msg += `\n`;
      msg += `━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🎯 *Rank Progress → ${nextRankNames[freshUser.rank] || "MAX"}*\n`;
      msg += `\`${bar}\` ${rankPct.toFixed(0)}%\n`;
      msg += `${vol.toFixed(2)} / ${nextRank} SOL needed\n`;
      msg += `━━━━━━━━━━━━━━━━━━━`;
      const kb = { inline_keyboard: [
        [{ text: "📤 Today's Card", callback_data: "stats_card_today" }, { text: "📤 Weekly Card", callback_data: "stats_card_week" }],
        [{ text: "📤 Monthly Card", callback_data: "stats_card_month" }, { text: "🏅 Rank Card", callback_data: "gen_rank_card" }],
        [{ text: "← Back", callback_data: "menu_main" }, { text: "🔄 Refresh", callback_data: "menu_stats" }],
      ]};
      return ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
    }

    if (data === "stats_card_today" || data === "stats_card_week" || data === "stats_card_month") {
      await ctx.answerCallbackQuery("⏳ Generating card...");
      const freshUser = db.getUser(userId);
      const { RANKS } = require("../keyboards");
      const rank = RANKS[freshUser.rank] || RANKS[1];
      const period = data === "stats_card_today" ? "today" : data === "stats_card_week" ? "week" : "month";
      const today = db.getTodayStats(userId, freshUser.active_wallet_id);
      const weekly = db.getWeeklyPnl(userId);
      const monthly = db.getMonthlyPnl(userId);
      const allTime = db.getUserStats(userId);
      const pnlSol = period === "today" ? (today.pnl || 0) : period === "week" ? weekly : monthly;
      const days = period === "today" ? 1 : period === "week" ? 7 : 30;
      const periodStats = db.getPeriodStats(userId, days);
      const periodFeeSaved = period === "today" ? db.getDailyFeeSaved(userId) : period === "week" ? db.getWeeklyFeeSaved(userId) : db.getMonthlyFeeSaved(userId);
      const _statsCardSolPx = await db.getSolPriceUsdShared().catch(() => 150);
      const { generateStatsCard } = require("../statsCard");
      const result = await generateStatsCard({
        username: freshUser.username || "Trader",
        rankName: rank.name,
        rankNum: freshUser.rank || 1,
        period,
        pnlSol,
        pnlUsd: Math.abs(pnlSol * _statsCardSolPx),
        trades: periodStats.trades || 0,
        winRate: periodStats.winRate || 0,
        volume: freshUser.cumulative_volume_sol || 0,
        weekPnl: weekly,
        monthPnl: monthly,
        nextRankSol: rank.nextSol || 0,
        rankProgress: (rank.nextSol || 0) > 0 ? Math.min(99, ((freshUser.cumulative_volume_sol||0) / (rank.nextSol||1)) * 100) : 100,
        bestTrade: periodStats.bestTrade || 0,
        worstTrade: periodStats.worstTrade || 0,
        totalFees: periodStats.totalFees || 0,
        streak: periodStats.streak || 0,
        avgTrade: periodStats.avgTrade || 0,
        feeSaved: periodFeeSaved || 0,
        referralCode: freshUser.custom_code || freshUser.referral_code || db.ensureReferralCode(userId),
      });
      if (result.type === "photo") {
        const { InputFile } = require("grammy");
        await ctx.replyWithPhoto(new InputFile(Buffer.from(result.buffer), `hawkx_${period}_pnl.png`));
      } else {
        await ctx.reply(result.text, { parse_mode: "Markdown" });
      }
      return true;
    }

    // ── SETTINGS ──────────────────────────────────────────────
    if (data === "menu_settings") {
      await ctx.answerCallbackQuery();
      return showSettings(ctx, user);
    }

    if (
      data.startsWith("set_") || data.startsWith("bset_") || data.startsWith("pset_") ||
      data.startsWith("sap_") || data.startsWith("alert_") || data.startsWith("ast_") ||
      data.startsWith("ast_select_") || data.startsWith("ast_view_") || data.startsWith("ast_back_") ||
      data.startsWith("ab_") || data.startsWith("sas_") ||
      data === "pset_autosell_manual" || data === "pset_autosell_screen" || data === "pset_autobuy_screen"
    ) {
      if (data.startsWith("lang_")) {
        const lang = data.replace("lang_", "");
        db.updateUser(userId, { language: lang });
        await ctx.answerCallbackQuery(`✅ Language updated`);
        return showSettings(ctx, db.getUser(userId));
      }
      return handleSettingCallback(ctx, user, data, bot, async (source) => {
        if (source === "msnipe_as_back") return refreshMsnipeScreen(ctx, userId);
        if (source === "msnipe_open_as") { ctx.callbackQuery.data = "msnipe_open_as"; await bot.handleUpdate({ callback_query: ctx.callbackQuery }); return; }
        if (source === "sniper_rt_as_back" || source === "sniper_realtime_menu" || source === "sniper_rt_autosell") {
          await ctx.answerCallbackQuery().catch(()=>{});
          ctx.callbackQuery.data = "sniper_rt_autosell";
          await bot.handleUpdate({ callback_query: ctx.callbackQuery });
          return;
        }
        ctx.callbackQuery.data = source;
        await bot.handleUpdate({ callback_query: ctx.callbackQuery });
      });
    }

    return false;
}

module.exports = { handleMenuCallbacks };
