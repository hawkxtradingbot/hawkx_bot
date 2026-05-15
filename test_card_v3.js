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
    heldTime = '2h 15m',
  } = opts;

  const W = 1000, H = 520;
  const isProfit = pnlSol >= 0;
  const sign = isProfit ? '+' : '';
  const arrow = isProfit ? 'v' : 'v';
  const pnlColor = isProfit ? '#14F195' : '#FF4444';
  const bgTint = isProfit ? 'rgba(20,241,149,0.05)' : 'rgba(255,68,68,0.05)';
  const multiplier = (returned / invested).toFixed(1);

  const memeMap = [
    [500, "LEGENDARY. ABSOLUTE HAWK"],
    [200, "WE ARE SO BACK"],
    [100, "WAGMI BRO"],
    [50,  "Nice trade, hawk!"],
    [20,  "Steady grinding"],
    [5,   "Small wins add up"],
    [0,   "Green is green"],
    [-10, "It is fine..."],
    [-30, "We take those losses"],
    [-50, "NGMI... or are we?"],
    [-80, "Absolute rekt"],
    [-999,"This is fine..."],
  ];

  let memeText = "It is fine...";
  for (const [threshold, text] of memeMap) {
    if (pnlPct >= threshold) { memeText = text; break; }
  }

  const rankColors = ['','#aaaaaa','#00ccff','#00ff88','#ff9900','#cc44ff','#ff4444','#FFD700'];
  const rankColor = rankColors[rankNum] || '#F5A623';

  const formatMcap = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}K`;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1c0e00"/>
      <stop offset="45%" style="stop-color:#080c12"/>
      <stop offset="100%" style="stop-color:#1c0e00"/>
    </linearGradient>
    <linearGradient id="ogGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#F5A623"/>
      <stop offset="100%" style="stop-color:#E8720C"/>
    </linearGradient>
    <linearGradient id="pnlGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${pnlColor}"/>
      <stop offset="100%" style="stop-color:${isProfit ? '#00cc77' : '#cc2222'}"/>
    </linearGradient>
  </defs>

  <!-- BG -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="${bgTint}"/>

  <!-- Subtle diagonal lines pattern -->
  <line x1="-100" y1="0" x2="300" y2="${H}" stroke="rgba(245,166,35,0.03)" stroke-width="40"/>
  <line x1="100" y1="0" x2="500" y2="${H}" stroke="rgba(245,166,35,0.03)" stroke-width="40"/>
  <line x1="300" y1="0" x2="700" y2="${H}" stroke="rgba(245,166,35,0.03)" stroke-width="40"/>
  <line x1="500" y1="0" x2="900" y2="${H}" stroke="rgba(245,166,35,0.03)" stroke-width="40"/>
  <line x1="700" y1="0" x2="1100" y2="${H}" stroke="rgba(245,166,35,0.03)" stroke-width="40"/>

  <!-- Top/bottom strips -->
  <rect width="${W}" height="52" fill="url(#ogGrad)" opacity="0.1"/>
  <rect y="${H-48}" width="${W}" height="48" fill="url(#ogGrad)" opacity="0.1"/>

  <!-- Borders -->
  <rect width="${W}" height="5" fill="url(#ogGrad)"/>
  <rect y="${H-5}" width="${W}" height="5" fill="url(#ogGrad)"/>
  <rect width="4" height="${H}" fill="url(#ogGrad)"/>
  <rect x="${W-4}" width="4" height="${H}" fill="url(#ogGrad)"/>

  <!-- Header -->
  <text x="40" y="47" font-family="Arial Black" font-size="28" fill="#F5A623" letter-spacing="6">H A W K X</text>
  <text x="${W-40}" y="30" font-family="Arial" font-size="15" fill="rgba(255,255,255,0.8)" text-anchor="end">@${username}</text>
  <text x="${W-40}" y="52" font-family="Arial Black" font-size="17" fill="${rankColor}" text-anchor="end">${rankName.toUpperCase()} (${rankNum}/7)</text>
  <line x1="40" y1="68" x2="${W-40}" y2="68" stroke="url(#ogGrad)" stroke-width="1" opacity="0.4"/>

  <!-- Trade label -->
  <text x="40" y="102" font-family="Arial" font-size="12" fill="#E8720C" letter-spacing="4">TRADE CLOSED  |  HELD: ${heldTime}</text>

  <!-- Token name BIG + multiplier -->
  <text x="40" y="158" font-family="Arial Black" font-size="62" fill="white">${tokenName}</text>
  <text x="${W-40}" y="155" font-family="Arial Black" font-size="48" fill="${pnlColor}" text-anchor="end">${multiplier}x</text>

  <!-- PnL big -->
  <text x="40" y="258" font-family="Arial Black" font-size="76" fill="url(#pnlGrad)">${isProfit ? '&#9650;' : '&#9660;'} ${sign}${Math.abs(pnlSol).toFixed(3)} SOL</text>

  <!-- % and USD -->
  <text x="42" y="298" font-family="Arial Black" font-size="28" fill="${pnlColor}">${sign}${Math.abs(pnlPct).toFixed(1)}%</text>
  <text x="230" y="298" font-family="Arial" font-size="23" fill="#F5A623">${sign}$${Math.abs(pnlUsd).toFixed(2)}</text>

  <!-- Meme text -->
  <text x="42" y="332" font-family="Arial Black" font-size="18" fill="rgba(255,255,255,0.75)">${memeText}</text>

  <!-- Divider -->
  <line x1="40" y1="348" x2="${W-40}" y2="348" stroke="url(#ogGrad)" stroke-width="1" opacity="0.25"/>

  <!-- Stats -->
  <text x="40" y="376" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">ENTRY</text>
  <text x="40" y="406" font-family="Arial Black" font-size="30" fill="white">${formatMcap(entryMcap)}</text>

  <text x="175" y="376" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">EXIT</text>
  <text x="175" y="406" font-family="Arial Black" font-size="30" fill="white">${formatMcap(exitMcap)}</text>

  <text x="340" y="376" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">INVESTED</text>
  <text x="340" y="406" font-family="Arial Black" font-size="30" fill="white">${invested} SOL</text>

  <text x="540" y="376" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">RETURNED</text>
  <text x="540" y="406" font-family="Arial Black" font-size="30" fill="${pnlColor}">${returned} SOL</text>

  <!-- Rank benefit bar -->
  <line x1="40" y1="422" x2="${W-40}" y2="422" stroke="url(#ogGrad)" stroke-width="1" opacity="0.2"/>
  <rect x="40" y="430" width="${W-80}" height="42" rx="6" fill="rgba(245,166,35,0.07)"/>
  <rect x="40" y="430" width="4" height="42" rx="2" fill="${rankColor}"/>
  <text x="58" y="447" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="2">RANK BENEFIT</text>
  <text x="58" y="465" font-family="Arial Black" font-size="16" fill="${rankColor}">${rankName.toUpperCase()} RANK  |  ${feeRate}% FEE  |  SAVED $${feeSaved.toFixed(2)} TODAY</text>

  <!-- Bottom -->
  <line x1="40" y1="480" x2="${W-40}" y2="480" stroke="url(#ogGrad)" stroke-width="1" opacity="0.15"/>
  <text x="40" y="508" font-family="Arial" font-style="italic" font-size="13" fill="rgba(255,255,255,0.3)">Always Watching. Always First.</text>
  <text x="${W-40}" y="508" font-family="Arial" font-size="13" fill="#F5A623" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

  const p = await makeCard({
    username: 'Fazle', rankName: 'Degen', rankNum: 1,
    tokenName: 'BONK', pnlSol: 2.450, pnlPct: 245,
    pnlUsd: 367.50, entryMcap: 50000, exitMcap: 245000,
    invested: 0.10, returned: 2.55, feeSaved: 12.50,
    feeRate: 1.00, heldTime: '2h 15m',
  });
  await bot.api.sendPhoto(config.ADMIN_IDS[0], new InputFile(p, 'profit.png'), { caption: 'Profit' });
  await new Promise(r => setTimeout(r, 800));

  const l = await makeCard({
    username: 'Fazle', rankName: 'Degen', rankNum: 1,
    tokenName: 'PEPE', pnlSol: -0.850, pnlPct: -45,
    pnlUsd: -127.50, entryMcap: 200000, exitMcap: 110000,
    invested: 0.50, returned: 0.275, feeSaved: 5.20,
    feeRate: 1.00, heldTime: '45m',
  });
  await bot.api.sendPhoto(config.ADMIN_IDS[0], new InputFile(l, 'loss.png'), { caption: 'Loss' });

  console.log('Both sent!');
  process.exit(0);
}

main().catch(e => { console.log('Error:', e.message); process.exit(1); });
