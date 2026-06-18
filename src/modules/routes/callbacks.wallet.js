const db = require("../../../database");
const { safeEdit, stripMd, deleteMsg } = require("./helpers.routes");
const { addWallet, deleteWallet, decryptWallet, isSolanaAddress } = require("../walletVault");
const { getActiveWallet, setActiveWallet, getBalance } = require("../walletSwitcher");
const { doExportKey } = require("../settings/index");
const { buildWalletMenu, buildWalletDeleteSelect, buildWalletExportSelect } = require("../keyboards");
const { simulatePriceMovement } = require("../executor");
const config = require("../../../config");

async function showWalletScreen(ctx, userId, activeWalletId, msg) {
    const freshUser = db.getUser(userId);
    const wallets = db.getWallets(userId) || [];
    const walletId = activeWalletId || freshUser.active_wallet_id;
    const active = db.getWallet(walletId);
    const address = active?.public_key || "No wallet";
    const balance = await getBalance(address);
    const label = active?.label || "Wallet";
    
    // P&L for active wallet
    const allPos = db.getOpenPositions(userId);
    const openPos = allPos.filter(p => p.wallet_id === walletId);
    let totalInv = 0, totalCur = 0;
    openPos.forEach(p => {
      const cp = simulatePriceMovement(p.token_ca);
      const pnlPct = p.buy_price > 0 ? ((cp - p.buy_price) / p.buy_price) * 100 : 0;
      totalInv += p.sol_invested;
      totalCur += p.sol_invested * (1 + pnlPct / 100);
    });
    const totalPnlSol = totalCur - totalInv;
    const totalPnlUsd = totalPnlSol * 150;
    const sign = totalPnlSol >= 0 ? "+" : "";
    const walletIdx = wallets.findIndex(w => w.wallet_id === walletId) + 1;
    const walletLimit = config.WALLET_LIMITS[freshUser.rank] || 5;

    const text = 
      `💼 *Wallet Management*

` +
      `Active: *W${walletIdx} — ${label}*
` +
      `💰 Balance: *${balance.toFixed(4)} SOL*
` +
      `📈 P&L: *${sign}${Math.min(Math.abs(totalPnlSol), 9999).toFixed(4)} SOL* / $${Math.min(Math.abs(totalPnlUsd), 99999).toFixed(2)}
` +
      `📋 Address:
\`${address}\`

` +
      `_${wallets.length}/${walletLimit} wallets_`;

    return safeEdit(ctx, text, buildWalletMenu(wallets, walletId));
  }



function getWalletBtn(w, num, isActive, cbData) {
  const lbl = (w.label && !w.label.match(/^W\d+$/)) ? ` ${w.label}` : "";
  const text = isActive ? `W${num}${lbl} ✅`.slice(0,20) : `W${num}${lbl}`.slice(0,20);
  return { text, callback_data: cbData };
}
async function handleWalletCallbacks(ctx, data, userId, user, bot, ks) {
    // ── WALLETS ───────────────────────────────────────────────
// ── Helper: build wallet screen ──────────────────────────────
  if (data === "menu_wallets") {
    await ctx.answerCallbackQuery();
    return showWalletScreen(ctx, userId, null);
  }

  if (data.startsWith("wallet_select_")) {
    const walletId = parseInt(data.replace("wallet_select_", ""));
    setActiveWallet(userId, walletId);
    await ctx.answerCallbackQuery("✅ Wallet switched!");
    return showWalletScreen(ctx, userId, walletId);
  }

  if (data === "wallet_copy_address") {
    await ctx.answerCallbackQuery();
    const freshUser = db.getUser(userId);
    const active = db.getWallet(freshUser.active_wallet_id);
    const address = active?.public_key || "No wallet";
    await ctx.reply(`📋 *Your Wallet Address:*
\`${address}\``, { parse_mode: "Markdown" });
    return true;
  }

  if (data === "wallet_rename") {
    await ctx.answerCallbackQuery();
    const freshUser = db.getUser(userId);
    const wallets = db.getWallets(userId) || [];
    const walletIdx = wallets.findIndex(w => w.wallet_id === freshUser.active_wallet_id) + 1;
    db.setSysConfig(`pending_${userId}`, "wallet_rename");
    const sent = await ctx.reply(`✏️ *Rename W${walletIdx}*

Enter new wallet name:`, { parse_mode: "Markdown" });
    db.setSysConfig(`pending_msg_${userId}`, String(sent.message_id));
    return true;
  }

  if (data === "wallet_delete_select") {
      await ctx.answerCallbackQuery();
      const wallets = db.getWallets(userId) || [];
      if (wallets.length <= 1) {
        await ctx.answerCallbackQuery("❌ Cannot delete only wallet.", {
          show_alert: true,
        });
        return;
      }
      const freshUser = db.getUser(userId);
      return safeEdit(
        ctx,
        "🗑 *Delete Wallet*\n\nSelect which wallet to delete:",
        buildWalletDeleteSelect(wallets, freshUser.active_wallet_id),
      );
    }

    if (data.startsWith("wallet_delete_confirm_")) {
      const walletId = parseInt(data.replace("wallet_delete_confirm_", ""));
      const wallet = db.getWallet(walletId);
      if (!wallet) {
        await ctx.answerCallbackQuery("Not found.");
        return;
      }
      await ctx.answerCallbackQuery();
      return ctx.reply(
        `🗑 *Confirm Delete*\n\n*${stripMd(wallet.label || "")}*\n\`${wallet.public_key.slice(0, 12)}...\`\n\n⚠️ Cannot be undone. Back up key first.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Delete",
                  callback_data: `wallet_delete_do_${walletId}`,
                },
                { text: "❌ Cancel", callback_data: "menu_wallets" },
              ],
            ],
          },
        },
      );
    }

    if (data.startsWith("wallet_delete_do_")) {
      const walletId = parseInt(data.replace("wallet_delete_do_", ""));
      const freshUser = db.getUser(userId);
      await deleteWallet(ctx, freshUser, walletId);
      await ctx.answerCallbackQuery("✅ Deleted.");
      const wallets = db.getWallets(userId) || [];
      const updated = db.getUser(userId);
      const active = db.getWallet(updated.active_wallet_id);
      const address = active?.public_key || "No wallet";
      const balance = await getBalance(address);
      const idx =
        wallets.findIndex((w) => w.wallet_id === updated.active_wallet_id) + 1;
      const allPos = db.getOpenPositions(userId);
      const openPos = allPos.filter(
        (p) => p.wallet_id === updated.active_wallet_id,
      );
      const { simulatePriceMovement } = require("../executor");
      let totalInv = 0,
        totalCur = 0;
      openPos.forEach((p) => {
        const cp = simulatePriceMovement(p.token_ca);
        const pnlPct =
          p.buy_price > 0 ? ((cp - p.buy_price) / p.buy_price) * 100 : 0;
        totalInv += p.sol_invested;
        totalCur += p.sol_invested * (1 + pnlPct / 100);
      });
      const pnlSol = totalCur - totalInv;
      const sign = pnlSol >= 0 ? "+" : "";
      const pnlLine =
        openPos.length > 0
          ? `\n📈 Positions P&L: *${sign}${pnlSol.toFixed(4)} SOL*`
          : `\n📈 Positions P&L: *0.0000 SOL*`;
      return safeEdit(
        ctx,
        `💼 *Wallet Management*\n\n` +
          `Active: *W${idx}*\n` +
          `📋 Address:\n\`${address}\`\n` +
          `💰 Balance: *${balance.toFixed(4)} SOL*` +
          pnlLine +
          `\n\n` +
          `_Tap wallet to switch. ${wallets.length}/${config.WALLET_LIMITS[updated.rank] || 5} wallets_`,
        buildWalletMenu(wallets, updated.active_wallet_id),
      );
    }

    if (data === "wallet_generate") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const limit = config.WALLET_LIMITS[freshUser.rank] || 5;
      const count = db.countWallets(userId);
      if (count >= limit) {
        return ctx.reply(
          `❌ Wallet limit reached (${limit}). Delete one first to add more.`,
        );
      }
      await addWallet(ctx, freshUser, "generate");
      const wallets = db.getWallets(userId) || [];
      const updated = db.getUser(userId);
      return safeEdit(
        ctx,
        `💼 *Wallet Management*`,
        buildWalletMenu(wallets, updated.active_wallet_id),
      );
    }

    if (data === "wallet_import") {
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        "📥 *Import Wallet*\n\nSend me your Solana wallet private key:",
        { parse_mode: "Markdown" },
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, "wallet_import_key");
      return;
    }

    if (data === "wallet_export_select") {
      await ctx.answerCallbackQuery();
      const wallets = db.getWallets(userId) || [];
      const freshUser = db.getUser(userId);
      const walletRows = [];
      for (let i = 0; i < wallets.length; i += 3) {
        walletRows.push(
          wallets.slice(i, i + 3).map((w, idx) => {
            const num = i + idx + 1;
            const isActive = w.wallet_id === freshUser.active_wallet_id;
            return {
              text: isActive ? `W${num} ${w.label||""} ✅`.slice(0,20) : `W${num} ${w.label||""}`.slice(0,20),
              callback_data: `wallet_export_prompt_${w.wallet_id}`,
            };
          }),
        );
      }
      const hasPIN = freshUser.sap_enabled && freshUser.sap_hash;
      return safeEdit(
        ctx,
        `🔑 *Export Private Key*\n\n` +
          `${hasPIN ? "🔐 PIN required to export." : "⚠️ No PIN set — we recommend setting a PIN before exporting."}\n\n` +
          `Select wallet to export:`,
        {
          inline_keyboard: [
            ...walletRows,
            hasPIN ? [] : [{ text: "🔐 Set PIN First", callback_data: "set_sap" }],
            [{ text: "← Back", callback_data: "menu_wallets" }],
          ].filter(r => r.length > 0),
        },
      );
    }

    if (data.startsWith("wallet_export_prompt_")) {
      const walletId = parseInt(data.replace("wallet_export_prompt_", ""));
      const freshUser = db.getUser(userId);
      await ctx.answerCallbackQuery();
      if (freshUser.sap_enabled && freshUser.sap_hash) {
        db.setSysConfig(`sap_next_wallet_${userId}`, String(walletId));
        const msg = await ctx.reply(
          "🔐 Enter your Security PIN to export key:",
        );
        db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
        db.setSysConfig(`pending_${userId}`, "sap_verify_export");
      } else {
        // No PIN — show export anyway option
        const wallets = db.getWallets(userId) || [];
        const num = wallets.findIndex((w) => w.wallet_id === walletId) + 1;
        return safeEdit(
          ctx,
          `🔑 *Export W${num} Private Key*\n\n` +
            `⚠️ *No Security PIN set.*\n\n` +
            `For your safety, set a PIN before exporting. Anyone with your private key can access your funds.\n\n` +
            `Tap Export Anyway to show key for 20 seconds.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔐 Set PIN First", callback_data: "set_sap" }],
                [
                  {
                    text: "⚠️ Export Anyway",
                    callback_data: `wallet_export_do_${walletId}`,
                  },
                ],
                [{ text: "← Cancel", callback_data: "wallet_export_select" }],
              ],
            },
          },
        );
      }
      return;
    }

    if (data.startsWith("wallet_export_do_")) {
      const walletId = parseInt(data.replace("wallet_export_do_", ""));
      await ctx.answerCallbackQuery();
      await doExportKey(ctx, userId, walletId);
      return;
    }

    // ── DEPOSIT ───────────────────────────────────────────────
    if (data === "wallet_deposit") {
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const wallets = db.getWallets(userId) || [];
      const activeWallet = db.getWallet(freshUser.active_wallet_id);
      const activeAddr = activeWallet?.public_key || "No wallet";
      const activeBal = await getBalance(activeAddr);
      const activeIdx =
        wallets.findIndex((w) => w.wallet_id === freshUser.active_wallet_id) +
        1;
      const walletRows = [];
      for (let i = 0; i < wallets.length; i += 3) {
        walletRows.push(wallets.slice(i, i + 3).map((w, idx) => getWalletBtn(w, i+idx+1, w.wallet_id===freshUser.active_wallet_id, `deposit_select_${w.wallet_id}`)));
      }
      const depMsg =
        `💰 *Deposit*\n\n` +
        `Active: *W${activeIdx}* ✅\n` +
        `📋 Address:\n\`${activeAddr}\`\n\n` +
        `💰 Balance: *${activeBal.toFixed(4)} SOL*\n\n` +
        `_Select the deposit wallet._`;
      try {
        await ctx.editMessageText(depMsg, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              ...walletRows,
              [
                { text: "← Back", callback_data: "menu_wallets" },
                { text: "🔄 Refresh", callback_data: "wallet_deposit" },
              ],
            ],
          },
        });
      } catch {
        await ctx.reply(depMsg, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              ...walletRows,
              [
                { text: "← Back", callback_data: "menu_wallets" },
                { text: "🔄 Refresh", callback_data: "wallet_deposit" },
              ],
            ],
          },
        });
      }
      return;
    }

    if (data.startsWith("deposit_select_")) {
      const walletId = parseInt(data.replace("deposit_select_", ""));
      const wallet = db.getWallet(walletId);
      if (!wallet) {
        await ctx.answerCallbackQuery("Not found.");
        return;
      }
      const balance = await getBalance(wallet.public_key);
      const wallets = db.getWallets(userId) || [];
      const num = wallets.findIndex((w) => w.wallet_id === walletId) + 1;
      await ctx.answerCallbackQuery(`W${num} selected`);
      const walletRows = [];
      for (let i = 0; i < wallets.length; i += 3) {
        walletRows.push(
          wallets.slice(i, i + 3).map((w, idx) => {
            const n2 = i + idx + 1;
            const isActive = w.wallet_id === walletId;
            return {
              text: isActive ? `W${n2} ✅` : `W${n2}`,
              callback_data: `deposit_select_${w.wallet_id}`,
            };
          }),
        );
      }
      const depMsg =
        `💰 *Deposit*\n\n` +
        `Active: *W${num}* ✅\n` +
        `📋 Address:\n\`${wallet.public_key}\`\n\n` +
        `💰 Balance: *${balance.toFixed(4)} SOL*\n\n` +
        `_Tap address to copy. Select a different wallet above if needed._`;
      try {
        await ctx.editMessageText(depMsg, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              ...walletRows,
              [
                { text: "← Back", callback_data: "menu_wallets" },
                { text: "🔄 Refresh", callback_data: "wallet_deposit" },
              ],
            ],
          },
        });
      } catch {
        await ctx.reply(depMsg, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              ...walletRows,
              [
                { text: "← Back", callback_data: "menu_wallets" },
                {
                  text: "🔄 Refresh",
                  callback_data: `deposit_select_${walletId}`,
                },
              ],
            ],
          },
        });
      }
      return;
    }

    if (data.startsWith("deposit_show_")) {
      // Legacy — redirect to new deposit
      await ctx.answerCallbackQuery();
      return;
    }

    // ── WITHDRAW ──────────────────────────────────────────────
    if (data === "wallet_withdraw") {
      await ctx.answerCallbackQuery();
      const wallets = db.getWallets(userId) || [];
      const freshUser = db.getUser(userId);
      const walletRows = [];
      for (let i = 0; i < wallets.length; i += 3) {
        walletRows.push(wallets.slice(i, i + 3).map((w, idx) => getWalletBtn(w, i+idx+1, w.wallet_id===freshUser.active_wallet_id, `withdraw_from_${w.wallet_id}`)));
      }
      try {
        await ctx.editMessageText(
          `💸 *Withdraw*\n\nSelect the wallet you want to withdraw from:`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                ...walletRows,
                [
                  { text: "← Back", callback_data: "menu_wallets" },
                  { text: "🔄 Refresh", callback_data: "wallet_withdraw" },
                ],
              ],
            },
          },
        );
      } catch {
        await ctx.reply(
          `💸 *Withdraw*\n\nSelect the wallet you want to withdraw from:`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                ...walletRows,
                [
                  { text: "← Back", callback_data: "menu_wallets" },
                  { text: "🔄 Refresh", callback_data: "wallet_withdraw" },
                ],
              ],
            },
          },
        );
      }
      return;
    }

    if (data.startsWith("withdraw_from_")) {
      const walletId = parseInt(data.replace("withdraw_from_", ""));
      const wallet = db.getWallet(walletId);
      if (!wallet) {
        await ctx.answerCallbackQuery("Not found.");
        return;
      }
      const balance = await getBalance(wallet.public_key);
      const wallets = db.getWallets(userId) || [];
      const num = wallets.findIndex((w) => w.wallet_id === walletId) + 1;
      await ctx.answerCallbackQuery(`W${num} selected`);

      // Fetch SPL tokens from Helius
      let splTokens = [];
      try {
        const axios = require("axios");
        const config = require("../../../config");
        if (config.HELIUS_API_KEY) {
          const res = await axios.post(
            `https://mainnet.helius-rpc.com/?api-key=${config.HELIUS_API_KEY}`,
            {
              jsonrpc: "2.0",
              id: 1,
              method: "getTokenAccountsByOwner",
              params: [
                wallet.public_key,
                { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
                { encoding: "jsonParsed" },
              ],
            },
            { timeout: 5000 },
          );
          const accounts = res.data?.result?.value || [];
          splTokens = accounts
            .map((a) => ({
              mint: a.account.data.parsed.info.mint,
              amount: a.account.data.parsed.info.tokenAmount.uiAmount || 0,
              symbol: a.account.data.parsed.info.mint.slice(0, 6),
            }))
            .filter((t) => t.amount > 0);
        }
      } catch {}

      // Build token buttons
      const tokenButtons = [
        [
          {
            text: `💎 SOL (${balance.toFixed(4)})`,
            callback_data: `withdraw_token_SOL_${walletId}`,
          },
        ],
        ...splTokens.map((t) => [
          {
            text: `🪙 ${t.symbol} (${t.amount.toFixed(4)})`,
            callback_data: `withdraw_token_${t.mint}_${walletId}`,
          },
        ]),
        [{ text: "← Back", callback_data: "wallet_withdraw" }],
      ];

      const withdrawMsg =
        `💸 *Withdraw from W${num}*\n\n` +
        `📋 \`${wallet.public_key}\`\n` +
        `💰 SOL Balance: *${balance.toFixed(4)} SOL*\n\n` +
        `Select token to withdraw:` +
        (splTokens.length === 0
          ? `\n\n_No other tokens found in this wallet._`
          : "");

      try {
        await ctx.editMessageText(withdrawMsg, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: tokenButtons },
        });
      } catch {
        await ctx.reply(withdrawMsg, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: tokenButtons },
        });
      }
      return;
    }

    if (data.startsWith("withdraw_token_")) {
      // Format: withdraw_token_MINTADDRESS_WALLETID
      const withoutPrefix = data.replace("withdraw_token_", "");
      const lastUnderscore = withoutPrefix.lastIndexOf("_");
      const token = withoutPrefix.slice(0, lastUnderscore);
      const walletId = parseInt(withoutPrefix.slice(lastUnderscore + 1));
      await ctx.answerCallbackQuery();
      // Ask for destination address FIRST (PIN comes at final confirm)
      const msg = await ctx.reply(
        `💸 *Withdraw ${token}*\n\nPaste your destination Solana address:`,
        { parse_mode: "Markdown" }
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(`pending_${userId}`, `withdraw_address_${token}_${walletId}`);
      return;
    }

    if (data.startsWith("withdraw_nopinsend_")) {
      const parts = data.split("_");
      const withoutPrefix2 = data.replace("withdraw_nopinsend_", "");
      const lastIdx2 = withoutPrefix2.lastIndexOf("_");
      const token = withoutPrefix2.slice(0, lastIdx2);
      const walletId = parseInt(withoutPrefix2.slice(lastIdx2 + 1));
      await ctx.answerCallbackQuery();
      const msg = await ctx.reply(
        `💸 *Withdraw ${token}*\n\nPaste destination Solana address:\n\n⚠️ Cannot be reversed.`,
        { parse_mode: "Markdown" },
      );
      db.setSysConfig(`prompt_msg_${userId}`, String(msg.message_id));
      db.setSysConfig(
        `pending_${userId}`,
        `withdraw_address_${token}_${walletId}`,
      );
      return;
    }

    if (data.startsWith("withdraw_custom_")) {
      const rest = data.replace("withdraw_custom_", "");
      const li = rest.lastIndexOf("_");
      const token = rest.slice(0, li);
      const walletId = parseInt(rest.slice(li + 1));
      await ctx.answerCallbackQuery();
      const m = await ctx.reply(`✏️ *Custom Amount*\n\nEnter the amount of ${token} to withdraw (e.g. 0.5):`, { parse_mode: "Markdown" });
      db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
      db.setSysConfig(`pending_${userId}`, `withdraw_customamt_${token}_${walletId}`);
      return;
    }

    if (data.startsWith("withdraw_send_")) {
      const parts = data.split("_");
      const pct = parseInt(parts[2]);
      const token = parts[3];
      const walletId = parseInt(parts[4]);
      await ctx.answerCallbackQuery();
      const freshUser = db.getUser(userId);
      const hasPIN = freshUser.sap_enabled && freshUser.sap_hash;
      const addr = db.getSysConfig(`withdraw_addr_${userId}`) || "";
      db.setSysConfig(`withdraw_pending_${userId}`, `${pct}_${token}_${walletId}`);
      if (hasPIN) {
        const m = await ctx.reply(
          `💸 *Confirm Withdraw* [DEVNET]\n\nSending *${pct}%* of ${token}\nTo:\n\`${addr}\`\n\n⚠️ Verify the address before confirming.\n\n🔐 Enter your Security PIN to confirm:`,
          { parse_mode: "Markdown" }
        );
        db.setSysConfig(`prompt_msg_${userId}`, String(m.message_id));
        db.setSysConfig(`pending_${userId}`, "withdraw_confirm_pin");
      } else {
        return safeEdit(ctx,
          `💸 *Confirm Withdraw* [DEVNET]\n\nSending *${pct}%* of ${token}\nTo:\n\`${addr}\`\n\n⚠️ Verify the address before confirming.\n\n⚠️ No Security PIN set.`,
          { inline_keyboard: [
            [{ text: "✅ Confirm Withdraw", callback_data: `withdraw_finalsend_${pct}_${token}_${walletId}` }],
            [{ text: "🔐 Set PIN First", callback_data: "set_sap" }],
            [{ text: "← Cancel", callback_data: "wallet_withdraw" }],
          ]}
        );
      }
      return;
    }

    if (data.startsWith("withdraw_finalsend_")) {
      const parts = data.split("_");
      const raw = parts[2];
      const token = parts[3];
      // Handle both "2SOL" (custom) and "50" (percent)
      const amtLabel = String(raw).endsWith("SOL") ? String(raw).replace("SOL", " SOL") : raw + "%";
      await ctx.answerCallbackQuery(`Sending ${amtLabel} ${token}...`);
      // Clear withdraw session
      db.setSysConfig(`withdraw_pending_${userId}`, "");
      db.setSysConfig(`withdraw_addr_${userId}`, "");
      await ctx.reply(
        `✅ *Withdraw Sent* [DEVNET]\n\nSent *${amtLabel}* of ${token}.\n\n_Devnet simulation — no real funds moved._`,
        { parse_mode: "Markdown" }
      );
      return;
    }


    return false;
}

module.exports = { handleWalletCallbacks, showWalletScreen };
