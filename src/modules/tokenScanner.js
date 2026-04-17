async function buildHawkXScan(ctx, tokenData, user, activeWallet) {
    const { t } = require("./i18n");
    const lang = user.language || "en";
    const db = require("../database");

    // 1. Get Wallet Info
    const address = activeWallet.public_key;
    const walletNum = activeWallet.wallet_id || 1; // Shows Wallet [1], [2], etc.
    const savedMock = db.getSysConfig(`mock_balance_${address}`);
    const balance = savedMock ? parseFloat(savedMock).toFixed(2) : "0.00";

    // 2. Format the Tactical Report
    let message = `🦅 **HAWK-X TARGET ACQUIRED**\n\n`;
    message += `💳 **Wallet [${walletNum}]:** \`${address.slice(0,4)}...${address.slice(-4)}\`\n`;
    message += `💰 **Balance:** \`${balance} SOL\`\n`;
    message += `───────────────────\n`;
    message += `💎 **Token:** ${tokenData.name} (${tokenData.symbol})\n`;
    message += `📈 **Price:** $${tokenData.price} | **MC:** $${tokenData.mcap}\n`;
    message += `💧 **Liq:** $${tokenData.liquidity} | **Tax:** ${tokenData.buyTax}/${tokenData.sellTax}\n`;
    message += `───────────────────\n`;
    message += `🛡 **SECURITY SCAN:**\n`;
    message += `• Mint: ${tokenData.mintDisabled ? '✅' : '❌'}\n`;
    message += `• Renounced: ${tokenData.renounced ? '✅' : '❌'}\n`;
    message += `• Risk Score: ${tokenData.riskScore}/10\n\n`;
    message += `👇 **SELECT SWOOP AMOUNT**`;

    // 3. Buttons (Unique HawkX Grid)
    const keyboard = {
        inline_keyboard: [
            [
                { text: "⚡️ INSTA-BUY 0.5 SOL", callback_data: `buy_0.5_${tokenData.ca}` }
            ],
            [
                { text: "0.1", callback_data: `buy_0.1_${tokenData.ca}` },
                { text: "0.2", callback_data: `buy_0.2_${tokenData.ca}` },
                { text: "1.0", callback_data: `buy_1.0_${tokenData.ca}` },
                { text: "✏️ Custom", callback_data: `buy_custom_${tokenData.ca}` }
            ],
            [
                { text: "📊 Chart", url: `https://dexscreener.com/solana/${tokenData.ca}` },
                { text: "🔄 Refresh", callback_data: `refresh_scan_${tokenData.ca}` }
            ],
            [
                { text: "⬅️ Back to Menu", callback_data: "home" }
            ]
        ]
    };

    return { message, keyboard };
}
