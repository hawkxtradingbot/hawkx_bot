const db = require("../../../database");
const { safeEdit, buildLaunchMsg, showLaunchScreen, buildLaunchForm } = require("./helpers.routes");
const { mockBuy, mockSell } = require("../executor");

async function refreshLaunchTradeScreen(ctx, userId, ca) {
  const { buildLaunchSuccessScreen } = require("../launch");
  const { getMockPrice } = require("../executor");
  const savedName = db.getSysConfig(`launched_name_${ca}`) || ca.slice(0,8);
  const savedSymbol = db.getSysConfig(`launched_symbol_${ca}`) || "???";
  const price = getMockPrice(ca);
  const pos = db.getDb().prepare("SELECT * FROM positions WHERE user_id = ? AND token_ca = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1").get(userId, ca);
  const holding = pos ? (pos.token_amount || 0) : 0;
  const holdingSol = pos ? ((pos.token_amount||0) * price) : 0;
  // Mock stats (real at mainnet)
  let info = {};
  try { const { getTokenInfo } = require("../tokenInfo"); info = await getTokenInfo(ca); } catch {}
  const mcap = info.mcap || (price * 1000000000);
  const liq = info.liquidity || 5000;
  const holders = info.holders || Math.floor(Math.random()*200)+10;
  const ch24 = info.change24h || 0;
  const top10 = Math.floor(Math.random()*30)+15;
  const gradPct = Math.min(99, Math.floor(Math.random()*60)+10);
  const pnl = pos && pos.avg_buy_price ? ((price - pos.avg_buy_price)/pos.avg_buy_price*100) : 0;
  const dexUrl = "https://dexscreener.com/solana/" + ca;
  const pumpUrl = "https://pump.fun/" + ca;
  // Launch age (how long since launched) + refresh time
  const launchRow = db.getDb().prepare("SELECT created_at FROM launches WHERE user_id = ? AND token_ca = ? ORDER BY id DESC LIMIT 1").get(userId, ca);
  let ageStr = "";
  if (launchRow && launchRow.created_at) {
    const ms = Date.now() - new Date(launchRow.created_at.replace(" ", "T") + "Z").getTime();
    const mins = Math.floor(ms / 60000), hrs = Math.floor(mins/60), days = Math.floor(hrs/24);
    ageStr = days > 0 ? `${days}d ${hrs%24}h ago` : hrs > 0 ? `${hrs}h ${mins%60}m ago` : `${mins}m ago`;
  }
  const nowStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const fmtN = (n) => n >= 1000000 ? (n/1000000).toFixed(1)+"M" : n >= 1000 ? (n/1000).toFixed(1)+"K" : n.toFixed(0);
  let msg = `✅ *${savedName}* (${savedSymbol}) · <a href="${dexUrl}">📈 Dex</a> · <a href="${pumpUrl}">🌊 Pump</a>\n\n━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 Price: ${price.toFixed(8)}   📊 MC: ${fmtN(mcap)}\n`;
  msg += `💧 Liq: ${fmtN(liq)}   👥 Holders: ${holders}\n`;
  msg += `📈 24h: ${ch24>=0?"+":""}${ch24.toFixed(1)}%   🎯 PnL: ${pnl>=0?"+":""}${pnl.toFixed(1)}%\n`;
  msg += `💼 Holding: ${holding>0 ? fmtN(holding)+" (~"+holdingSol.toFixed(2)+" SOL)" : "none yet"}\n`;
  msg += `🎓 Bonding: ${gradPct}%   👑 Top 10: ${top10}%\n`;
  if (ageStr) msg += `🚀 Launched: ${ageStr}\n`;
  msg += `🔗 \`${ca}\`\n━━━━━━━━━━━━━━━━━━━\n🔄 Updated ${nowStr}`;
  try { await ctx.editMessageText(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: buildLaunchSuccessScreen(ca, savedName, savedSymbol) }); } catch {}
}

async function handleLaunchCallbacks(ctx, data, userId, user, bot, ks) {
    // ── WATCHLIST ─────────────────────────────────────────────
    if (data === "menu_launch") {
      await ctx.answerCallbackQuery();
      await showLaunchScreen(ctx, userId);
      return true;
    }

    if (data === "launch_f_wallet_open") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`launch_wallet_exp_${userId}`, "1");
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    if (data === "launch_f_wallet_close") {
      await ctx.answerCallbackQuery();
      db.setSysConfig(`launch_wallet_exp_${userId}`, "0");
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    if (data.startsWith("launch_f_setwallet_")) {
      const wId = parseInt(data.replace("launch_f_setwallet_", ""));
      db.setSysConfig(`launch_f_wallet_${userId}`, String(wId));
      db.setSysConfig(`launch_wallet_exp_${userId}`, "0");
      await ctx.answerCallbackQuery("✅ Wallet selected");
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    // ── ADVANCED TOGGLES ─────────────────────────────────────
    if (data === "launch_f_revokemint") {
      const cur = db.getSysConfig(`launch_f_revokemint_${userId}`) !== "0";
      db.setSysConfig(`launch_f_revokemint_${userId}`, cur ? "0" : "1");
      await ctx.answerCallbackQuery();
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }
    if (data === "launch_f_revokefreeze") {
      const cur = db.getSysConfig(`launch_f_revokefreeze_${userId}`) !== "0";
      db.setSysConfig(`launch_f_revokefreeze_${userId}`, cur ? "0" : "1");
      await ctx.answerCallbackQuery();
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }
    if (data === "launch_f_burnlp") {
      const cur = db.getSysConfig(`launch_f_burnlp_${userId}`) === "1";
      db.setSysConfig(`launch_f_burnlp_${userId}`, cur ? "0" : "1");
      await ctx.answerCallbackQuery(cur ? "🔥 Burn LP OFF" : "🔥 Burn LP ON");
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    // ── ADVANCED INPUTS ──────────────────────────────────────
    if (["launch_f_maxwallet","launch_f_bundleper","launch_f_antisnipe","launch_f_buyback","launch_f_initprice","launch_f_vestpct","launch_f_vestcliff"].includes(data)) {
      const map = {
        launch_f_maxwallet: { key: "maxwallet", label: "👥 Enter Max Wallet % (e.g. 2, or 0 for no limit):" },
        launch_f_bundleper: { key: "bundleper", label: "💰 Enter SOL per bundle wallet (e.g. 0.5):" },
        launch_f_antisnipe: { key: "antisnipe", label: "🛡 Anti-Snipe delay in seconds (e.g. 10, or 0 off):\n\nBlocks snipers from buying in the first X seconds." },
        launch_f_buyback: { key: "buyback", label: "🔁 Auto-Buyback % of creator fees (e.g. 50, or 0 off):\n\nUses your token's own fees to buy back & support price." },
        launch_f_initprice: { key: "initprice", label: "💲 Initial price in SOL (e.g. 0.0001, or 0 for auto):" },
        launch_f_vestpct: { key: "vestpct", label: "💎 % of supply to vest (e.g. 20):" },
        launch_f_vestcliff: { key: "vestcliff", label: "⏳ Cliff days before unlock starts (e.g. 7):" },
      };
      const mm = map[data];
      await ctx.answerCallbackQuery();
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (msgId) db.setSysConfig(`launch_form_msg_${userId}`, String(msgId));
      db.setSysConfig(`launch_field_${userId}`, mm.key);
      const sent = await ctx.reply(mm.label, { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(sent.message_id));
      db.setSysConfig(`pending_${userId}`, "launch_field_input");
      return true;
    }

    // ── VESTING DAYS ─────────────────────────────────────────
    if (data === "launch_f_vd_30" || data === "launch_f_vd_60" || data === "launch_f_vd_90") {
      const days = data.replace("launch_f_vd_", "");
      db.setSysConfig(`launch_f_vestingdays_${userId}`, days);
      await ctx.answerCallbackQuery(`💎 Vesting ${days} days`);
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    // ── BUNDLE WALLET SELECTOR ───────────────────────────────
    if (data === "launch_f_bundle_open") {
      db.setSysConfig(`launch_f_bundle_exp_${userId}`, "1");
      await ctx.answerCallbackQuery();
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }
    if (data === "launch_f_bundle_close") {
      db.setSysConfig(`launch_f_bundle_exp_${userId}`, "0");
      await ctx.answerCallbackQuery();
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }
    

    if (data === "launch_f_bundlemode_same") {
      db.setSysConfig(`launch_f_bundlemode_${userId}`, "same");
      await ctx.answerCallbackQuery("💰 Same amount for all");
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }
    if (data === "launch_f_bundlemode_custom") {
      db.setSysConfig(`launch_f_bundlemode_${userId}`, "custom");
      await ctx.answerCallbackQuery("🔧 Custom amount each");
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    if (data.startsWith("launch_f_bundletoggle_")) {
      const wId = data.replace("launch_f_bundletoggle_", "");
      let ids = (db.getSysConfig(`launch_f_bundleids_${userId}`) || "").split(",").filter(Boolean);
      const mode = db.getSysConfig(`launch_f_bundlemode_${userId}`) || "same";
      if (ids.includes(wId)) {
        // Deselect
        ids = ids.filter(x => x !== wId);
        db.setSysConfig(`launch_f_bundleids_${userId}`, ids.join(","));
        await ctx.answerCallbackQuery("Removed");
        const { msg, kb } = buildLaunchForm(userId);
        return safeEdit(ctx, msg, kb);
      }
      // Select
      ids.push(wId);
      db.setSysConfig(`launch_f_bundleids_${userId}`, ids.join(","));
      if (mode === "custom") {
        // Prompt for this wallet's amount
        await ctx.answerCallbackQuery();
        const msgId = ctx.callbackQuery?.message?.message_id;
        if (msgId) db.setSysConfig(`launch_form_msg_${userId}`, String(msgId));
        db.setSysConfig(`launch_bundle_wid_${userId}`, wId);
        const sent = await ctx.reply("💰 Enter SOL amount for this wallet (e.g. 0.5):", { parse_mode: "Markdown" });
        db.setSysConfig(`prompt_msg_${userId}`, String(sent.message_id));
        db.setSysConfig(`pending_${userId}`, "launch_bundle_amount");
        return true;
      }
      await ctx.answerCallbackQuery("Added");
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    // ── SCHEDULE LAUNCH ──────────────────────────────────────
    if (data === "launch_f_schedule") {
      await ctx.answerCallbackQuery();
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (msgId) db.setSysConfig(`launch_form_msg_${userId}`, String(msgId));
      const sent = await ctx.reply("🕐 *Schedule Launch*\n\nWhen should the token launch?\n\n• 2h → in 2 hours\n• 30m → in 30 minutes\n• now → launch immediately\n\nEnter time:", { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(sent.message_id));
      db.setSysConfig(`pending_${userId}`, "launch_schedule_input");
      return true;
    }

    // ── LAUNCHPAD SELECTION ──────────────────────────────────
    if (data.startsWith("launch_lp_")) {
      const lp = data.replace("launch_lp_", "");
      await ctx.answerCallbackQuery();
      // Clear form for a fresh launch
      ["name","symbol","desc","image","x","tg","web","supply","curve","grad","vesting","devbuy","revokemint","revokefreeze","burnlp","maxwallet","bundlewallets","bundleper","wallet","discord","vestingdays","bundleids","bundle_exp","wallet_exp","schedule","antisnipe","buyback","initprice","vestpct","vestcliff","bundlemode","bundleamounts"].forEach(k => db.setSysConfig(`launch_f_${k}_${userId}`, ""));
      db.setSysConfig(`launch_lp_${userId}`, lp);
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    if (data === "launch_f_guide") {
      await ctx.answerCallbackQuery();
      const lp = db.getSysConfig(`launch_lp_${userId}`) || "pump";
      const isAdv = (lp === "launchlab" || lp === "meteora");
      let g = "📖 *Launch Guide — Every Field Explained*\n\n━━━━━━━━━━━━━━━━━━━\n";
      g += "*📋 Basics:*\n";
      g += "📝 *Name* — your token's full name\n";
      g += "🔤 *Symbol* — ticker (e.g. HAWK), max 10\n";
      g += "📄 *Description* — what your token is about\n";
      g += "🖼 *Image* — token logo (send photo or URL)\n\n";
      g += "*🔗 Socials:*\n";
      g += "🐦 X · ✈️ Telegram · 🌐 Website · 💬 Discord\nLink your community so buyers trust you.\n\n";
      g += "*💰 Initial Buy* — you buy your own token at\nlaunch (1 wallet). Secures supply early.\n\n";
      g += "*🎁 Bundle Buy* — multiple wallets buy in the\nSAME block as launch. Beats snipers, spreads\nsupply. Same amount for all OR custom each.\n\n";
      g += "*🕐 Schedule* — launch now or at a set time\n(2h, 30m, or a date like 'July 7 6am').\n\n";
      g += "*🛡 Anti-Snipe* — block buys for X seconds after\nlaunch so bots can't front-run your community.\n\n";
      g += "*🔁 Auto-Buyback* — % of your token's trading\nfees used to buy back & support price (separate\nfrom your HawkX fees).\n";
      if (isAdv) {
        g += "\n*⚙️ Advanced (this launchpad):*\n";
        g += "📦 *Supply* — total tokens created\n";
        g += "📈 *Curve* — justsendit (85 SOL preset) or custom\n";
        g += "🎓 *Graduation* — SOL needed to graduate to DEX\n";
        g += "💎 *Vesting* — lock dev tokens, release over\ntime (% + days + cliff). Builds trust.\n";
        g += "💲 *Initial Price* — starting price (custom curve)\n";
        g += "🔒 *Revoke Mint* — no more tokens can be made (safe)\n";
        g += "🔒 *Revoke Freeze* — can't freeze wallets (safe)\n";
        g += "🔥 *Burn LP* — lock liquidity forever (anti-rug)\n";
        g += "👥 *Max Wallet* — cap how much one wallet can hold\n";
      }
      g += "━━━━━━━━━━━━━━━━━━━";
      const kb = { inline_keyboard: [[{ text: "← Back to Form", callback_data: `launch_lp_back` }]] };
      return safeEdit(ctx, g, kb);
    }

    if (data === "launch_lp_back") {
      await ctx.answerCallbackQuery();
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    if (data === "launch_f_adv_toggle") {
      const cur = db.getSysConfig(`launch_f_adv_exp_${userId}`) === "1";
      db.setSysConfig(`launch_f_adv_exp_${userId}`, cur ? "0" : "1");
      await ctx.answerCallbackQuery();
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    if (data === "launch_f_noop") {
      await ctx.answerCallbackQuery("❗ Set name & symbol first");
      return true;
    }

    // ── METADATA TEXT FIELDS ─────────────────────────────────
    if (["launch_f_name","launch_f_symbol","launch_f_desc","launch_f_x","launch_f_tg","launch_f_web","launch_f_discord","launch_f_supply","launch_f_grad","launch_f_devbuy"].includes(data)) {
      const map = {
        launch_f_name: { key: "name", label: "📝 Enter token NAME (e.g. HawkCoin):" },
        launch_f_symbol: { key: "symbol", label: "🔤 Enter token SYMBOL (e.g. HAWK, max 10):" },
        launch_f_desc: { key: "desc", label: "📄 Enter token DESCRIPTION:" },
        launch_f_x: { key: "x", label: "🐦 Enter X (Twitter) URL:" },
        launch_f_tg: { key: "tg", label: "✈️ Enter Telegram URL:" },
        launch_f_web: { key: "web", label: "🌐 Enter Website URL:" },
        launch_f_discord: { key: "discord", label: "💬 Enter Discord URL:" },
        launch_f_supply: { key: "supply", label: "📦 Enter total SUPPLY (e.g. 1000000000):" },
        launch_f_grad: { key: "grad", label: "🎓 Enter graduation SOL target (e.g. 85):" },
        launch_f_devbuy: { key: "devbuy", label: "💰 Enter dev buy amount in SOL (e.g. 0.5, or 0 to skip):" },
      };
      const m = map[data];
      await ctx.answerCallbackQuery();
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (msgId) db.setSysConfig(`launch_form_msg_${userId}`, String(msgId));
      db.setSysConfig(`launch_field_${userId}`, m.key);
      const sent = await ctx.reply(m.label, { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(sent.message_id));
      db.setSysConfig(`pending_${userId}`, "launch_field_input");
      return true;
    }

    if (data === "launch_f_image") {
      await ctx.answerCallbackQuery();
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (msgId) db.setSysConfig(`launch_form_msg_${userId}`, String(msgId));
      const sent = await ctx.reply("🖼 *Set Token Image*\n\nSend an image, or paste an image URL:", { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(sent.message_id));
      db.setSysConfig(`pending_${userId}`, "launch_image_input");
      return true;
    }

    // ── TOGGLES (curve, vesting) ─────────────────────────────
    if (data === "launch_f_curve") {
      const cur = db.getSysConfig(`launch_f_curve_${userId}`) || "justsendit";
      db.setSysConfig(`launch_f_curve_${userId}`, cur === "justsendit" ? "custom" : "justsendit");
      await ctx.answerCallbackQuery();
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    if (data === "launch_f_vesting") {
      const cur = db.getSysConfig(`launch_f_vesting_${userId}`) === "1";
      db.setSysConfig(`launch_f_vesting_${userId}`, cur ? "0" : "1");
      await ctx.answerCallbackQuery(cur ? "💎 Vesting OFF" : "💎 Vesting ON");
      const { msg, kb } = buildLaunchForm(userId);
      return safeEdit(ctx, msg, kb);
    }

    // ── CONFIRM LAUNCH ───────────────────────────────────────
    if (data === "launch_f_confirm_force") { data = "launch_f_confirm"; }
    if (data === "launch_f_confirm") {
      const lp = db.getSysConfig(`launch_lp_${userId}`) || "pump";
      const name = db.getSysConfig(`launch_f_name_${userId}`) || "";
      const symbol = db.getSysConfig(`launch_f_symbol_${userId}`) || "";
      if (!name || !symbol) { await ctx.answerCallbackQuery("❗ Set name & symbol"); return true; }
      // Launch wallet balance check
      if (!data.includes("_force")) {
        const lwId = parseInt(db.getSysConfig(`launch_f_wallet_${userId}`)) || user.active_wallet_id;
        const allW = db.getWallets(userId) || [];
        const lw = allW.find(w => w.wallet_id === lwId) || allW[0];
        const lwBal = lw ? parseFloat(db.getSysConfig(`mock_balance_${lw.public_key}`) || "0") : 0;
        const devBuyAmt = parseFloat(db.getSysConfig(`launch_f_devbuy_${userId}`) || "0");
        const needLaunch = devBuyAmt + 0.04;
        if (lwBal < needLaunch) {
          await ctx.answerCallbackQuery();
          const wn = lw ? (allW.indexOf(lw)+1) : 1;
          const warnMsg = `⚠️ *Launch Wallet Low*\n\n━━━━━━━━━━━━━━━━━━━\nW${wn} has *${lwBal.toFixed(2)} SOL* but launching\nneeds ~*${needLaunch.toFixed(2)} SOL*:\n\n• Initial buy: ${devBuyAmt} SOL\n• Launch fee + Jito tip: ~0.04 SOL\n━━━━━━━━━━━━━━━━━━━\n\nTop up the wallet or lower the initial buy.`;
          const kb = { inline_keyboard: [
            [{ text: "← Back to Fix", callback_data: "launch_lp_back" }],
          ]};
          return safeEdit(ctx, warnMsg, kb);
        }
      }
      // Bundle wallet balance check (Jito bundles are atomic — one underfunded wallet fails all)
      const bundleIds = (db.getSysConfig(`launch_f_bundleids_${userId}`) || "").split(",").filter(Boolean);
      if (bundleIds.length && !data.includes("_force")) {
        const bMode = db.getSysConfig(`launch_f_bundlemode_${userId}`) || "same";
        const bPer = parseFloat(db.getSysConfig(`launch_f_bundleper_${userId}`) || "0");
        let bAmounts = {}; try { bAmounts = JSON.parse(db.getSysConfig(`launch_f_bundleamounts_${userId}`) || "{}"); } catch {}
        const allWallets = db.getWallets(userId) || [];
        const lowWallets = [];
        bundleIds.forEach(id => {
          const w = allWallets.find(x => String(x.wallet_id) === String(id));
          if (!w) return;
          const bal = parseFloat(db.getSysConfig(`mock_balance_${w.public_key}`) || "0");
          const need = (bMode === "custom" ? (parseFloat(bAmounts[id]||0)) : bPer) + 0.02;
          const num = allWallets.indexOf(w) + 1;
          const nm = (w.label && !w.label.match(/^W\d+$/)) ? w.label : `W${num}`;
          if (bal < need) lowWallets.push(`${nm} (${bal.toFixed(2)}/${need.toFixed(2)})`);
        });
        if (lowWallets.length) {
          await ctx.answerCallbackQuery();
          const warnMsg = `⚠️ *Bundle Wallets Underfunded*\n\n━━━━━━━━━━━━━━━━━━━\nThese wallets don't have enough SOL for\ntheir bundle buy + fees:\n\n${lowWallets.join("\n")}\n━━━━━━━━━━━━━━━━━━━\n\n⚡ Bundle buys are atomic — if one wallet\nfails, the whole bundle can fail.\n\nTop them up, remove them from the bundle,\nor launch anyway (those buys may fail).`;
          const kb = { inline_keyboard: [
            [{ text: "⚠️ Launch Anyway", callback_data: "launch_f_confirm_force" }],
            [{ text: "← Back to Fix", callback_data: "launch_lp_back" }],
          ]};
          return safeEdit(ctx, warnMsg, kb);
        }
      }
      await ctx.answerCallbackQuery("🚀 Launching...");
      // Mock CA on devnet
      const mockCa = "LAUNCH" + Math.random().toString(36).slice(2,10) + "x" + Date.now().toString(36).slice(-6);
      const launchId = db.createLaunch(userId, {
        tokenCa: mockCa, name, symbol,
        description: db.getSysConfig(`launch_f_desc_${userId}`) || "",
        imageUrl: db.getSysConfig(`launch_f_image_${userId}`) || "",
        launchpad: lp,
        supply: db.getSysConfig(`launch_f_supply_${userId}`) || "1000000000",
        curveType: db.getSysConfig(`launch_f_curve_${userId}`) || "justsendit",
        graduationSol: parseFloat(db.getSysConfig(`launch_f_grad_${userId}`) || "85"),
        vesting: db.getSysConfig(`launch_f_vesting_${userId}`) === "1",
        xUrl: db.getSysConfig(`launch_f_x_${userId}`) || "",
        telegramUrl: db.getSysConfig(`launch_f_tg_${userId}`) || "",
        websiteUrl: db.getSysConfig(`launch_f_web_${userId}`) || "",
        devBuySol: parseFloat(db.getSysConfig(`launch_f_devbuy_${userId}`) || "0"),
        status: "launched",
      });
      // Save advanced fields
      db.updateLaunch(userId, launchId, {
        revoke_mint: db.getSysConfig(`launch_f_revokemint_${userId}`) !== "0" ? 1 : 0,
        revoke_freeze: db.getSysConfig(`launch_f_revokefreeze_${userId}`) !== "0" ? 1 : 0,
        burn_lp: db.getSysConfig(`launch_f_burnlp_${userId}`) === "1" ? 1 : 0,
        max_wallet_pct: parseFloat(db.getSysConfig(`launch_f_maxwallet_${userId}`) || "0"),
        bundle_wallets: parseInt(db.getSysConfig(`launch_f_bundlewallets_${userId}`) || "0"),
        bundle_per_sol: parseFloat(db.getSysConfig(`launch_f_bundleper_${userId}`) || "0"),
        discord_url: db.getSysConfig(`launch_f_discord_${userId}`) || "",
        vesting_days: parseInt(db.getSysConfig(`launch_f_vestingdays_${userId}`) || "0"),
        bundle_wallet_ids: db.getSysConfig(`launch_f_bundleids_${userId}`) || "",
        bundle_wallets: (db.getSysConfig(`launch_f_bundleids_${userId}`) || "").split(",").filter(Boolean).length,
      });
      db.updateLaunch(userId, launchId, {
        antisnipe_sec: parseInt(db.getSysConfig(`launch_f_antisnipe_${userId}`) || "0"),
        buyback_pct: parseFloat(db.getSysConfig(`launch_f_buyback_${userId}`) || "0"),
        initial_price: parseFloat(db.getSysConfig(`launch_f_initprice_${userId}`) || "0"),
        vesting_pct: parseFloat(db.getSysConfig(`launch_f_vestpct_${userId}`) || "0"),
        vesting_cliff: parseInt(db.getSysConfig(`launch_f_vestcliff_${userId}`) || "0"),
        bundle_mode: db.getSysConfig(`launch_f_bundlemode_${userId}`) || "same",
        bundle_amounts: db.getSysConfig(`launch_f_bundleamounts_${userId}`) || "",
      });
      // Save to sysconfig for the trade screen
      db.setSysConfig(`launched_name_${mockCa}`, name);
      db.setSysConfig(`launched_symbol_${mockCa}`, symbol);
      const info = { pump:"pump.fun", launchlab:"Raydium LaunchLab", meteora:"Meteora DBC", letsbonk:"LetsBonk", moonshot:"Moonshot" }[lp] || lp;
      const { buildLaunchSuccessScreen } = require("../launch");
      const { getMockPrice } = require("../executor");
      const price = getMockPrice(mockCa);
      const sched = db.getSysConfig(`launch_f_schedule_${userId}`) || "";
      const isScheduled = sched && sched !== "Launch now";
      if (isScheduled) db.updateLaunch(userId, launchId, { status: "scheduled", schedule_at: sched });
      let msg;
      if (isScheduled) {
        msg = `🕐 *Launch Scheduled!*\n\n━━━━━━━━━━━━━━━━━━━\n🚀 *${name}* (${symbol})\n📍 ${info}\n🕐 Launches: ${sched}\n━━━━━━━━━━━━━━━━━━━\n\n💡 _Will auto-launch at the scheduled time (mainnet)._`;
      } else {
        msg = `✅ *${name} is LIVE!* [DEVNET]\n\n🔗 CA: \`${mockCa}\`\n💰 Price: *${price.toFixed(8)}*\n📍 ${info}\n\n💡 _Trade your token below_`;
      }
      // Clear the form AFTER building (so launch is clean for next time)
      ["name","symbol","desc","image","x","tg","web","supply","curve","grad","vesting","devbuy","revokemint","revokefreeze","burnlp","maxwallet","bundlewallets","bundleper","wallet","discord","vestingdays","bundleids","bundle_exp","wallet_exp","schedule","antisnipe","buyback","initprice","vestpct","vestcliff","bundlemode","bundleamounts"].forEach(k => db.setSysConfig(`launch_f_${k}_${userId}`, ""));
      return safeEdit(ctx, msg, buildLaunchSuccessScreen(mockCa, name, symbol));
    }

    if (data === "launch_my_list") {
      await ctx.answerCallbackQuery();
      const launches = db.getLaunches(userId);
      const lpIcons = { pump:"🌊", launchlab:"🔵", meteora:"🟣", letsbonk:"🟡", moonshot:"🌙" };
      let msg = "📜 *My Launches*\n\n━━━━━━━━━━━━━━━━━━━\n";
      const kb = { inline_keyboard: [] };
      if (!launches.length) {
        msg += "_No launches yet._\n\nTap a launchpad to create your first token.\n━━━━━━━━━━━━━━━━━━━";
      } else {
        msg += `🚀 ${launches.length} token(s) launched\nTap one to view & trade.\n━━━━━━━━━━━━━━━━━━━`;
        launches.slice(0,15).forEach(l => {
          const icon = lpIcons[l.launchpad] || "🚀";
          kb.inline_keyboard.push([{ text: `${icon} ${l.name} (${l.symbol})`, callback_data: `launch_view_${l.id}` }]);
        });
      }
      kb.inline_keyboard.push([{ text: "← Back", callback_data: "menu_launch" }]);
      return safeEdit(ctx, msg, kb);
    }

    if (data.startsWith("launch_view_")) {
      const id = parseInt(data.replace("launch_view_", ""));
      await ctx.answerCallbackQuery();
      const l = db.getLaunch(userId, id);
      if (!l) { await ctx.answerCallbackQuery("Not found"); return true; }
      const lpName = { pump:"pump.fun", launchlab:"Raydium LaunchLab", meteora:"Meteora DBC", letsbonk:"LetsBonk", moonshot:"Moonshot" }[l.launchpad] || l.launchpad;
      let info = {};
      try { const { getTokenInfo } = require("../tokenInfo"); info = await getTokenInfo(l.token_ca); } catch {}
      const { getMockPrice } = require("../executor");
      const price = info.price || getMockPrice(l.token_ca);
      const dexUrl = "https://dexscreener.com/solana/" + l.token_ca;
      const statusIcon = l.status === "launched" ? "🟢 Live" : l.status === "scheduled" ? "🕐 Scheduled" : "🟡 " + l.status;
      let msg = `🚀 *${l.name}* (${l.symbol})\n\n━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📍 Launchpad: ${lpName}\n`;
      msg += `📊 Status: ${statusIcon}\n`;
      msg += `💲 Price: ${price ? price.toFixed(8) : "—"}\n`;
      if (info.mcap) msg += `📈 MCap: ${(info.mcap/1000).toFixed(1)}K\n`;
      msg += `🔗 CA: \`${l.token_ca}\`\n`;
      msg += `━━━━━━━━━━━━━━━━━━━\n`;
      if (l.description) msg += `📄 ${l.description.slice(0,100)}\n`;
      const socials = [];
      if (l.x_url) socials.push("🐦 X"); if (l.telegram_url) socials.push("✈️ TG");
      if (l.website_url) socials.push("🌐 Web"); if (l.discord_url) socials.push("💬 Discord");
      if (socials.length) msg += `🔗 ${socials.join(" · ")}\n`;
      msg += `\n⚙️ *Launch Config:*\n`;
      msg += `📦 Supply: ${l.supply}\n`;
      if (l.launchpad === "launchlab" || l.launchpad === "meteora") {
        msg += `📈 Curve: ${l.curve_type} · 🎓 ${l.graduation_sol} SOL\n`;
        if (l.vesting) msg += `💎 Vesting: ${l.vesting_pct}% over ${l.vesting_days}d (cliff ${l.vesting_cliff}d)\n`;
        if (l.initial_price > 0) msg += `💲 Init Price: ${l.initial_price}\n`;
        msg += `🔒 Mint: ${l.revoke_mint?"revoked":"kept"} · Freeze: ${l.revoke_freeze?"revoked":"kept"}\n`;
        if (l.burn_lp) msg += `🔥 LP Burned\n`;
        if (l.max_wallet_pct > 0) msg += `👥 Max Wallet: ${l.max_wallet_pct}%\n`;
      }
      if (l.bundle_wallets > 0) msg += `🎁 Bundle: ${l.bundle_wallets} wallets (${l.bundle_mode})\n`;
      if (l.dev_buy_sol > 0) msg += `💰 Dev Buy: ${l.dev_buy_sol} SOL\n`;
      if (l.antisnipe_sec > 0) msg += `🛡 Anti-Snipe: ${l.antisnipe_sec}s\n`;
      if (l.buyback_pct > 0) msg += `🔁 Buyback: ${l.buyback_pct}%\n`;
      msg += `━━━━━━━━━━━━━━━━━━━`;
      const kb = { inline_keyboard: [
        [{ text: "📈 Chart", url: dexUrl }, { text: "💰 Buy More", callback_data: `launch_chart_${l.token_ca}` }],
        [{ text: "🗑 Delete", callback_data: `launch_del_${id}` }, { text: "← Back", callback_data: "launch_my_list" }],
      ]};
      return safeEdit(ctx, msg, kb);
    }

    if (data.startsWith("launch_del_")) {
      const id = parseInt(data.replace("launch_del_", ""));
      db.deleteLaunch(userId, id);
      await ctx.answerCallbackQuery("🗑 Deleted");
      const launches = db.getLaunches(userId);
      const lpIcons = { pump:"🌊", launchlab:"🔵", meteora:"🟣", letsbonk:"🟡", moonshot:"🌙" };
      let msg = "📜 *My Launches*\n\n━━━━━━━━━━━━━━━━━━━\n";
      const kb = { inline_keyboard: [] };
      if (!launches.length) { msg += "_No launches yet._\n━━━━━━━━━━━━━━━━━━━"; }
      else { launches.slice(0,15).forEach(l => { const icon = lpIcons[l.launchpad]||"🚀"; kb.inline_keyboard.push([{ text: `${icon} ${l.name} (${l.symbol})`, callback_data: `launch_view_${l.id}` }]); }); }
      kb.inline_keyboard.push([{ text: "← Back", callback_data: "menu_launch" }]);
      return safeEdit(ctx, msg, kb);
    }

    if (data === "launch_platform_hawkx") {
      await ctx.answerCallbackQuery("🦅 HawkX Launch — Coming Soon!");
      return true;
    }

    if (data === "launch_platform_pump" || data === "launch_platform_hawkx") {
      await ctx.answerCallbackQuery();
      const platform = data === "launch_platform_pump" ? "pump" : "hawkx";
      db.setSysConfig(`launch_platform_${userId}`, platform);
      const { getLaunchPending, buildLaunchScreen } = require("../launch");
      const { msg: fMsg, kb: fKb } = await buildLaunchMsg(userId, false);
      try { await ctx.editMessageText(fMsg, { parse_mode: "Markdown", reply_markup: fKb }); }
      catch { await ctx.reply(fMsg, { parse_mode: "Markdown", reply_markup: fKb }); }
      return true;
    }

    if (data.startsWith("launch_refresh_")) {
      await ctx.answerCallbackQuery("🔄 Refreshed!");
      const { msg, kb } = await buildLaunchMsg(userId, false);
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
      return true;
    }

    if (data === "launch_wallet_expand") {
      await ctx.answerCallbackQuery();
      const { msg, kb } = await buildLaunchMsg(userId, true);
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
      return true;
    }

    if (data === "launch_wallet_collapse") {
      await ctx.answerCallbackQuery();
      const { msg, kb } = await buildLaunchMsg(userId, false);
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
      return true;
    }

    if (data.startsWith("launch_setwallet_")) {
      const wId = parseInt(data.replace("launch_setwallet_", ""));
      db.setSysConfig(`launch_wallet_${userId}`, String(wId));
      await ctx.answerCallbackQuery("✅ Wallet selected!");
      const { msg, kb } = await buildLaunchMsg(userId, false);
      try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
      return true;
    }

    if (data === "launch_supply_locked") {
      await ctx.answerCallbackQuery("🔒 Pump.fun fixes supply at 1,000,000,000. Cannot be changed!");
      return true;
    }

    if (data === "launch_set_name" || data === "launch_set_symbol" || data === "launch_set_supply" ||
        data === "launch_set_desc" || data === "launch_set_twitter" || data === "launch_set_telegram" ||
        data === "launch_set_website") {
      await ctx.answerCallbackQuery();
      const fieldMap = {
        launch_set_name: { key: `launch_name_${userId}`, msg: "📝 Enter token name (e.g. My Token):" },
        launch_set_symbol: { key: `launch_symbol_${userId}`, msg: "🔤 Enter token symbol (e.g. MTK):" },
        launch_set_supply: { key: `launch_supply_${userId}`, msg: "🔢 Enter total supply (e.g. 1000000000):" },
        launch_set_desc: { key: `launch_desc_${userId}`, msg: "📄 Enter description:" },
        launch_set_twitter: { key: `launch_twitter_${userId}`, msg: "🐦 Enter Twitter (e.g. @mytoken):" },
        launch_set_telegram: { key: `launch_telegram_${userId}`, msg: "💬 Enter Telegram (e.g. t.me/mytoken):" },
        launch_set_website: { key: `launch_website_${userId}`, msg: "🌍 Enter website URL:" },
        launch_set_initial_buy: { key: `launch_initial_buy_${userId}`, msg: "💰 Enter initial buy in SOL (e.g. 0.5):" },
      };
      const f = fieldMap[data];
      const m = await ctx.reply(f.msg);
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, `launch_field_${data.replace("launch_set_","")}_${userId}`);
      return true;
    }

    if (data.startsWith("launch_buy_amt_")) {
      const amt = data.replace("launch_buy_amt_", "");
      db.setSysConfig(`launch_initial_buy_${userId}`, amt);
      await ctx.answerCallbackQuery(`💰 Initial buy: ${amt} SOL`);
      const { getLaunchPending, buildLaunchScreen } = require("../launch");
      const p = getLaunchPending(userId);
      const launchMsgId = parseInt(db.getSysConfig(`launch_msg_${userId}`) || "0");
      const pName = p.platform === "pump" ? "🌊 Pump.fun" : "🦅 HawkX";
      const launchMsgId2 = parseInt(db.getSysConfig(`launch_msg_${userId}`) || "0");
      const { msg: lMsg3, kb: lKb3 } = await buildLaunchMsg(userId, false);
      try {
        if (launchMsgId2) await ctx.api.editMessageText(ctx.chat.id, launchMsgId2, lMsg3, { parse_mode: "Markdown", reply_markup: lKb3 });
        else { const s = await ctx.reply(lMsg3, { parse_mode: "Markdown", reply_markup: lKb3 }); db.setSysConfig(`launch_msg_${userId}`, String(s.message_id)); }
      } catch { const s = await ctx.reply(lMsg3, { parse_mode: "Markdown", reply_markup: lKb3 }); db.setSysConfig(`launch_msg_${userId}`, String(s.message_id)); }
      return true;
    }

    if (data === "launch_set_image") {
      await ctx.answerCallbackQuery();
      const existingImg = db.getSysConfig(`launch_image_${userId}`) || "";
      const platform = db.getSysConfig(`launch_platform_${userId}`) || "hawkx";
      if (existingImg) {
        const previewMsg = await ctx.api.sendPhoto(ctx.chat.id, existingImg, {
          caption: "🖼 *Current token image*\n\nSend a new photo to replace it, or tap Back.",
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: `launch_platform_${platform}` }]] }
        });
        // Auto delete after 5 seconds
        setTimeout(async () => {
          try { await ctx.api.deleteMessage(ctx.chat.id, previewMsg.message_id); } catch {}
        }, 5000);
        db.setSysConfig(`pending_${userId}`, "launch_image");
        return true;
      }
      const m = await ctx.reply("🖼 Send your token image (JPG or PNG):", {
        reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: `launch_platform_${platform}` }]] }
      });
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, "launch_image");
      return true;
    }

    if (data === "launch_confirm") {
      const { getLaunchPending, buildLaunchSuccessScreen } = require("../launch");
      const p = getLaunchPending(userId);
      const missing = [];
      if (!p.name) missing.push("📝 Name");
      if (!p.symbol) missing.push("🔤 Symbol");
      if (!p.image) missing.push("🖼 Image");
      if (missing.length > 0) {
        await ctx.answerCallbackQuery("❌ Missing required fields!");
        await ctx.reply(
          `❌ *Missing Required Fields*\n\n` +
          missing.map(m => `• ${m} is required`).join("\n") +
          `\n\nPlease fill these before launching!`,
          { parse_mode: "Markdown" }
        );
        return true;
      }
      await ctx.answerCallbackQuery("🚀 Launching...");
      // Simulate token launch on devnet
      const ca = `DEVNET_${Date.now()}_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
      db.setSysConfig(`launch_ca_${userId}`, ca);
      // Save launch info by CA for later reference
      db.setSysConfig(`launched_name_${ca}`, p.name || "Unknown");
      db.setSysConfig(`launched_symbol_${ca}`, p.symbol || "???");
      // Clear pending settings for fresh next launch
      db.setSysConfig(`launch_name_${userId}`, "");
      db.setSysConfig(`launch_symbol_${userId}`, "");
      db.setSysConfig(`launch_supply_${userId}`, "");
      db.setSysConfig(`launch_desc_${userId}`, "");
      db.setSysConfig(`launch_twitter_${userId}`, "");
      db.setSysConfig(`launch_telegram_${userId}`, "");
      db.setSysConfig(`launch_website_${userId}`, "");
      db.setSysConfig(`launch_image_${userId}`, "");
      db.setSysConfig(`launch_initial_buy_${userId}`, "0");
      db.setSysConfig(`launch_platform_${userId}`, "");
      const successMsg =
        `✅ *Token Launched!* [DEVNET]\n\n` +
        `📝 *${p.name}* (${p.symbol})\n\n` +
        `📋 *Contract Address:*\n` +
        `${ca}\n\n` +
        `💰 Initial Price: *$0.000001*\n` +
        `📊 MCap: *$1,000*\n` +
        `💧 Liquidity: *$500*`;
      try { await ctx.editMessageText(successMsg, { parse_mode: "Markdown", reply_markup: buildLaunchSuccessScreen(ca, p.name, p.symbol) }); }
      catch { await ctx.reply(successMsg, { parse_mode: "Markdown", reply_markup: buildLaunchSuccessScreen(ca, p.name, p.symbol) }); }
      return true;
    }

    if (data.startsWith("launch_bundlesell_")) {
      const ca = data.replace("launch_bundlesell_", "");
      await ctx.answerCallbackQuery();
      const savedName = db.getSysConfig(`launched_name_${ca}`) || ca.slice(0,8);
      // Find which launch this is + its bundle wallets
      const launch = db.getDb().prepare("SELECT * FROM launches WHERE user_id = ? AND token_ca = ? ORDER BY id DESC LIMIT 1").get(userId, ca);
      let msg = `🎁 *Bundle Sell — ${savedName}*\n\n━━━━━━━━━━━━━━━━━━━\nSell from the wallets that bought at launch.\nCoordinated exit avoids one big price crash.\n━━━━━━━━━━━━━━━━━━━\n\n`;
      const kb = { inline_keyboard: [] };
      const bundleIds = launch && launch.bundle_wallet_ids ? launch.bundle_wallet_ids.split(",").filter(Boolean) : [];
      if (!bundleIds.length) {
        msg += "_No bundle wallets for this launch._\nUse normal Sell instead.";
      } else {
        msg += `${bundleIds.length} bundle wallet(s) hold this token.\nChoose how much to sell from all:`;
        kb.inline_keyboard.push([
          { text: "🔴 Sell 25%", callback_data: `launch_bsell_${ca}_25` },
          { text: "🔴 Sell 50%", callback_data: `launch_bsell_${ca}_50` },
        ]);
        kb.inline_keyboard.push([
          { text: "🔴 Sell 100% (all)", callback_data: `launch_bsell_${ca}_100` },
          { text: "🔴 ✏️ Custom", callback_data: `launch_bsell_custom_${ca}` },
        ]);
      }
      kb.inline_keyboard.push([{ text: "← Back", callback_data: `launch_chart_${ca}` }]);
      return safeEdit(ctx, msg, kb);
    }

    if (data.startsWith("launch_bsell_") && !data.includes("custom")) {
      const rest = data.replace("launch_bsell_", "");
      const idx = rest.lastIndexOf("_");
      const ca = rest.slice(0, idx);
      const pct = parseInt(rest.slice(idx+1));
      await ctx.answerCallbackQuery({ text: `✅ Bundle sold ${pct}% from all wallets`, show_alert: false });
      // Devnet: mock — at mainnet sells from each bundle wallet
      await refreshLaunchTradeScreen(ctx, userId, ca);
      return true;
    }

    if (data.startsWith("launch_chart_")) {
      await ctx.answerCallbackQuery("🔄 Refreshing...");
      const ca = data.replace("launch_chart_", "");
      await refreshLaunchTradeScreen(ctx, userId, ca);
      return true;
    }

    if (data.startsWith("launch_token_buy_") && !data.includes("custom")) {
      const parts = data.replace("launch_token_buy_", "").split("_");
      const ca = parts.slice(0,-1).join("_");
      const amt = parseFloat(parts[parts.length-1]);
      try {
        await mockBuy(ctx, user, ca, amt, "launch", "", { silent: true });
        await ctx.answerCallbackQuery({ text: `✅ Bought ${amt} SOL`, show_alert: false });
      } catch (e) {
        await ctx.answerCallbackQuery({ text: "❌ Buy failed", show_alert: true });
      }
      await refreshLaunchTradeScreen(ctx, userId, ca);
      return true;
    }

    if (data.startsWith("launch_token_buy_custom_")) {
      const ca = data.replace("launch_token_buy_custom_", "");
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("💰 Enter buy amount in SOL:");
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, `launch_custom_buy_${ca}`);
      return true;
    }

    if (data.startsWith("launch_token_sell_") && !data.includes("custom")) {
      const parts = data.replace("launch_token_sell_", "").split("_");
      const pct = parseInt(parts[parts.length-1]);
      const ca = parts.slice(0,-1).join("_");
      const pos = db.getDb().prepare("SELECT * FROM positions WHERE user_id = ? AND token_ca = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1").get(userId, ca);
      if (!pos) { await ctx.answerCallbackQuery({ text: "❌ You don't hold this token", show_alert: true }); return true; }
      const { mockSell } = require("../executor");
      try {
        await mockSell(ctx, user, pos, pct, { silent: true });
        await ctx.answerCallbackQuery({ text: `✅ Sold ${pct}%`, show_alert: false });
      } catch (e) {
        await ctx.answerCallbackQuery({ text: "❌ Sell failed", show_alert: true });
        return true;
      }
      if (pct >= 100) {
        // Fully sold → close to My Launches
        const savedName = db.getSysConfig(`launched_name_${ca}`) || ca.slice(0,8);
        const launches = db.getLaunches(userId);
        const lpIcons = { pump:"🌊", launchlab:"🔵", meteora:"🟣", letsbonk:"🟡", moonshot:"🌙" };
        let msg = `✅ *All sold!* ${savedName} is no longer in your wallet.\n\n📜 *My Launches*\n━━━━━━━━━━━━━━━━━━━\n`;
        const kb = { inline_keyboard: [] };
        if (!launches.length) { msg += "_No launches yet._"; }
        else { launches.slice(0,15).forEach(l => { const icon = lpIcons[l.launchpad]||"🚀"; kb.inline_keyboard.push([{ text: `${icon} ${l.name} (${l.symbol})`, callback_data: `launch_view_${l.id}` }]); }); }
        kb.inline_keyboard.push([{ text: "← Back", callback_data: "menu_launch" }]);
        try { await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb }); } catch {}
        return true;
      }
      await refreshLaunchTradeScreen(ctx, userId, ca);
      return true;
    }

    if (data.startsWith("launch_token_sell_custom_")) {
      const ca = data.replace("launch_token_sell_custom_", "");
      await ctx.answerCallbackQuery();
      const m = await ctx.reply("🔴 Enter sell % (e.g. 75):");
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, `launch_custom_sell_${ca}`);
      return true;
    }

    if (data.startsWith("launch_buy_")) {
      const ca = data.replace("launch_buy_", "");
      await ctx.answerCallbackQuery();
      ctx.callbackQuery.data = `trade_ca_${ca}`;
      return true;
    }


    return false;
}

module.exports = { handleLaunchCallbacks };
