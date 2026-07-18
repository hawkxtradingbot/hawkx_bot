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
    if (data === "chain_switch_do" || data.startsWith("chain_select_")) {
      const chains = db.getEnabledChains();
      const activeChain = db.getActiveChain(userId);
      let nextChain;
      if (data.startsWith("chain_select_")) {
        const targetChainKey = data.replace("chain_select_", "");
        nextChain = chains.find(c => c.chain === targetChainKey);
        if (targetChainKey === activeChain) { await ctx.answerCallbackQuery("Already on this chain."); return true; }
      } else {
        const idx = chains.findIndex(c => c.chain === activeChain);
        nextChain = chains[(idx + 1) % chains.length];
      }
      if (!nextChain || chains.length < 1) {
        await ctx.answerCallbackQuery("Chain not available right now.");
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
      // CRITICAL: active_wallet_id must also switch to the wallet on the NEW chain, otherwise
      // Portfolio/Wallets/Deposit etc keep showing the OLD chain's wallet despite the chain switch.
      const targetWallet = wallet || db.getWalletForChain(userId, nextChain.chain);
      if (targetWallet) db.updateUser(userId, { active_wallet_id: targetWallet.wallet_id });
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
    if (data === "bridge_start" || data.startsWith("bridge_exp_") || data.startsWith("bridge_from_") ||
        data.startsWith("bridge_to_") || data.startsWith("bridge_fw_") || data.startsWith("bridge_tw_") ||
        data === "bridge_reverse" || data.startsWith("bridge_pct_")) {
      await ctx.answerCallbackQuery();
      const B = require("./callbacks.bridge");
      let st = JSON.parse(db.getSysConfig(`bridge_state_${userId}`) || "{}");

      if (data === "bridge_start") st = {};
      else if (data.startsWith("bridge_exp_")) { const w = data.replace("bridge_exp_", ""); st.exp = st.exp === w ? null : w; }
      else if (data.startsWith("bridge_from_")) { st.fromChain = data.replace("bridge_from_", ""); st.fromWallet = null; st.exp = null; st.amount = null; st.quoteOut = null; }
      else if (data.startsWith("bridge_to_"))   { st.toChain = data.replace("bridge_to_", ""); st.toWallet = null; st.exp = null; st.quoteOut = null; }
      else if (data.startsWith("bridge_fw_"))   { st.fromWallet = parseInt(data.replace("bridge_fw_", "")); st.exp = null; }
      else if (data.startsWith("bridge_tw_"))   { st.toWallet = parseInt(data.replace("bridge_tw_", "")); st.exp = null; }
      else if (data === "bridge_reverse") { const a = st.fromChain, b = st.toChain; st.fromChain = b; st.toChain = a; st.fromWallet = null; st.toWallet = null; st.amount = null; st.quoteOut = null; st.exp = null; }
      else if (data.startsWith("bridge_pct_")) {
        const pct = parseInt(data.replace("bridge_pct_", ""));
        const pre = await B.buildBridgeScreen(userId, st);
        st = pre.state;
        let amt = pre.fromBal * (pct / 100);
        if (pct === 100) amt = Math.max(0, amt - (B.isSol(st.fromChain) ? 0.003 : 0.0004));
        st.amount = amt > 0 ? Number(amt.toFixed(B.isSol(st.fromChain) ? 4 : 6)) : null;
        st.quoteOut = null;
      }
      db.setSysConfig(`bridge_state_${userId}`, JSON.stringify(st));

      if (st.amount && !st.quoteOut) {
        try {
          const relay = require("../bridge/relay");
          const s2 = B.seed(userId, st);
          const fw = B.pick(userId, s2, "from"), tw = B.pick(userId, s2, "to");
          if (fw && tw) {
            const q = await relay.getQuote({
              userAddress: fw.public_key, recipient: tw.public_key,
              originChainId: B.cfg(s2.fromChain).relayId, destinationChainId: B.cfg(s2.toChain).relayId,
              originCurrency: B.currencyFor(s2.fromChain), destinationCurrency: B.currencyFor(s2.toChain),
              amount: String(Math.floor(st.amount * Math.pow(10, B.cfg(s2.fromChain).dec))),
            });
            const out = q?.details?.currencyOut?.amountFormatted;
            if (out) { st.quoteOut = Number(out).toFixed(6); }
          }
        } catch (e) { console.error("[Bridge] quote:", e.message); }
      }

      const scr = await B.buildBridgeScreen(userId, st);
      db.setSysConfig(`bridge_state_${userId}`, JSON.stringify({ ...scr.state, quoteOut: st.quoteOut }));
      try { await ctx.editMessageText(scr.text, { parse_mode: "Markdown", reply_markup: scr.reply_markup }); }
      catch { await ctx.reply(scr.text, { parse_mode: "Markdown", reply_markup: scr.reply_markup }); }
      return true;
    }

    if (data === "bridge_enter_amount") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`pending_${userId}`, "bridge_amount_input");
      const sent = await ctx.reply("✏️ Enter the amount to bridge:");
      db.setSysConfig(`pending_msg_${userId}`, String(sent.message_id));
      return true;
    }

    if (data === "bridge_confirm") {
      const _bl = db.getSysConfig(`bridge_processing_${userId}`);
      if (_bl && (Date.now() - parseInt(_bl)) < 60000) { await ctx.answerCallbackQuery("⏳ Already processing."); return true; }
      db.setSysConfig(`bridge_processing_${userId}`, String(Date.now()));
      await ctx.answerCallbackQuery("⏳ Starting...");
      const B = require("./callbacks.bridge");
      const st = B.seed(userId, JSON.parse(db.getSysConfig(`bridge_state_${userId}`) || "{}"));
      const fC = B.cfg(st.fromChain), tC = B.cfg(st.toChain);
      const fw = B.pick(userId, st, "from"), tw = B.pick(userId, st, "to");
      let procMsg;
      try {
        if (!fw || !tw || !st.amount) { await ctx.reply("❌ Pick chains, wallets and an amount first."); return true; }
        procMsg = await ctx.reply(`⏳ Bridging ${st.amount} ${fC.sym} → ${tC.short}...`);
        const relay = require("../bridge/relay");
        const quote = await relay.getQuote({
          userAddress: fw.public_key, recipient: tw.public_key,
          originChainId: fC.relayId, destinationChainId: tC.relayId,
          originCurrency: B.currencyFor(st.fromChain), destinationCurrency: B.currencyFor(st.toChain),
          amount: String(Math.floor(st.amount * Math.pow(10, fC.dec))),
        });
        const step = quote.steps.find(s => s.id === "deposit") || quote.steps[0];
        let txHash;
        if (B.isSol(st.fromChain)) {
          const { decryptWallet } = require("../walletVault");
          const { signAndSendSolanaDeposit } = require("../bridge/solanaSign");
          txHash = await signAndSendSolanaDeposit(decryptWallet(fw.wallet_id), step.items[0].data);
        } else {
          const { decryptEvmWallet } = require("../chains/evm/wallet");
          const { ethers } = require("ethers");
          const cc = db.getChainConfig(st.fromChain);
          const signer = decryptEvmWallet(fw).connect(new ethers.JsonRpcProvider(cc.rpc_url));
          const d = step.items[0].data;
          const tx = await signer.sendTransaction({ to: d.to, data: d.data, value: d.value, chainId: d.chainId });
          txHash = tx.hash;
        }
        await ctx.api.editMessageText(ctx.chat.id, procMsg.message_id, `⏳ Sent. Waiting for ${tC.short}...`);
        const res = await relay.pollStatus(step.requestId, 40);
        const cc2 = db.getChainConfig(st.fromChain);
        const url = cc2 && cc2.explorer_url ? `${cc2.explorer_url}/tx/${txHash}` : "";
        if (res.success) {
          await ctx.api.editMessageText(ctx.chat.id, procMsg.message_id,
            `✅ *Done.* ${st.amount} ${fC.sym} → ${tC.short}` + (url ? `\n\n[View transaction](${url})` : ""),
            { parse_mode: "Markdown", disable_web_page_preview: true });
          db.setSysConfig(`bridge_state_${userId}`, "");
        } else {
          await ctx.api.editMessageText(ctx.chat.id, procMsg.message_id, `⚠️ Still pending. Funds are safe.` + (url ? `\n\n[Check transaction](${url})` : ""), { parse_mode: "Markdown", disable_web_page_preview: true });
        }
      } catch (e) {
        const m = String(e.message || "");
        let msg = "❌ ";
        if (m.includes("Invalid address")) msg += "Wallet doesn't match the destination chain. Switch to that chain once to create one.";
        else if (m.includes("insufficient") || m.includes("balance")) msg += "Not enough balance for this amount plus fees. Try less.";
        else if (m.includes("route") || m.includes("liquidity")) msg += "No route right now. Try a smaller amount or again shortly.";
        else if (m.includes("timeout")) msg += "Timed out. Nothing was sent.";
        else msg += m.slice(0, 120);
        try { if (procMsg) await ctx.api.editMessageText(ctx.chat.id, procMsg.message_id, msg); else await ctx.reply(msg); } catch { await ctx.reply(msg); }
      } finally {
        db.setSysConfig(`bridge_processing_${userId}`, "");
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
