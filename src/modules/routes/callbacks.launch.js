const db = require("../../../database");
const { safeEdit, buildLaunchMsg, showLaunchScreen, buildLaunchForm } = require("./helpers.routes");
const { mockBuy, mockSell } = require("../executor");

async function refreshLaunchTradeScreen(ctx, userId, ca) {
  const { buildLaunchSuccessScreen } = require("../launch");
  const { getMockPrice } = require("../executor");
  const savedName = db.getSysConfig(`launched_name_${ca}`) || ca.slice(0,8);
  const savedSymbol = db.getSysConfig(`launched_symbol_${ca}`) || "???";
  const price = getMockPrice(ca);
  const pos = db.getDb().prepare("SELECT * FROM positions WHERE user_id = ? AND token_ca = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1").get(userId, ca);
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
  // Graduation alert
  if (gradPct >= 100) msg += `🎉 *GRADUATED!* Now trading on the DEX!\n`;
  else if (gradPct >= 80) msg += `🔥 *Almost there!* ${100-gradPct}% to graduation\n`;
  // Social logos as hyperlinks (only show ones they added)
  const launchRow2 = db.getDb().prepare("SELECT x_url, telegram_url, website_url, discord_url FROM launches WHERE user_id = ? AND token_ca = ? ORDER BY id DESC LIMIT 1").get(userId, ca);
  if (launchRow2) {
    const socials = [];
    if (launchRow2.x_url) socials.push(`<a href="${launchRow2.x_url}">𝕏</a>`);
    if (launchRow2.telegram_url) socials.push(`<a href="${launchRow2.telegram_url}">✈️</a>`);
    if (launchRow2.website_url) socials.push(`<a href="${launchRow2.website_url}">🌐</a>`);
    if (launchRow2.discord_url) socials.push(`<a href="${launchRow2.discord_url}">💬</a>`);
    if (socials.length) msg += `🔗 ${socials.join("  ")}\n`;
  }
  if (ageStr) msg += `🚀 Launched: ${ageStr}\n`;
  msg += `📋 \`${ca}\`\n━━━━━━━━━━━━━━━━━━━\n🔄 Updated ${nowStr}`;
  try { await ctx.editMessageText(msg, { parse_mode: "HTML", disable_web_page_preview: true, reply_markup: buildLaunchSuccessScreen(ca, savedName, savedSymbol) }); } catch {}
}

async function handleLaunchCallbacks(ctx, data, userId, user, bot, ks) {
    // ── WATCHLIST ─────────────────────────────────────────────
    if (data === "menu_launch") {
      const ADMIN_ID = 6901299730;
      if (String(userId) !== String(ADMIN_ID)) {
        await ctx.answerCallbackQuery();
        try {
          await ctx.editMessageText(
            "🧪 *Launch Token — Coming Soon*\n\nThis feature is currently in testing and not yet available. Check back soon!",
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "menu_main" }]] } }
          );
        } catch {}
        return true;
      }
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
    if (["launch_f_maxwallet","launch_f_bundleper","launch_f_antisnipe","launch_f_buyback","launch_f_initprice","launch_f_vestpct","launch_f_vestcliff","launch_f_decimals","launch_f_teamalloc","launch_f_creatorfee","launch_f_startmc"].includes(data)) {
      const map = {
        launch_f_maxwallet: { key: "maxwallet", label: "👥 Enter Max Wallet % (e.g. 2, or 0 for no limit):" },
        launch_f_bundleper: { key: "bundleper", label: "💰 Enter SOL per bundle wallet (e.g. 0.5):" },
        launch_f_antisnipe: { key: "antisnipe", label: "🛡 Anti-Snipe delay in seconds (e.g. 10, or 0 off):\n\nBlocks snipers from buying in the first X seconds." },
        launch_f_buyback: { key: "buyback", label: "🔁 Auto-Buyback % of creator fees (e.g. 50, or 0 off):\n\nUses your token's own fees to buy back & support price." },
        launch_f_initprice: { key: "initprice", label: "💲 Initial price in SOL (e.g. 0.0001, or 0 for auto):" },
        launch_f_vestpct: { key: "vestpct", label: "💎 % of supply to vest (e.g. 20):" },
        launch_f_vestcliff: { key: "vestcliff", label: "⏳ Cliff days before unlock starts (e.g. 7):" },
        launch_f_decimals: { key: "decimals", label: "🔢 Token decimals (standard is 9):" },
        launch_f_teamalloc: { key: "teamalloc", label: "👥 Team allocation % (e.g. 10, or 0 for none):" },
        launch_f_startmc: { key: "startmc", label: "🎯 *Starting Market Cap*\n\nSet your token's starting MC in SOL.\nTypical range: 1–50 SOL. Lower = cheaper entry\nfor buyers, higher = premium start.\n\nEnter SOL (e.g. 10):" },
        launch_f_creatorfee: { key: "creatorfee", label: "💰 *Earn (Creator Fee)*\n\nYou earn this % on every trade of your token\n— passive income from volume.\n\n✅ *Trust range:* 0.5%–1% (buyers accept this)\n⚠️ 2%+ looks greedy and scares buyers\n🚩 5%+ is a red flag\n\n_Only LaunchLab & Meteora let you set a custom %.\npump.fun: auto 0.95%→0.05% by MCap.\nletsBONK: fixed 0.1% forever._\n\nEnter % (e.g. 1, or 0 for none):" },
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
    if (data.startsWith("launch_lp_") && data !== "launch_lp_back") {
      const lp = data.replace("launch_lp_", "");
      await ctx.answerCallbackQuery();
      // Clear form for a fresh launch
      ["name","symbol","desc","image","x","tg","web","supply","curve","grad","vesting","devbuy","revokemint","revokefreeze","burnlp","maxwallet","bundlewallets","bundleper","wallet","discord","vestingdays","bundleids","bundle_exp","wallet_exp","schedule","antisnipe","buyback","initprice","vestpct","vestcliff","bundlemode","bundleamounts","decimals","teamalloc","treasury","creatorfee","startmc","adv_exp"].forEach(k => db.setSysConfig(`launch_f_${k}_${userId}`, ""));
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
      g += "🐦 X · ✈️ Telegram · 🌐 Website · 💬 Discord\nLink your community so buyers trust you.\n";
      g += "_Simple launchpads (pump.fun, letsBONK, Moonshot)\nhave fixed supply & decimals. Advanced ones\n(LaunchLab, Meteora) let you customize._\n\n";
      g += "*💰 Initial Buy* — you buy your own token at\nlaunch (1 wallet). Secures supply early.\n\n";
      g += "⚠️ *IMPORTANT:* Once launched, token details\n(name, symbol, supply, decimals, image) CANNOT\nbe changed. Double-check before confirming.\n\n";
      g += "*🎓 Graduation* — when your token's bonding curve\nfills, it 'graduates' to a full DEX (Raydium).\nThe trade screen shows live progress %.\n\n";
      g += "*🔗 Socials* — X, Telegram, Website, Discord links\nappear as tappable logos on your token's trade\nscreen (only the ones you add show).\n\n";
      g += "*🎁 Bundle Buy* — multiple wallets buy in the\nSAME block as launch. Beats snipers, spreads\nsupply. Same amount for all OR custom each.\n\n";
      g += "*🕐 Schedule* — launch now or at a set time\n(2h, 30m, or a date like 'July 7 6am').\n\n";
      g += "*🛡 Anti-Snipe* — block buys for X seconds after\nlaunch so bots can't front-run your community.\n\n";
      g += "*🔁 Auto-Buyback* — % of your token's trading\nfees used to buy back & support price (separate\nfrom your HawkX fees).\n";
      if (isAdv) {
        const lpLabel = lp === "meteora" ? "Meteora DBC" : "Raydium LaunchLab";
        g += `\n*⚙️ Advanced (${lpLabel}):*\n`;
        g += "📦 *Supply* — total tokens created\n";
        g += "🔢 *Decimals* — token divisibility (6 standard)\n";
        if (lp === "meteora") {
          g += "📈 *DBC Curve* — configurable curve shape (linear,\nexponential). Sets how price rises as people buy.\n";
          g += "🎯 *Migration* — dynamic threshold; when hit, token\nmigrates to a Meteora DAMM pool automatically.\n";
        } else {
          g += "📈 *Curve* — justsendit (85 SOL preset) or custom\n";
          g += "🎓 *Graduation* — SOL raise target (min 30 SOL).\nAt target, LP migrates to Raydium & is burned.\n";
        }
        g += "💎 *Vesting* — lock dev/team tokens, release over\ntime (% + days + cliff). Builds buyer trust.\n";
        g += "👥 *Team Alloc* — % of supply reserved for team\n(pair with vesting or buyers distrust it).\n";
        g += "💵 *Creator Fee* — you earn % on every trade\n(0.5–1% is the trust range).\n";
        g += "🔒 *Revoke Mint* — no more tokens can be made (safe)\n";
        g += "🔒 *Revoke Freeze* — can't freeze wallets (safe)\n";
        g += "🔥 *Burn LP* — liquidity locked/burned automatically\nat graduation (anti-rug).\n";
        g += "👥 *Max Wallet* — cap how much one wallet can hold\n";
      } else {
        g += `\n*💰 Earn (Creator Fee):*\n`;
        if (lp === "pump") g += "pump.fun pays you 0.95% per trade (tokens under\n$300K MCap), scaling to 0.05% at $20M. Automatic.\nYou can send fees to charity, and pair with SOL or USDC.\n";
        else if (lp === "letsbonk") g += "letsBONK pays you 0.1% of every swap FOREVER,\neven after graduation. 0.02 SOL launch fee, 1%/swap\n(50% buys+burns BONK). Pair with SOL or USD1.\n";
        else g += "Moonshot uses fixed supply, decimals & curve with\nits own fee system. Auto-graduation handled for you.\n";
        g += `\n_Just set identity + use the tools above. Supply,\ndecimals & curve are fixed by this launchpad._\n`;
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

    if (data === "launch_f_treasury") {
      await ctx.answerCallbackQuery();
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (msgId) db.setSysConfig(`launch_form_msg_${userId}`, String(msgId));
      db.setSysConfig(`launch_field_${userId}`, "treasury");
      const sent = await ctx.reply("🏦 *Treasury Wallet*\n\nPaste a Solana address for the treasury\n(buyback/team funds), or send 'skip':", { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(sent.message_id));
      db.setSysConfig(`pending_${userId}`, "launch_field_input");
      return true;
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
      // Show "already added" notice if this field is already set
      const curVal = db.getSysConfig(`launch_f_${m.key}_${userId}`) || "";
      let promptLabel = m.label;
      if (curVal && !["supply","grad","devbuy","decimals","antisnipe","buyback","initprice","vestpct","vestcliff","maxwallet","teamalloc","creatorfee","bundleper"].includes(m.key)) {
        promptLabel = `✅ Already set: *${curVal.slice(0,40)}*\n\nSend a new value to change it, or ignore to keep.\n\n` + m.label;
      }
      const sent = await ctx.reply(promptLabel, { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(sent.message_id));
      db.setSysConfig(`pending_${userId}`, "launch_field_input");
      return true;
    }

    if (data === "launch_f_image") {
      await ctx.answerCallbackQuery();
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (msgId) db.setSysConfig(`launch_form_msg_${userId}`, String(msgId));
      const hasImg = db.getSysConfig(`launch_f_image_${userId}`) || "";
      const imgLabel = hasImg
        ? "🖼 *Image already added* ✅\n\nSend a new image to replace it, or ignore to keep the current one."
        : "🖼 *Set Token Image*\n\nSend an image, or paste an image URL:";
      const sent = await ctx.reply(imgLabel, { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(sent.message_id));
      db.setSysConfig(`pending_${userId}`, "launch_image_input");
      return true;
    }

    // ── TOGGLES (curve, vesting) ─────────────────────────────
    // pump.fun: creator fee info (dynamic, not user-settable)
    if (data === "launch_f_feeinfo") {
      await ctx.answerCallbackQuery({
        text: "pump.fun creator fee is automatic: 0.95% per trade for tokens under $300K MCap, scaling down to 0.05% at $20M MCap. You can't set it manually.",
        show_alert: true
      });
      return true;
    }

    // pump.fun: toggle sending creator fees to charity
    if (data === "launch_f_feecharity") {
      const cur = db.getSysConfig(`launch_f_feecharity_${userId}`) === "1";
      db.setSysConfig(`launch_f_feecharity_${userId}`, cur ? "0" : "1");
      await ctx.answerCallbackQuery(cur ? "Creator fees: kept by you" : "❤️ Creator fees will go to charity");
      const fc = buildLaunchForm(userId);
      return safeEdit(ctx, fc.msg, fc.kb);
    }

    // toggle paired token: SOL <-> USDC (pump.fun) or SOL <-> USD1 (letsBONK)
    if (data === "launch_f_pairtoken") {
      const lp = db.getSysConfig(`launch_lp_${userId}`) || "pump";
      const stable = lp === "letsbonk" ? "USD1" : "USDC";
      const cur = db.getSysConfig(`launch_f_pairtoken_${userId}`) || "SOL";
      const next = cur === "SOL" ? stable : "SOL";
      db.setSysConfig(`launch_f_pairtoken_${userId}`, next);
      await ctx.answerCallbackQuery(`🪙 Paired token: ${next}`);
      const pt = buildLaunchForm(userId);
      return safeEdit(ctx, pt.msg, pt.kb);
    }

    // letsBONK: creator fee info (fixed 0.1% forever, not settable)
    if (data === "launch_f_feeinfo_bonk") {
      await ctx.answerCallbackQuery({
        text: "letsBONK creator fee is fixed: you earn 0.1% of every swap forever, even after your token graduates to Raydium. It's automatic — not settable.",
        show_alert: true
      });
      return true;
    }

    if (data === "launch_f_curve") {
      const lpKey = db.getSysConfig(`launch_lp_${userId}`) || "pump";
      const cur = db.getSysConfig(`launch_f_curve_${userId}`) || (lpKey === "meteora" ? "dbc" : "justsendit");
      if (lpKey === "meteora") {
        db.setSysConfig(`launch_f_curve_${userId}`, cur === "dbc" ? "custom" : "dbc");
      } else {
        db.setSysConfig(`launch_f_curve_${userId}`, cur === "justsendit" ? "custom" : "justsendit");
      }
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
    if (data === "launch_f_review") {
      await ctx.answerCallbackQuery();
      const lp = db.getSysConfig(`launch_lp_${userId}`) || "pump";
      const lpName = { pump:"pump.fun", launchlab:"Raydium LaunchLab", meteora:"Meteora DBC", letsbonk:"LetsBonk", moonshot:"Moonshot" }[lp] || lp;
      const g = (k) => db.getSysConfig(`launch_f_${k}_${userId}`) || "";
      const name = g("name"), symbol = g("symbol"), desc = g("desc"), image = g("image");
      const supply = g("supply") || "1000000000";
      const devBuy = g("devbuy") || "0";
      const bundleIds = (g("bundleids")).split(",").filter(Boolean);
      const sched = g("schedule");
      const antisnipe = g("antisnipe"), buyback = g("buyback"), maxwallet = g("maxwallet");
      const revokeMint = db.getSysConfig(`launch_f_revokemint_${userId}`) !== "0";
      const revokeFreeze = db.getSysConfig(`launch_f_revokefreeze_${userId}`) !== "0";
      const burnLp = g("burnlp") === "1";
      const vesting = db.getSysConfig(`launch_f_vesting_${userId}`) === "1";
      // Build summary
      let msg = `📋 *Review Launch*\n\n━━━━━━━━━━━━━━━━━━━\n📍 ${lpName}\n🚀 *${name}* (${symbol})\n`;
      if (desc) msg += `📄 ${desc.slice(0,80)}\n`;
      msg += `🖼 Image: ${image ? "✅" : "⬜ none"}\n`;
      msg += `📦 Supply: ${supply}\n`;
      msg += `💰 Initial Buy: ${devBuy} SOL\n`;
      if (bundleIds.length) msg += `🎁 Bundle: ${bundleIds.length} wallets\n`;
      if (sched) msg += `🕐 Scheduled: ${sched}\n`;
      msg += `🔒 Mint: ${revokeMint?"revoked ✅":"KEPT ⚠️"} · Freeze: ${revokeFreeze?"revoked ✅":"ON ⚠️"}\n`;
      if (antisnipe>0) msg += `🛡 Anti-Snipe: ${antisnipe}s\n`;
      if (buyback>0) msg += `🔁 Buyback: ${buyback}%\n`;
      if (maxwallet>0) msg += `👥 Max Wallet: ${maxwallet}%\n`;
      const smc = g("startmc"); if (smc > 0) msg += `🎯 Starting MC: ${smc} SOL\n`;
      if (burnLp) msg += `🔥 LP Burn: ON\n`;
      if (vesting) msg += `💎 Vesting: ON\n`;
      msg += `━━━━━━━━━━━━━━━━━━━`;
      // Soft warnings
      const warns = [];
      if (!revokeMint) warns.push("Mint authority kept — looks risky to buyers");
      if (!revokeFreeze) warns.push("Freeze authority ON — scares buyers");
      if (bundleIds.length) warns.push("Bundle buy enabled");
      if (buyback>0) warns.push("Auto-buyback enabled");
      if (!g("x") && !g("tg") && !g("web")) warns.push("No social links added");
      if (warns.length) {
        msg += `\n\n⚠️ *Warnings:*\n${warns.map(w=>"• "+w).join("\n")}`;
      }
      const { LAUNCHPAD_INFO } = require("./helpers.routes");
      const cta = (LAUNCHPAD_INFO && LAUNCHPAD_INFO[lp]) ? LAUNCHPAD_INFO[lp].cta : "🚀 Confirm Launch";
      const kb = { inline_keyboard: [
        [{ text: cta, callback_data: "launch_f_confirm" }],
        [{ text: "← Edit (data kept)", callback_data: "launch_lp_back" }],
      ]};
      return safeEdit(ctx, msg, kb);
    }

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
        decimals: parseInt(db.getSysConfig(`launch_f_decimals_${userId}`) || "9"),
        team_alloc: parseFloat(db.getSysConfig(`launch_f_teamalloc_${userId}`) || "0"),
        treasury_wallet: db.getSysConfig(`launch_f_treasury_${userId}`) || "",
        creator_fee_bps: Math.round(parseFloat(db.getSysConfig(`launch_f_creatorfee_${userId}`) || "0") * 100),
        initial_price: parseFloat(db.getSysConfig(`launch_f_startmc_${userId}`) || "0"),
      });
      // Save to sysconfig for the trade screen
      db.setSysConfig(`launched_name_${mockCa}`, name);
      db.setSysConfig(`launched_symbol_${mockCa}`, symbol);
      // Fire the INITIAL BUY automatically (creates the position) — only if not scheduled
      const initBuyAmt = parseFloat(db.getSysConfig(`launch_f_devbuy_${userId}`) || "0");
      const schedCheck = db.getSysConfig(`launch_f_schedule_${userId}`) || "";
      const willSchedule = schedCheck && schedCheck !== "Launch now";
      if (initBuyAmt > 0 && !willSchedule) {
        const lName0 = db.getSysConfig(`launch_symbol_${userId}`) || db.getSysConfig(`launch_name_${userId}`) || "";
        try { await mockBuy(ctx, user, mockCa, initBuyAmt, "launch", "", { silent: true, tokenName: lName0 }); }
        catch (e) { console.error("[Launch initial buy] failed:", e.message); }
      }
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
        const { LAUNCHPAD_INFO } = require("./helpers.routes");
        const successTxt = (LAUNCHPAD_INFO && LAUNCHPAD_INFO[lp]) ? LAUNCHPAD_INFO[lp].success : "is LIVE!";
        msg = `✅ *${name}* ${successTxt} [DEVNET]\n\n🔗 CA: \`${mockCa}\`\n💰 Price: *${price.toFixed(8)}*\n\n💡 _Trade your token below_`;
      }
      // Clear the form AFTER building (so launch is clean for next time)
      ["name","symbol","desc","image","x","tg","web","supply","curve","grad","vesting","devbuy","revokemint","revokefreeze","burnlp","maxwallet","bundlewallets","bundleper","wallet","discord","vestingdays","bundleids","bundle_exp","wallet_exp","schedule","antisnipe","buyback","initprice","vestpct","vestcliff","bundlemode","bundleamounts","decimals","teamalloc","treasury","creatorfee","startmc","adv_exp"].forEach(k => db.setSysConfig(`launch_f_${k}_${userId}`, ""));
      // Scheduled launches show the schedule message; live launches go STRAIGHT to the full trade screen
      if (isScheduled) {
        return safeEdit(ctx, msg, buildLaunchSuccessScreen(mockCa, name, symbol));
      }
      await refreshLaunchTradeScreen(ctx, userId, mockCa);
      return true;
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
      // Ensure trade screen has the name/symbol cached
      db.setSysConfig(`launched_name_${l.token_ca}`, l.name);
      db.setSysConfig(`launched_symbol_${l.token_ca}`, l.symbol);
      // Go STRAIGHT to the trade screen
      await refreshLaunchTradeScreen(ctx, userId, l.token_ca);
      return true;
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
        const lName = db.getSysConfig(`launch_symbol_${userId}`) || db.getSysConfig(`launch_name_${userId}`) || "";
        await mockBuy(ctx, user, ca, amt, "launch", "", { silent: true, tokenName: lName });
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
      const pos = db.getDb().prepare("SELECT * FROM positions WHERE user_id = ? AND token_ca = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1").get(userId, ca);
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
