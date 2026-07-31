// Admin V12 — Complete
// Revenue, promoters, all user referral stats, download all data

const db         = require("../../database");
const config     = require("../../config");
const killSwitch = require("./killSwitch");
const { notifyAllUsers } = require("./notifications");
const fs         = require("fs");
const path       = require("path");

function isAdmin(userId) {
  return config.ADMIN_IDS.includes(String(userId));
}

// Edit-in-place screen helper: updates the current message instead of stacking a new one.
// Falls back to reply if the message can't be edited (e.g. first open).
async function adminScreen(ctx, msg, keyboard) {
  const opts = { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } };
  try { await ctx.editMessageText(msg, opts); }
  catch { try { await ctx.reply(msg, opts); } catch {} }
}

// ── Admin Panel Main Screen ───────────────────────────────────
async function showAdminPanel(ctx) {
  if (!isAdmin(ctx.from.id)) return;

  const total = db.getTotalUsers();
  const ranks = db.getRankDistribution();
  const ks    = killSwitch.isActive();
  const D = getDb => getDb;
  const _db = db.getDb();
  const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,19).replace("T"," "); };
  const todayIso = new Date().toISOString().slice(0,10) + " 00:00:00";

  // Revenue by period (sum of confirmed fees)
  const revSum = (since) => { try { const r = _db.prepare("SELECT SUM(fee_sol) t FROM trades WHERE status='confirmed' AND timestamp >= ?").get(since); return (r&&r.t)||0; } catch { return 0; } };
  const revToday = revSum(todayIso), revWeek = revSum(isoDaysAgo(7)), revMonth = revSum(isoDaysAgo(30));
  const revAll = (()=>{ try { const r=_db.prepare("SELECT SUM(fee_sol) t FROM trades WHERE status='confirmed'").get(); return (r&&r.t)||0; } catch { return 0; } })();

  // User growth
  const usersInRange = (since) => { try { const r=_db.prepare("SELECT COUNT(*) c FROM users WHERE created_at >= ? OR join_date >= ?").get(since, since); return (r&&r.c)||0; } catch { return 0; } };
  const newToday = usersInRange(todayIso), newWeek = usersInRange(isoDaysAgo(7));
  const activeToday = (()=>{ try { const r=_db.prepare("SELECT COUNT(DISTINCT user_id) c FROM trades WHERE timestamp >= ?").get(todayIso); return (r&&r.c)||0; } catch { return 0; } })();

  // Systems
  const cb = (()=>{ try { return require("./cashback").getConfig(); } catch { return {enabled:false}; } })();
  const cbWin = (()=>{ try { return require("./cashback").windowInfo(); } catch { return {active:false,msLeft:0}; } })();
  const cbDays = cbWin.msLeft ? Math.ceil(cbWin.msLeft/86400000) : 0;
  const chains = (()=>{ try { return _db.prepare("SELECT chain,enabled FROM chain_config").all(); } catch { return []; } })();
  const chainStr = chains.length ? chains.map(x=>x.chain+" "+(x.enabled?"✅":"🔴")).join(" · ") : "none";
  const trackedCount = (()=>{ try { return _db.prepare("SELECT COUNT(*) c FROM tracked_tokens WHERE active=1").get().c; } catch { return 0; } })();
  const promoCount = (()=>{ try { return _db.prepare("SELECT COUNT(*) c FROM users WHERE promoter_status=1").get().c; } catch { return 0; } })();

  const now   = new Date().toDateString();
  const rev   = { total: revToday };

  const rankStr = ranks.map((r) => {
    const name = config.RANK_NAMES?.[r.rank] || `R${r.rank}`;
    return `${name}: ${r.cnt}`;
  }).join(" | ");

  const f = (n) => Number(n||0).toFixed(4);
  const msg =
    `🦅 *HawkX Admin* ${process.env.MOCK_TRADES === "false" ? "🟢 MAINNET" : "🧪 DEVNET"}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👥 Users: *${total}*  ·  🟢 ${activeToday} active today\n` +
    `📈 New: +${newToday} today · +${newWeek} this week\n\n` +
    `💰 *Revenue*\n` +
    `Today: *${f(revToday)}*  ·  7d: *${f(revWeek)}*\n` +
    `30d: *${f(revMonth)}*  ·  All: *${f(revAll)}* SOL\n\n` +
    `⚙️ *Systems*\n` +
    `Kill Switch: ${ks ? "🔴 ACTIVE" : "✅ OFF"}\n` +
    `💸 Cashback: ${cb.enabled ? (cbWin.active ? `🟢 ON · ${cb.pct}% · ${cbDays}d left` : `🟡 ON · not started`) : "🔴 OFF"}\n` +
    `🔗 Chains: ${chainStr}\n` +
    `🎁 Rewards: ${trackedCount} tracked · ⭐ ${promoCount} promoters\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🔄 Tap Refresh to update`;

  await ctx.reply(msg, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Analytics", callback_data: "admin_m_analytics" }, { text: "💰 Revenue", callback_data: "admin_revenue" }],
        [{ text: "🎁 Rewards", callback_data: "admin_rewards" }, { text: "⭐ Promoters", callback_data: "admin_m_promoters" }],
        [{ text: "🛡 Safety", callback_data: "admin_m_safety" }, { text: "⚙️ Config", callback_data: "admin_m_config" }],
        [{ text: "🔄 Refresh", callback_data: "admin_refresh" }, { text: "🔙 Close", callback_data: "menu_main" }],
      ],
    },
  });
}

// ── Admin Callback Handler ────────────────────────────────────
async function handleAdminCallback(ctx, action) {
  if (!isAdmin(ctx.from.id)) {
    return ctx.answerCallbackQuery("❌ Admin only.");
  }

  // ── CHAIN MANAGEMENT ──────────────────────────────────────
  if (action === "admin_m_chains") {
    await ctx.answerCallbackQuery();
    const chains = db.getEnabledChains ? db.getDb().prepare("SELECT * FROM chain_config").all() : [];
    let msg = "🔗 *Chain Management*\n\n";
    const rows = [];
    chains.forEach(c => {
      const status = c.enabled ? "✅ Enabled" : "🔴 Disabled";
      msg += `${c.label} (${c.chain}): ${status}\n`;
      rows.push([{ text: `${c.enabled ? "🔴 Disable" : "✅ Enable"} ${c.label}`, callback_data: `admin_chain_toggle_${c.chain}` }]);
    });
    rows.push([{ text: "← Back", callback_data: "admin_panel" }]);
    await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } });
    return;
  }

  // ── CASHBACK CONFIG ───────────────────────────────────────
  if (action === "admin_m_cashback") {
    await ctx.answerCallbackQuery();
    const cb = require("./cashback");
    const c2 = cb.getConfig();
    const w = cb.windowInfo();
    const daysLeft = w.msLeft ? Math.ceil(w.msLeft / 86400000) : 0;
    let msg = "💸 *Cashback*\n\n";
    msg += `Status: ${c2.enabled ? "✅ ON" : "🔴 OFF"}\n`;
    msg += `Rate: *${c2.pct}%* of fees\n`;
    msg += `Pay in: *${c2.mode}*${c2.mode !== "SOL" ? " ("+c2.tokenLabel+")" : ""}\n`;
    msg += `Window: *${c2.days}d*${w.active ? " — "+daysLeft+"d left" : (c2.enabled ? " — not started/ended" : "")}\n`;
    msg += `Min fees to qualify: *${c2.minFeeSol}* SOL\n`;
    if (c2.mode !== "SOL") msg += `Token: \`${c2.tokenMint || "not set"}\`\n`;
    const rows = [
      [{ text: c2.enabled ? "🔴 Turn OFF" : "✅ Turn ON", callback_data: "admin_cb_toggle" }],
      [{ text: "📊 Set %", callback_data: "admin_cb_set_pct" }, { text: "⏱ Set Days", callback_data: "admin_cb_set_days" }],
      [{ text: "💰 Pay Mode", callback_data: "admin_cb_mode" }, { text: "🎯 Min Fees", callback_data: "admin_cb_set_min" }],
      [{ text: "🪙 Set Token", callback_data: "admin_cb_set_token" }, { text: "▶ Start Now", callback_data: "admin_cb_start" }],
      [{ text: "← Back", callback_data: "admin_panel" }],
    ];
    await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } });
    return;
  }

  if (action === "admin_cb_toggle") {
    const cb = require("./cashback");
    const cur = cb.getConfig().enabled;
    cb.setConfig({ enabled: !cur });
    await ctx.answerCallbackQuery(cur ? "Cashback OFF" : "Cashback ON");
    return handleAdminCallback(ctx, "admin_m_cashback");
  }

  if (action === "admin_cb_mode") {
    const cb = require("./cashback");
    const order = { SOL: "TOKEN", TOKEN: "BOTH", BOTH: "SOL" };
    const next = order[cb.getConfig().mode] || "SOL";
    cb.setConfig({ mode: next });
    await ctx.answerCallbackQuery("Pay mode: " + next);
    return handleAdminCallback(ctx, "admin_m_cashback");
  }

  if (action === "admin_cb_start") {
    const cb = require("./cashback");
    cb.setConfig({ startTs: Date.now() });
    await ctx.answerCallbackQuery("Window started now");
    return handleAdminCallback(ctx, "admin_m_cashback");
  }

  if (action === "admin_cb_set_pct")  { await ctx.answerCallbackQuery(); db.setSysConfig(`pending_${ctx.from.id}`, "admin_cb_pct");   return ctx.reply("Enter cashback % (e.g. 20):"); }
  if (action === "admin_cb_set_days") { await ctx.answerCallbackQuery(); db.setSysConfig(`pending_${ctx.from.id}`, "admin_cb_days");  return ctx.reply("Enter window length in days (e.g. 7):"); }
  if (action === "admin_cb_set_min")  { await ctx.answerCallbackQuery(); db.setSysConfig(`pending_${ctx.from.id}`, "admin_cb_min");   return ctx.reply("Enter minimum fees in SOL to qualify (e.g. 0.05):"); }
  if (action === "admin_cb_set_token"){ await ctx.answerCallbackQuery(); db.setSysConfig(`pending_${ctx.from.id}`, "admin_cb_token"); return ctx.reply("Send: <token_mint> <LABEL>  (e.g. Hawk... HAWKX):"); }

  if (action.startsWith("admin_chain_toggle_")) {
    const chainKey = action.replace("admin_chain_toggle_", "");
    const current = db.getChainConfig(chainKey);
    if (!current) { await ctx.answerCallbackQuery("❌ Chain not found."); return; }
    db.setChainEnabled(chainKey, current.enabled ? 0 : 1);
    await ctx.answerCallbackQuery(`${current.enabled ? "Disabled" : "Enabled"} ${current.label}`);
    return handleAdminCallback(ctx, "admin_m_chains");
  }

  // ── REWARDS MENU ──────────────────────────────────────────
  if (action === "admin_rewards") {
    await ctx.answerCallbackQuery();
    const tokens = db.getTrackedTokens();
    const history = db.getRewardHistory(100);
    const msg = `🎁 *Rewards & Airdrops*\n━━━━━━━━━━━━━━━\n📍 Tracked tokens: *${tokens.length}*\n📜 Rewards sent: *${history.length}*`;
    return adminScreen(ctx, msg, [
      [{ text: "➕ Add Tracked Token", callback_data: "admin_track_add" }],
      [{ text: "📊 Token Stats", callback_data: "admin_track_list" }],
      [{ text: "📜 Reward History", callback_data: "admin_reward_history" }],
      [{ text: "← Back", callback_data: "admin_panel" }],
    ]);
  }

  if (action === "admin_track_add") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_track_add");
    return ctx.reply("➕ *Add Tracked Token*\n\nSend the token CA (optionally: CA | Label):", { parse_mode: "Markdown" });
  }

  if (action === "admin_track_list") {
    await ctx.answerCallbackQuery();
    const tokens = db.getTrackedTokens();
    if (!tokens.length) return ctx.reply("No tracked tokens yet. Add one first.");
    const kb = tokens.map(t => [{ text: `${t.label || db.getTokenName(t.token_ca)} · view`, callback_data: `admin_analytics_${t.id}` }]);
    kb.push([{ text: "🔙 Back", callback_data: "admin_rewards" }]);
    return ctx.reply("📊 *Tracked Tokens* — tap to see traders:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: kb } });
  }

  // ── Rich analytics view ──
  if (action.startsWith("admin_analytics_")) {
    await ctx.answerCallbackQuery();
    const id = parseInt(action.replace("admin_analytics_", ""));
    const tokens = db.getTrackedTokens();
    const tok = tokens.find(t => t.id === id);
    if (!tok) return ctx.reply("Not found.");
    const traders = db.getTokenTraderAnalytics(tok.token_ca);
    db.setSysConfig(`admin_reward_ca_${ctx.from.id}`, tok.token_ca);
    let msg = `📊 *${tok.label || db.getTokenName(tok.token_ca)}*\n━━━━━━━━━━━━━━━\nTraders: *${traders.length}*\n\n`;
    traders.slice(0, 8).forEach((t, i) => {
      msg += `${i+1}. ${t.name}\n   💰${t.volume.toFixed(2)} SOL · 🟢${t.buys}b/${t.sells}s · ⏱${t.holdDays}d${t.stillHolding?' 💎':''}\n`;
    });
    if (traders.length > 8) msg += `\n_...+${traders.length-8} more_`;
    return ctx.reply(msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
      [{ text: "🎯 Build Airdrop (set criteria)", callback_data: `admin_criteria_${id}` }],
      [{ text: "🗑 Remove Token", callback_data: `admin_track_del_${id}` }],
      [{ text: "🔙 Back", callback_data: "admin_track_list" }],
    ]}});
  }

  // ── Criteria builder ──
  if (action.startsWith("admin_criteria_")) {
    await ctx.answerCallbackQuery();
    const id = parseInt(action.replace("admin_criteria_", ""));
    db.setSysConfig(`admin_crit_token_${ctx.from.id}`, String(id));
    db.setSysConfig(`admin_crit_list_${ctx.from.id}`, "[]");
    return ctx.reply("🎯 Build Airdrop Criteria\n\nAdd tiers one at a time. Each tier = a rule + a reward amount.\n\nExamples:\n• any → 0.01 SOL (everyone who traded)\n• volume >= 5 → 0.4 SOL\n• holdDays >= 3 → 0.6 SOL\n\nTap Add Tier to start.", { reply_markup: { inline_keyboard: [
      [{ text: "➕ Add Tier", callback_data: "admin_crit_add" }],
      [{ text: "✅ Done → Preview", callback_data: "admin_crit_done" }],
      [{ text: "🔙 Back", callback_data: `admin_analytics_${id}` }],
    ]}});
  }

  if (action === "admin_crit_add") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_crit_add");
    return ctx.reply("➕ *Add a Tier*\n\nFormat: `field op value amount`\n\nFields: any, volume, buys, sells, holdDays\nOps: >= > <= < ==\n\nExamples:\n`any 0 0 0.01`  (everyone → 0.01)\n`volume >= 5 0.4`  (vol≥5 SOL → 0.4)\n`holdDays >= 3 0.6`  (held 3+ days → 0.6)", { parse_mode: "Markdown" });
  }

  if (action === "admin_crit_done") {
    await ctx.answerCallbackQuery();
    let crit = []; try { crit = JSON.parse(db.getSysConfig(`admin_crit_list_${ctx.from.id}`)||"[]"); } catch {}
    if (!crit.length) return ctx.reply("No tiers added yet. Tap Add Tier first.");
    return ctx.reply(`🧮 *Tier Stacking*\n\nYou have ${crit.length} tier(s). When a wallet matches multiple tiers:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
      [{ text: "➕ Stack (add all matched)", callback_data: "admin_crit_mode_stack" }],
      [{ text: "🔝 Highest tier only", callback_data: "admin_crit_mode_highest" }],
    ]}});
  }

  if (action === "admin_crit_mode_stack" || action === "admin_crit_mode_highest") {
    await ctx.answerCallbackQuery();
    const mode = action === "admin_crit_mode_stack" ? "stack" : "highest";
    let crit = []; try { crit = JSON.parse(db.getSysConfig(`admin_crit_list_${ctx.from.id}`)||"[]"); } catch {}
    const ca = db.getSysConfig(`admin_reward_ca_${ctx.from.id}`);
    const traders = db.getTokenTraderAnalytics(ca);
    const rows = db.applyCriteria(traders, crit, mode);
    if (!rows.length) return ctx.reply("No wallets matched your criteria. Adjust the tiers.");
    const total = rows.reduce((s,r)=>s+r.amount,0);
    const snapId = db.saveSnapshot(ca, "", crit, rows, "SOL", ctx.from.id);
    let msg = `📸 *Snapshot #${snapId}*\n━━━━━━━━━━━━━━━\nMode: ${mode==='stack'?'Stack':'Highest only'}\nRecipients: *${rows.length}*\nTotal: *${total.toFixed(3)} SOL*\n\n`;
    rows.slice(0,8).forEach(r => { msg += `${r.name} → ${r.amount} SOL (${r.tier})\n`; });
    if (rows.length>8) msg += `_...+${rows.length-8} more_\n`;
    return ctx.reply(msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
      [{ text: "📥 Download CSV", callback_data: `admin_snap_csv_${snapId}` }],
      [{ text: "🔙 Rewards", callback_data: "admin_rewards" }],
    ]}});
  }

  if (action.startsWith("admin_snap_csv_")) {
    await ctx.answerCallbackQuery("Generating CSV...");
    const id = parseInt(action.replace("admin_snap_csv_", ""));
    const snap = db.getSnapshot(id);
    if (!snap) return ctx.reply("Snapshot not found.");
    let csv = "wallet,amount,reward_type,tier,volume,buys,sells,hold_days\n";
    snap.rows.forEach(r => { csv += `${r.wallet},${r.amount},${snap.reward_type},${r.tier},${r.volume||0},${r.buys||0},${r.sells||0},${r.holdDays||0}\n`; });
    const buf = Buffer.from(csv, "utf8");
    const { InputFile } = require("grammy");
    await ctx.replyWithDocument(new InputFile(buf, `airdrop_snapshot_${id}.csv`), { caption: `📥 Snapshot #${id} — ${snap.recipient_count} wallets, ${snap.total_amount.toFixed(3)} ${snap.reward_type} total.\n\n_Use this file to send the airdrop. [Mainnet: auto-send coming]_` });
    return;
  }

  if (action.startsWith("admin_track_view_")) {
    await ctx.answerCallbackQuery();
    const id = parseInt(action.replace("admin_track_view_", ""));
    const tokens = db.getTrackedTokens();
    const tok = tokens.find(t => t.id === id);
    if (!tok) return ctx.reply("Not found.");
    const traders = db.getTrackedTokenTraders(tok.token_ca);
    db.setSysConfig(`admin_reward_ca_${ctx.from.id}`, tok.token_ca);
    let msg = `📊 *${tok.label || db.getTokenName(tok.token_ca)}*\n━━━━━━━━━━━━━━━\nTraders: *${traders.length}*\n\n`;
    traders.slice(0, 10).forEach((t, i) => {
      const medal = ["🥇","🥈","🥉"][i] || `#${i+1}`;
      msg += `${medal} ${t.name} · ${t.volume.toFixed(2)} SOL · ${t.trades} trades\n`;
    });
    return ctx.reply(msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
      [{ text: "🎁 Reward These Traders", callback_data: `admin_reward_start_${id}` }],
      [{ text: "🗑 Remove Token", callback_data: `admin_track_del_${id}` }],
      [{ text: "🔙 Back", callback_data: "admin_track_list" }],
    ]}});
  }

  if (action.startsWith("admin_track_del_")) {
    await ctx.answerCallbackQuery("Removed.");
    db.removeTrackedToken(parseInt(action.replace("admin_track_del_", "")));
    return showAdminPanel(ctx);
  }

  if (action.startsWith("admin_reward_start_")) {
    await ctx.answerCallbackQuery();
    return ctx.reply("🎁 *Send Reward*\n\nChoose recipients:", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
      [{ text: "🏆 Top 10", callback_data: "admin_reward_top10" }, { text: "👥 All traders", callback_data: "admin_reward_all" }],
      [{ text: "🔙 Back", callback_data: "admin_rewards" }],
    ]}});
  }

  if (action === "admin_reward_top10" || action === "admin_reward_all") {
    await ctx.answerCallbackQuery();
    const ca = db.getSysConfig(`admin_reward_ca_${ctx.from.id}`);
    db.setSysConfig(`admin_reward_recipients_${ctx.from.id}`, action === "admin_reward_top10" ? "top10" : "all");
    return ctx.reply("💰 *Reward Type*\n\nPay in SOL or the token?", { parse_mode: "Markdown", reply_markup: { inline_keyboard: [
      [{ text: "💰 SOL", callback_data: "admin_reward_pay_sol" }, { text: "🪙 Token", callback_data: "admin_reward_pay_token" }],
      [{ text: "🔙 Back", callback_data: "admin_rewards" }],
    ]}});
  }

  if (action === "admin_reward_pay_sol" || action === "admin_reward_pay_token") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`admin_reward_type_${ctx.from.id}`, action === "admin_reward_pay_sol" ? "SOL" : "TOKEN");
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_reward_amount");
    return ctx.reply("💵 Enter amount per recipient (e.g. 0.1):");
  }

  if (action === "admin_reward_history") {
    await ctx.answerCallbackQuery();
    const h = db.getRewardHistory(15);
    if (!h.length) return ctx.reply("No rewards sent yet.");
    let msg = "📜 *Reward History*\n━━━━━━━━━━━━━━━\n";
    h.forEach(r => { msg += `${r.reward_type} ${r.amount} → user ${r.user_id} ${r.status==='sent'?'✅':'⏳'}\n`; });
    return ctx.reply(msg, { parse_mode: "Markdown" });
  }

  if (action === "admin_panel") { await ctx.answerCallbackQuery(); return showAdminPanel(ctx); }
  if (action === "admin_refresh") { await ctx.answerCallbackQuery("🔄 Updated"); try { await ctx.deleteMessage(); } catch {} return showAdminPanel(ctx); }

  // ── CONFIG (groups Broadcast, Chains, Cashback, System) ──
  if (action === "admin_m_config") {
    await ctx.answerCallbackQuery();
    return adminScreen(ctx, "⚙️ *Config*\n\nBot settings & controls.", [
      [{ text: "💸 Cashback", callback_data: "admin_m_cashback" }, { text: "🔗 Chains", callback_data: "admin_m_chains" }],
      [{ text: "📢 Broadcast", callback_data: "admin_broadcast" }, { text: "⚙️ System", callback_data: "admin_m_system" }],
      [{ text: "← Back", callback_data: "admin_panel" }],
    ]);
  }

  // ── SUBMENUS (match demo) ──
  if (action === "admin_m_analytics") {
    await ctx.answerCallbackQuery();
    return adminScreen(ctx, "📊 *Analytics*", [
      [{ text: "🔥 Trending Tokens", callback_data: "admin_trending" }],
      [{ text: "👥 All Users", callback_data: "admin_users" }],
      [{ text: "📊 Referral Stats", callback_data: "admin_referral_stats" }],
      [{ text: "📥 Download Data", callback_data: "admin_download" }],
      [{ text: "← Back", callback_data: "admin_panel" }],
    ]);
  }
  if (action === "admin_trending") {
    await ctx.answerCallbackQuery();
    const t24 = db.getTrendingTokens(24, 10);
    const t7d = db.getTrendingTokens(168, 5);
    let msg = "🔥 *Trending Tokens*\n━━━━━━━━━━━━━━━\n\n*Last 24h (most buyers):*\n";
    if (!t24.length) msg += "_No buys in 24h._\n";
    else t24.forEach((t,i) => { msg += `${i+1}. ${t.token_name||t.token_ca.slice(0,8)} · 👥${t.buyers} · 💰${t.volume.toFixed(1)} SOL\n`; });
    msg += "\n*Last 7 days:*\n";
    if (!t7d.length) msg += "_No buys in 7d._\n";
    else t7d.forEach((t,i) => { msg += `${i+1}. ${t.token_name||t.token_ca.slice(0,8)} · 👥${t.buyers} · 💰${t.volume.toFixed(1)} SOL\n`; });
    return ctx.reply(msg, { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_m_analytics" }]] } });
  }

  if (action === "admin_m_users") { return handleAdminCallback(ctx, "admin_m_analytics"); }
  if (action === "admin_m_promoters") {
    await ctx.answerCallbackQuery();
    return adminScreen(ctx, "⭐ *Promoter Management* (35% tier)", [
      [{ text: "👑 Add Promoter", callback_data: "admin_add_promoter" }, { text: "🗑 Remove", callback_data: "admin_remove_promoter" }],
      [{ text: "← Back", callback_data: "admin_panel" }],
    ]);
  }
  if (action === "admin_m_safety") {
    await ctx.answerCallbackQuery();
    const ks2 = killSwitch.isActive();
    return adminScreen(ctx, `🛡 *Safety Controls*\nTrading: ${ks2 ? "🔴 PAUSED" : "✅ ON"}`, [
      [{ text: ks2 ? "✅ Resume Trading" : "🔴 Kill Switch", callback_data: "admin_killswitch" }],
      [{ text: "🚩 Suspicious Activity", callback_data: "admin_suspicious" }],
      [{ text: "← Back", callback_data: "admin_panel" }],
    ]);
  }
  if (action === "admin_m_system") {
    await ctx.answerCallbackQuery();
    return adminScreen(ctx, "⚙️ *System Health*", [
      [{ text: "📡 gRPC / RPC Health", callback_data: "admin_grpc" }],
      [{ text: "← Back", callback_data: "admin_panel" }],
    ]);
  }

  // ── Kill Switch ───────────────────────────────────────────
  if (action === "admin_killswitch") {
    if (killSwitch.isActive()) {
      killSwitch.deactivate();
      await ctx.answerCallbackQuery("✅ Kill Switch OFF");
      await notifyAllUsers("✅ *HawkX Trading Resumed*\n\nTrading is now live again. 🦅");
    } else {
      killSwitch.activate();
      await ctx.answerCallbackQuery("🔴 Kill Switch ACTIVE");
      await notifyAllUsers(
        "🔴 *HawkX Trading Paused*\n\nAdmin has temporarily paused all trading.\nYour positions are safe."
      );
    }
    return showAdminPanel(ctx);

  // ── Add Promoter ──────────────────────────────────────────
  } else if (action === "admin_add_promoter") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_add_promoter");
    await ctx.reply("👑 Enter the Telegram user ID to make Promoter:");

  // ── Remove Promoter ───────────────────────────────────────
  } else if (action === "admin_remove_promoter") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_remove_promoter");
    await ctx.reply("🗑 Enter the Telegram user ID to remove Promoter:");

  // ── Revenue ───────────────────────────────────────────────
  } else if (action === "admin_revenue") {
    await ctx.answerCallbackQuery();
    const today     = db.getRevenue(new Date().toISOString().slice(0,10));
    const allTime   = db.getRevenue("2000-01-01");
    const promoters = db.getDb()
      .prepare("SELECT user_id, username FROM users WHERE promoter_status = 1")
      .all();

    let msg = `💰 *Revenue*\n\n`;
    msg += `Today: *${(today?.total||0).toFixed(6)} SOL*\n`;
    msg += `All Time: *${(allTime?.total||0).toFixed(6)} SOL*\n\n`;
    msg += `━━━━━━━━━━\n`;
    msg += `👑 *Promoters (${promoters.length}/100):*\n\n`;

    if (!promoters.length) {
      msg += `_No promoters yet._\n`;
    } else {
      promoters.forEach((p) => {
        const count  = db.getDirectReferralCount(p.user_id);
        const earned = db.getTotalEarnings(p.user_id);
        const pending = db.getPendingEarnings(p.user_id);
        msg += `• *${p.username || p.user_id}*\n`;
        msg += `  Referrals: ${count} | Earned: ${(earned?.total||0).toFixed(4)} SOL\n`;
        msg += `  Pending: ${(pending?.total||0).toFixed(6)} SOL\n\n`;
      });
    }

    await ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "admin_panel" }]] },
    });

  // ── All Users Referral Stats ──────────────────────────────
  } else if (action === "admin_referral_stats") {
    await ctx.answerCallbackQuery();
    const users = db.getAllUsers();
    let msg = `📊 *All Users Referral Stats*\n\n`;
    msg += `Total users: *${users.length}*\n\n`;
    msg += `━━━━━━━━━━\n`;

    let hasStats = false;
    for (const u of users) {
      const count   = db.getDirectReferralCount(u.user_id);
      const total   = db.getTotalEarnings(u.user_id);
      const pending = db.getPendingEarnings(u.user_id);
      const paid    = db.getPaidEarnings(u.user_id);
      if (count > 0 || (total?.total || 0) > 0) {
        hasStats = true;
        const isPromoter = u.promoter_status === 1 ? " 👑" : "";
        msg += `*${u.username || u.user_id}*${isPromoter}\n`;
        msg += `Referrals: ${count} | Earned: ${(total?.total||0).toFixed(4)} SOL\n`;
        msg += `Paid: ${(paid?.total||0).toFixed(4)} SOL | Pending: ${(pending?.total||0).toFixed(6)} SOL\n\n`;
      }
    }

    if (!hasStats) msg += `_No referral activity yet._`;

    // Split if too long
    if (msg.length > 4000) {
      msg = msg.slice(0, 3900) + "\n\n_...more users not shown. Use Download for full list._";
    }

    await ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "admin_panel" }]] },
    });

  // ── Download All Data ─────────────────────────────────────
  } else if (action === "admin_download") {
    await ctx.answerCallbackQuery("⏳ Generating report...");

    const users    = db.getAllUsers();
    const allTrades = db.getTradeHistory(0, 99999);
    const now      = new Date().toISOString().slice(0,10);

    let csv = "=== HAWKX ADMIN REPORT ===\n";
    csv += `Generated: ${new Date().toISOString()}\n`;
    csv += `Total Users: ${users.length}\n\n`;

    // Revenue
    const todayRev   = db.getRevenue(now);
    const totalRev   = db.getRevenue("2000-01-01");
    csv += `=== REVENUE ===\n`;
    csv += `Today: ${(todayRev?.total||0).toFixed(6)} SOL\n`;
    csv += `All Time: ${(totalRev?.total||0).toFixed(6)} SOL\n\n`;

    // Users
    csv += `=== ALL USERS ===\n\n`;
    for (const u of users) {
      const count   = db.getDirectReferralCount(u.user_id);
      const earned  = db.getTotalEarnings(u.user_id);
      const pending = db.getPendingEarnings(u.user_id);
      const rankName = config.RANK_NAMES?.[u.rank] || "Scout";
      csv += `────────────────────\n`;
      csv += `User: ${u.username||"Unknown"} (ID: ${u.user_id})\n`;
      csv += `Rank: ${rankName} | Volume: ${(u.cumulative_volume_sol||0).toFixed(4)} SOL\n`;
      csv += `Referrals: ${count} | Earned: ${(earned?.total||0).toFixed(6)} SOL\n`;
      csv += `Pending: ${(pending?.total||0).toFixed(6)} SOL | Promoter: ${u.promoter_status ? "Yes" : "No"}\n\n`;
    }

    // Write file
    const filePath = `/tmp/hawkx_report_${now}.txt`;
    fs.writeFileSync(filePath, csv);

    const { InputFile } = require("grammy");
    await ctx.replyWithDocument(
      new InputFile(fs.readFileSync(filePath), `HawkX_Report_${now}.txt`),
      { caption: `📥 HawkX Admin Report\nGenerated: ${now}\nUsers: ${users.length}` }
    );

    // Cleanup
    try { fs.unlinkSync(filePath); } catch {}

  // ── Broadcast ─────────────────────────────────────────────
  } else if (action === "admin_broadcast") {
    await ctx.answerCallbackQuery();
    db.setSysConfig(`pending_${ctx.from.id}`, "admin_broadcast");
    /*MEDIA_HINT*/
    await ctx.reply(
      "📢 *Broadcast Message*\n\nType your message below.\nIt will be sent to ALL users.",
      { parse_mode: "Markdown" }
    );

  // ── View Users ────────────────────────────────────────────
  } else if (action === "admin_users") {
    await ctx.answerCallbackQuery();
    const users = db.getAllUsers();
    const lines = users.slice(0, 20).map((u, i) => {
      const name     = u.username || "Unknown";
      const rankName = config.RANK_NAMES?.[u.rank] || "Scout";
      const vol      = (u.cumulative_volume_sol || 0).toFixed(2);
      const promo    = u.promoter_status ? "👑" : "";
      return `${i+1}. ${promo}${name}\n   ID: ${u.user_id} | ${rankName} | ${vol} SOL`;
    });
    await ctx.reply(`👥 Users (${users.length} total)\n━━━━━━━━━━━━━━━━━━━\n${lines.join("\n━━━━━━━━━━━━━━━━━━━\n")}`);

  // ── Simulate Trades ───────────────────────────────────────
  } else if (action === "admin_sim_trades") {
    const users = db.getAllUsers();
    for (const u of users) db.addVolume(u.user_id, 0.5);
    await ctx.answerCallbackQuery(`✅ +0.5 SOL to ${users.length} users`);

  // ── gRPC Health ───────────────────────────────────────────
  } else if (action === "admin_grpc") {
    await ctx.answerCallbackQuery();
    const grpcStatus = db.getSysConfig("grpc_status")  || "unknown";
    const rpcPrimary = db.getSysConfig("rpc_primary")  || "unknown";
    await ctx.reply(
      `📡 *Infrastructure Health*\n\ngRPC: *${grpcStatus}*\nRPC: *${rpcPrimary}*\n\n_Running in background._`,
      { parse_mode: "Markdown" }
    );

  // ── Suspicious Activity ───────────────────────────────────
  } else if (action === "admin_suspicious") {
    await ctx.answerCallbackQuery();
    try {
      const flags = db.getDb()
        .prepare("SELECT * FROM suspicious_activity WHERE cleared = 0 ORDER BY flagged_at DESC LIMIT 10")
        .all();
      if (!flags.length) return ctx.reply("✅ No suspicious activity.");
      const lines = flags.map((f) => `• User ${f.user_id} | ${f.reason} | ${f.flagged_at?.slice(0,10)}`);
      await ctx.reply(`🚩 *Suspicious Activity*\n\n${lines.join("\n")}`, { parse_mode: "Markdown" });
    } catch {
      await ctx.reply("Suspicious activity table not set up yet.");
    }

  // ── Admin Panel Refresh ───────────────────────────────────
  } else if (action === "admin_panel") {
    return showAdminPanel(ctx);

  } else {
    await ctx.answerCallbackQuery("Unknown admin action.");
  }
}

// ── Admin Text Input Handler ──────────────────────────────────
// Call this from router.js text handler when pending starts with admin_
async function handleAdminTextInput(ctx, pendingKey) {
  const text    = (ctx.message.text || ctx.message.caption || "").trim();
  const adminId = ctx.from.id;

  // ── Add tracked token ──
  if (pendingKey === "admin_track_add") {
    db.setSysConfig(`pending_${adminId}`, "");
    const parts = text.split("|").map(s => s.trim());
    const ca = parts[0];
    const label = parts[1] || "";
    if (!ca || ca.length < 32) { await ctx.reply("❌ Invalid CA."); return; }
    const r = db.addTrackedToken(ca, label, adminId);
    await ctx.reply(r.ok ? `✅ Now tracking *${label || ca.slice(0,10)}*\n\nAll trades of this token are being logged.` : `❌ ${r.reason}`, { parse_mode: "Markdown" });
    return;
  }

  // ── Cashback config inputs ──
  if (pendingKey === "admin_cb_pct") {
    db.setSysConfig(`pending_${adminId}`, "");
    const v = parseFloat(text);
    if (isNaN(v) || v < 0 || v > 100) { await ctx.reply("❌ Enter a % between 0 and 100."); return; }
    require("./cashback").setConfig({ pct: v });
    await ctx.reply(`✅ Cashback rate set to *${v}%*`, { parse_mode: "Markdown" });
    return;
  }
  if (pendingKey === "admin_cb_days") {
    db.setSysConfig(`pending_${adminId}`, "");
    const v = parseInt(text);
    if (isNaN(v) || v <= 0) { await ctx.reply("❌ Enter a whole number of days."); return; }
    require("./cashback").setConfig({ days: v });
    await ctx.reply(`✅ Window set to *${v} days*`, { parse_mode: "Markdown" });
    return;
  }
  if (pendingKey === "admin_cb_min") {
    db.setSysConfig(`pending_${adminId}`, "");
    const v = parseFloat(text);
    if (isNaN(v) || v < 0) { await ctx.reply("❌ Enter a valid SOL amount."); return; }
    require("./cashback").setConfig({ minFeeSol: v });
    await ctx.reply(`✅ Min fees to qualify: *${v} SOL*`, { parse_mode: "Markdown" });
    return;
  }
  if (pendingKey === "admin_cb_token") {
    db.setSysConfig(`pending_${adminId}`, "");
    const parts = text.trim().split(/\s+/);
    const mint = parts[0]; const label = (parts[1] || "TOKEN").toUpperCase();
    if (!mint || mint.length < 32) { await ctx.reply("❌ Invalid token mint."); return; }
    require("./cashback").setConfig({ tokenMint: mint, tokenLabel: label });
    await ctx.reply(`✅ Cashback token set: *${label}*\n\`${mint}\``, { parse_mode: "Markdown" });
    return;
  }

  // ── Reward amount → execute ──
  if (pendingKey === "admin_reward_amount") {
    db.setSysConfig(`pending_${adminId}`, "");
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) { await ctx.reply("❌ Invalid amount."); return; }
    const ca = db.getSysConfig(`admin_reward_ca_${adminId}`);
    const rtype = db.getSysConfig(`admin_reward_type_${adminId}`) || "SOL";
    const recipMode = db.getSysConfig(`admin_reward_recipients_${adminId}`) || "all";
    let traders = db.getTrackedTokenTraders(ca);
    if (recipMode === "top10") traders = traders.slice(0, 10);
    // Stable reason (no timestamp) so a retry after a partial failure skips already-paid users
    // instead of paying them twice. Same campaign = same reason = deduped by alreadyRewarded().
    const reason = `airdrop_${ca.slice(0,6)}_${recipMode}_${amount}`;
    const REAL_R = process.env.MOCK_TRADES === "false";

    // Concurrency guard: this loop can run for a while - a second tap would double-pay everyone.
    const _rLock = db.getSysConfig(`reward_lock_${adminId}`);
    if (_rLock && (Date.now() - parseInt(_rLock)) < 300000) {
      await ctx.reply("⏳ A reward batch is already running. Wait for it to finish.");
      return;
    }
    db.setSysConfig(`reward_lock_${adminId}`, String(Date.now()));

    try {
      // SPL token transfers need @solana/spl-token, which isn't installed. Refuse rather than
      // report success while sending nothing (the previous behaviour on mainnet).
      if (REAL_R && rtype === "TOKEN") {
        await ctx.reply("❌ Token rewards aren't wired yet (needs @solana/spl-token installed). SOL rewards work now.");
        return;
      }

      if (!REAL_R) {
        let simulated = 0;
        for (const t of traders) {
          if (db.alreadyRewarded(t.userId, reason)) continue;
          db.logReward(t.userId, ca, rtype, amount, reason, adminId, "");
          simulated++;
        }
        await ctx.reply(`✅ *Reward logged* [DEVNET]\n\n${simulated} traders × *${amount} ${rtype}*\n\n_Devnet — no real funds moved._`, { parse_mode: "Markdown" });
        return;
      }

      // ── REAL PAYOUT (mainnet) ──
      const treasuryKey = process.env.TREASURY_PRIVATE_KEY || "";
      if (!treasuryKey) { await ctx.reply("❌ TREASURY_PRIVATE_KEY not set — can't send."); return; }

      const { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } = require("@solana/web3.js");
      const bs58 = require("bs58");
      const connection = new Connection(process.env.HELIUS_RPC_URL || process.env.BACKUP_RPC_URL, "confirmed");
      const treasury = Keypair.fromSecretKey(bs58.decode(treasuryKey));

      // Build the recipient list first, then verify the treasury can cover the whole batch
      // before sending anything - avoids paying half the list and running dry.
      const queue = [];
      for (const t of traders) {
        if (db.alreadyRewarded(t.userId, reason)) continue;
        const ws = db.getWallets(t.userId) || [];
        const addr = db.getSysConfig(`payout_wallet_${t.userId}`) || (ws[0]?.public_key || "");
        if (!addr) continue;
        queue.push({ userId: t.userId, addr });
      }
      if (!queue.length) { await ctx.reply("❌ No eligible recipients (already paid, or no payout wallet)."); return; }

      const lamportsEach = Math.floor(amount * LAMPORTS_PER_SOL);
      const needed = (lamportsEach + 5000) * queue.length;
      const treasuryBal = await connection.getBalance(treasury.publicKey);
      if (treasuryBal < needed) {
        await ctx.reply(`❌ *Treasury too low.*\n\nNeed ~${(needed/LAMPORTS_PER_SOL).toFixed(4)} SOL for ${queue.length} recipients.\nHave ${(treasuryBal/LAMPORTS_PER_SOL).toFixed(4)} SOL.\n\n_Nothing sent._`, { parse_mode: "Markdown" });
        return;
      }

      const prog = await ctx.reply(`⏳ Sending ${amount} SOL to ${queue.length} recipients...`);
      let sent = 0, failed = 0;
      for (const q of queue) {
        try {
          const tx = new Transaction().add(SystemProgram.transfer({
            fromPubkey: treasury.publicKey, toPubkey: new PublicKey(q.addr), lamports: lamportsEach,
          }));
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
          tx.recentBlockhash = blockhash; tx.feePayer = treasury.publicKey; tx.sign(treasury);
          const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
          db.logReward(q.userId, ca, rtype, amount, reason, adminId, sig); // real tx hash, not ""
          sent++;
        } catch (e) {
          console.error("[Reward] failed for", q.userId, e.message);
          failed++;
        }
      }
      await ctx.api.editMessageText(ctx.chat.id, prog.message_id,
        `✅ *Rewards sent*\n\nPaid: *${sent}* × ${amount} SOL\n${failed ? `Failed: *${failed}* (retry to catch them)\n` : ""}Total: *${(amount*sent).toFixed(4)} SOL*`,
        { parse_mode: "Markdown" });
    } catch (e) {
      console.error("[Reward] batch error:", e.message);
      await ctx.reply("❌ Reward batch failed: " + String(e.message||"").slice(0,120));
    } finally {
      db.setSysConfig(`reward_lock_${adminId}`, "");
    }
    return;
  }

  if (pendingKey === "admin_add_promoter") {
    const targetId = parseInt(text);
    if (isNaN(targetId)) { await ctx.reply("❌ Invalid user ID. Enter numbers only."); return; }
    const targetUser = db.getUser(targetId);
    if (!targetUser) {
      await ctx.reply(`❌ User ${targetId} not found in database.`);
      db.setSysConfig(`pending_${adminId}`, "");
      return;
    }
    const count = db.getDb().prepare("SELECT COUNT(*) as cnt FROM users WHERE promoter_status = 1").get()?.cnt || 0;
    if (count >= 100) { await ctx.reply("❌ Max 100 promoter slots reached."); db.setSysConfig(`pending_${adminId}`, ""); return; }
    // Step 1 done → store target, ask for the custom rate
    db.setSysConfig(`promoter_target_${adminId}`, String(targetId));
    db.setSysConfig(`pending_${adminId}`, "admin_promoter_rate");
    await ctx.reply(`Set the L1 referral rate for *${targetUser.username || targetId}*.\n\nEnter a % (e.g. 35, 40, 50).\nStandard users get 30%.`, { parse_mode: "Markdown" });
    return;
  }

  if (pendingKey === "admin_promoter_rate") {
    const rate = parseFloat(text);
    if (isNaN(rate) || rate <= 0 || rate > 90) { await ctx.reply("❌ Enter a valid % between 1 and 90."); return; }
    const targetId = parseInt(db.getSysConfig(`promoter_target_${adminId}`) || "0");
    const targetUser = db.getUser(targetId);
    if (!targetUser) { await ctx.reply("❌ Target user lost, try again."); db.setSysConfig(`pending_${adminId}`, ""); return; }
    db.updateUser(targetId, { promoter_status: 1, promoter_rate: rate / 100 });
    db.setSysConfig(`pending_${adminId}`, "");
    db.setSysConfig(`promoter_target_${adminId}`, "");
    const code = db.ensureReferralCode(targetId);
    await ctx.reply(`✅ *${targetUser.username || targetId}* is now a Promoter at *${rate}%* L1.`, { parse_mode: "Markdown" });
    // Professional welcome DM
    try {
      await ctx.api.sendMessage(targetId,
        `🦅 *Welcome to the HawkX Partner Program*\n\nYou're now an official HawkX promoter.\n\n💰 Your rate: *${rate}%* lifetime rev-share on every trader you refer\n🔗 Your code: \`${code}\`\n📊 Track referrals & earnings in the Referrals menu anytime\n\nGlad to have you with us. Let's grow together.\n\n— The HawkX Team\n_Always Watching. Always First._`,
        { parse_mode: "Markdown" });
    } catch {}
    return;
  }

  if (pendingKey === "admin_remove_promoter") {
    const targetId = parseInt(text);
    if (isNaN(targetId)) {
      await ctx.reply("❌ Invalid user ID.");
      return;
    }
    const targetUser = db.getUser(targetId);
    if (!targetUser) {
      await ctx.reply(`❌ User ${targetId} not found.`);
      db.setSysConfig(`pending_${adminId}`, "");
      return;
    }
    db.updateUser(targetId, { promoter_status: 0 });
    db.setSysConfig(`pending_${adminId}`, "");
    await ctx.reply(
      `✅ *${targetUser.username || targetId}* Promoter status removed.\n\nThey now earn standard 30% on L1.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (pendingKey === "admin_broadcast") {
    const users = db.getAllUsers();
    let sent = 0, failed = 0;
    const msg = ctx.message;
    const fromChat = ctx.chat.id;
    const msgId = msg.message_id;
    const hasMedia = msg.photo || msg.video || msg.animation || msg.document;

    for (const u of users) {
      try {
        if (hasMedia) {
          // copyMessage sends photo/video/gif/doc WITH its caption to each user
          await ctx.api.copyMessage(u.user_id, fromChat, msgId);
        } else {
          try {
            await ctx.api.sendMessage(u.user_id, `📢 *HawkX Announcement*\n\n${text}`, { parse_mode: "Markdown" });
          } catch {
            await ctx.api.sendMessage(u.user_id, `📢 HawkX Announcement\n\n${text}`);
          }
        }
        sent++;
      } catch { failed++; }
    }
    db.setSysConfig(`pending_${adminId}`, "");
    await ctx.reply(`✅ Broadcast sent!\n\n${hasMedia ? "📎 Media + caption" : "📝 Text"}\n✅ Delivered: ${sent}\n❌ Failed: ${failed}`);
    return;
  }

  db.setSysConfig(`pending_${adminId}`, "");
}

module.exports = { showAdminPanel, handleAdminCallback, handleAdminTextInput, isAdmin };
