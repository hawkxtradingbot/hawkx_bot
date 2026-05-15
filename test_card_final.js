const sharp = require('sharp');
const { Bot } = require('grammy');
const { InputFile } = require('grammy');
const config = require('./config');

async function makeCard(opts) {
  const {
    username = 'Fazle',
    rankName = 'Degen',
    rankNum = 1,
    tokenName = 'BONK',
    pnlSol = 2.450,
    pnlPct = 245,
    pnlUsd = 367.50,
    entryMcap = 50000,
    exitMcap = 245000,
    invested = 0.10,
    returned = 2.55,
    feeSaved = 12.50,
    feeRate = 1.00,
  } = opts;

  const W = 1000, H = 560;
  const isProfit = pnlSol >= 0;
  const sign = isProfit ? '+' : '';
  const arrow = isProfit ? '▲' : '▼';
  const pnlColor = isProfit ? '#14F195' : '#FF4444';
  const bgTint = isProfit ? 'rgba(20,241,149,0.06)' : 'rgba(255,68,68,0.06)';
  const glowTint = isProfit ? 'rgba(20,241,149,0.12)' : 'rgba(255,68,68,0.12)';

  const memeTexts = {
    profit: [
      [500, "LEGENDARY HAWK 👑🦅"],
      [200, "WE ARE SO BACK 🚀🚀🚀"],
      [100, "WAGMI BRO 💎🙌"],
      [50,  "Nice trade, hawk! 🦅"],
      [20,  "Steady grinding 💪"],
      [5,   "Small wins add up 🎯"],
      [0,   "Green is green 🟢"],
    ],
    loss: [
      [-80, "This is fine... 🔥🔥🔥"],
      [-50, "Absolute rekt 😭💀"],
      [-30, "NGMI... or are we? 💀"],
      [-10, "We take those losses 😬"],
      [0,   "It's fine... 😅"],
    ]
  };

  let memeText = "It's fine... 😅";
  if (isProfit) {
    for (const [threshold, text] of memeTexts.profit) {
      if (pnlPct >= threshold) { memeText = text; break; }
    }
  } else {
    for (const [threshold, text] of memeTexts.loss) {
      if (pnlPct <= threshold) { memeText = text; break; }
    }
  }

  const rankColors = ['','#aaaaaa','#00ccff','#00ff88','#ff9900','#ff00ff','#ff4444','#FFD700'];
  const rankColor = rankColors[rankNum] || '#F5A623';
  
  const formatMcap = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}K`;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0d00"/>
      <stop offset="50%" style="stop-color:#0a0d14"/>
      <stop offset="100%" style="stop-color:#1a0d00"/>
    </linearGradient>
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#F5A623"/>
      <stop offset="100%" style="stop-color:#E8720C"/>
    </linearGradient>
    <linearGradient id="pnlGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${pnlColor}"/>
      <stop offset="100%" style="stop-color:${isProfit ? '#00cc77' : '#cc0000'}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  
  <!-- PnL color tint -->
  <rect width="${W}" height="${H}" fill="${bgTint}"/>
  
  <!-- Glow circles -->
  <circle cx="800" cy="120" r="180" fill="${glowTint}"/>
  <circle cx="100" cy="480" r="100" fill="${glowTint}"/>

  <!-- Subtle grid -->
  <line x1="0" y1="200" x2="${W}" y2="200" stroke="rgba(245,166,35,0.04)" stroke-width="1"/>
  <line x1="0" y1="400" x2="${W}" y2="400" stroke="rgba(245,166,35,0.04)" stroke-width="1"/>
  <line x1="333" y1="0" x2="333" y2="${H}" stroke="rgba(245,166,35,0.04)" stroke-width="1"/>
  <line x1="666" y1="0" x2="666" y2="${H}" stroke="rgba(245,166,35,0.04)" stroke-width="1"/>

  <!-- Diagonal lines -->
  <line x1="550" y1="0" x2="${W}" y2="280" stroke="rgba(245,166,35,0.04)" stroke-width="1"/>
  <line x1="650" y1="0" x2="${W}" y2="180" stroke="rgba(245,166,35,0.04)" stroke-width="1"/>

  <!-- Top/bottom gradient strips -->
  <rect width="${W}" height="55" fill="url(#orangeGrad)" opacity="0.1"/>
  <rect y="505" width="${W}" height="55" fill="url(#orangeGrad)" opacity="0.1"/>

  <!-- Borders -->
  <rect width="${W}" height="5" fill="url(#orangeGrad)"/>
  <rect y="555" width="${W}" height="5" fill="url(#orangeGrad)"/>
  <rect width="4" height="${H}" fill="url(#orangeGrad)"/>
  <rect x="996" width="4" height="${H}" fill="url(#orangeGrad)"/>

  <!-- Header -->
  <text x="40" y="50" font-family="Arial Black" font-size="28" fill="#F5A623" letter-spacing="6">H A W K X</text>
  <text x="960" y="34" font-family="Arial" font-size="15" fill="rgba(255,255,255,0.85)" text-anchor="end">@${username}</text>
  <text x="960" y="58" font-family="Arial Black" font-size="17" fill="${rankColor}" text-anchor="end">${rankName.toUpperCase()} (${rankNum}/7)</text>
  <line x1="40" y1="74" x2="960" y2="74" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.4"/>

  <!-- Trade label + Token -->
  <text x="40" y="112" font-family="Arial" font-size="12" fill="#E8720C" letter-spacing="4">TRADE CLOSED</text>
  <text x="40" y="162" font-family="Arial Black" font-size="50" fill="white">${tokenName}</text>

  <!-- Big PnL -->
  <text x="40" y="265" font-family="Arial Black" font-size="78" fill="url(#pnlGrad)">${arrow} ${sign}${Math.abs(pnlSol).toFixed(3)} SOL</text>
  <text x="42" y="308" font-family="Arial Black" font-size="28" fill="${pnlColor}">${sign}${Math.abs(pnlPct).toFixed(1)}%</text>
  <text x="235" y="308" font-family="Arial" font-size="22" fill="#F5A623">${sign}$${Math.abs(pnlUsd).toFixed(2)}</text>

  <!-- Meme text -->
  <text x="42" y="344" font-family="Arial Black" font-size="18" fill="rgba(255,255,255,0.8)">${memeText}</text>

  <line x1="40" y1="362" x2="960" y2="362" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.2"/>

  <!-- Stats row -->
  <text x="40" y="392" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">ENTRY</text>
  <text x="40" y="424" font-family="Arial Black" font-size="30" fill="white">${formatMcap(entryMcap)}</text>

  <text x="175" y="392" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">EXIT</text>
  <text x="175" y="424" font-family="Arial Black" font-size="30" fill="white">${formatMcap(exitMcap)}</text>

  <text x="340" y="392" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">INVESTED</text>
  <text x="340" y="424" font-family="Arial Black" font-size="30" fill="white">${invested} SOL</text>

  <text x="540" y="392" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">RETURNED</text>
  <text x="540" y="424" font-family="Arial Black" font-size="30" fill="${pnlColor}">${returned} SOL</text>

  <!-- Fee saved section -->
  <line x1="40" y1="445" x2="960" y2="445" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.2"/>
  
  <!-- Rank achievement -->
  <rect x="40" y="455" width="440" height="52" rx="6" fill="rgba(245,166,35,0.08)"/>
  <text x="55" y="476" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="2">RANK BENEFIT</text>
  <text x="55" y="498" font-family="Arial Black" font-size="18" fill="${rankColor}">🏅 ${rankName} — ${feeRate}% FEE · SAVED $${feeSaved.toFixed(2)} TODAY</text>

  <!-- QR code area -->
  <rect x="840" y="455" width="110" height="52" rx="6" fill="rgba(245,166,35,0.08)"/>
  <text x="895" y="476" font-family="Arial" font-size="10" fill="#E8720C" letter-spacing="1" text-anchor="middle">JOIN HAWKX</text>
  <text x="895" y="496" font-family="Arial Black" font-size="11" fill="#F5A623" text-anchor="middle">@HawkX_Trade_Bot</text>

  <!-- Bottom -->
  <line x1="40" y1="515" x2="960" y2="515" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.15"/>
  <text x="40" y="542" font-family="Arial" font-style="italic" font-size="13" fill="rgba(255,255,255,0.35)">Always Watching. Always First. 🦅</text>
  <text x="960" y="542" font-family="Arial" font-size="13" fill="#F5A623" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return buf;
}

async function main() {
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
  
  // Test profit card
  const profitBuf = await makeCard({
    username: 'Fazle', rankName: 'Degen', rankNum: 1,
    tokenName: 'BONK', pnlSol: 2.450, pnlPct: 245,
    pnlUsd: 367.50, entryMcap: 50000, exitMcap: 245000,
    invested: 0.10, returned: 2.55, feeSaved: 12.50, feeRate: 1.00,
  });
  await bot.api.sendPhoto(config.ADMIN_IDS[0], new InputFile(profitBuf, 'profit_card.png'), { caption: '✅ Profit Card' });
  await new Promise(r => setTimeout(r, 800));

  // Test loss card
  const lossBuf = await makeCard({
    username: 'Fazle', rankName: 'Degen', rankNum: 1,
    tokenName: 'PEPE', pnlSol: -0.850, pnlPct: -45,
    pnlUsd: -127.50, entryMcap: 200000, exitMcap: 110000,
    invested: 0.50, returned: 0.275, feeSaved: 5.20, feeRate: 1.00,
  });
  await bot.api.sendPhoto(config.ADMIN_IDS[0], new InputFile(lossBuf, 'loss_card.png'), { caption: '❌ Loss Card' });

  console.log('Both sent!');
  process.exit(0);
}

main().catch(e => { console.log('Error:', e.message); process.exit(1); });
