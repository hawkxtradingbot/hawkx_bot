const sharp = require('sharp');
const { Bot } = require('grammy');
const { InputFile } = require('grammy');
const config = require('./config');

function generateChartSVG(W, H, isProfit, entryMcap, exitMcap) {
  // Generate realistic price path
  const chartX = 0;
  const chartY = 0;
  const chartW = W;
  const chartH = H;
  
  // Generate price points
  const points = 40;
  const prices = [];
  let price = isProfit ? 30 : 70; // start low for profit, high for loss
  
  for (let i = 0; i < points; i++) {
    const progress = i / points;
    const trend = isProfit ? progress * 60 : -progress * 50;
    const noise = (Math.sin(i * 2.5) * 8) + (Math.cos(i * 1.3) * 5);
    price = Math.max(5, Math.min(95, (isProfit ? 30 : 70) + trend + noise));
    prices.push(price);
  }

  // Entry at ~30% of chart, exit at ~80%
  const entryIdx = Math.floor(points * 0.28);
  const exitIdx = Math.floor(points * 0.78);

  // Convert to SVG coordinates
  const toX = (i) => chartX + (i / (points - 1)) * chartW;
  const toY = (p) => chartY + chartH - (p / 100) * chartH;

  // Build path
  let pathD = `M ${toX(0)} ${toY(prices[0])}`;
  for (let i = 1; i < points; i++) {
    const cpx = (toX(i - 1) + toX(i)) / 2;
    pathD += ` C ${cpx} ${toY(prices[i-1])}, ${cpx} ${toY(prices[i])}, ${toX(i)} ${toY(prices[i])}`;
  }

  // Area fill path
  let areaD = pathD + ` L ${toX(points-1)} ${chartY + chartH} L ${toX(0)} ${chartY + chartH} Z`;

  const lineColor = isProfit ? '#14F195' : '#FF4444';
  const areaColor = isProfit ? 'rgba(20,241,149,0.08)' : 'rgba(255,68,68,0.08)';
  
  const entryX = toX(entryIdx);
  const entryY = toY(prices[entryIdx]);
  const exitX = toX(exitIdx);
  const exitY = toY(prices[exitIdx]);

  return `
  <!-- Chart area fill -->
  <path d="${areaD}" fill="${areaColor}"/>
  
  <!-- Chart line -->
  <path d="${pathD}" fill="none" stroke="${lineColor}" stroke-width="2" opacity="0.5"/>
  
  <!-- Entry marker -->
  <circle cx="${entryX}" cy="${entryY}" r="8" fill="#14F195" opacity="0.9"/>
  <text x="${entryX}" y="${entryY - 14}" font-family="Arial Black" font-size="11" fill="#14F195" text-anchor="middle" opacity="0.9">BUY</text>
  <line x1="${entryX}" y1="${entryY}" x2="${entryX}" y2="${chartY + chartH}" stroke="#14F195" stroke-width="1" stroke-dasharray="4,4" opacity="0.3"/>

  <!-- Exit marker -->
  <circle cx="${exitX}" cy="${exitY}" r="8" fill="${isProfit ? '#FF4444' : '#FF4444'}" opacity="0.9"/>
  <text x="${exitX}" y="${exitY - 14}" font-family="Arial Black" font-size="11" fill="#FF4444" text-anchor="middle" opacity="0.9">SELL</text>
  <line x1="${exitX}" y1="${exitY}" x2="${exitX}" y2="${chartY + chartH}" stroke="#FF4444" stroke-width="1" stroke-dasharray="4,4" opacity="0.3"/>
  `;
}

async function makeCard(opts) {
  const {
    username = 'Fazle', rankName = 'Degen', rankNum = 1,
    tokenName = 'BONK', pnlSol = 2.450, pnlPct = 245,
    pnlUsd = 367.50, entryMcap = 50000, exitMcap = 245000,
    invested = 0.10, returned = 2.55, feeSaved = 12.50,
    feeRate = 1.00, heldTime = '2h 15m',
  } = opts;

  const W = 1000, H = 520;
  const isProfit = pnlSol >= 0;
  const sign = isProfit ? '+' : '';
  const pnlColor = isProfit ? '#14F195' : '#FF4444';
  const multiplier = (returned / invested).toFixed(1);

  const memeMap = [
    [500, "LEGENDARY. ABSOLUTE HAWK"],
    [200, "WE ARE SO BACK"],
    [100, "WAGMI BRO"],
    [50,  "Nice trade hawk!"],
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

  // Chart behind content
  const chartSVG = generateChartSVG(W, H * 0.65, isProfit, entryMcap, exitMcap);

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
    <!-- Fade overlay for chart area -->
    <linearGradient id="chartFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(0,0,0,0)"/>
      <stop offset="100%" style="stop-color:rgba(8,12,18,0.95)"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Chart in background (top area) -->
  <g transform="translate(0, 50)">
    ${chartSVG}
  </g>

  <!-- Fade over chart so text is readable -->
  <rect width="${W}" height="${H}" fill="url(#chartFade)"/>

  <!-- Top/bottom strips -->
  <rect width="${W}" height="52" fill="url(#ogGrad)" opacity="0.12"/>
  <rect y="${H-48}" width="${W}" height="48" fill="url(#ogGrad)" opacity="0.12"/>

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
  <text x="40" y="100" font-family="Arial" font-size="12" fill="#E8720C" letter-spacing="4">TRADE CLOSED  |  HELD: ${heldTime}</text>

  <!-- Token name + multiplier -->
  <text x="40" y="155" font-family="Arial Black" font-size="60" fill="white">${tokenName}</text>
  <text x="${W-40}" y="150" font-family="Arial Black" font-size="46" fill="${pnlColor}" text-anchor="end">${multiplier}x</text>

  <!-- PnL big -->
  <text x="40" y="252" font-family="Arial Black" font-size="74" fill="url(#pnlGrad)">${isProfit ? '&#9650;' : '&#9660;'} ${sign}${Math.abs(pnlSol).toFixed(3)} SOL</text>

  <!-- % and USD -->
  <text x="42" y="292" font-family="Arial Black" font-size="27" fill="${pnlColor}">${sign}${Math.abs(pnlPct).toFixed(1)}%</text>
  <text x="225" y="292" font-family="Arial" font-size="22" fill="#F5A623">${sign}$${Math.abs(pnlUsd).toFixed(2)}</text>

  <!-- Meme text -->
  <text x="42" y="326" font-family="Arial Black" font-size="17" fill="rgba(255,255,255,0.75)">${memeText}</text>

  <!-- Divider -->
  <line x1="40" y1="342" x2="${W-40}" y2="342" stroke="url(#ogGrad)" stroke-width="1" opacity="0.25"/>

  <!-- Stats -->
  <text x="40" y="370" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">ENTRY</text>
  <text x="40" y="400" font-family="Arial Black" font-size="29" fill="white">${formatMcap(entryMcap)}</text>

  <text x="175" y="370" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">EXIT</text>
  <text x="175" y="400" font-family="Arial Black" font-size="29" fill="white">${formatMcap(exitMcap)}</text>

  <text x="330" y="370" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">INVESTED</text>
  <text x="330" y="400" font-family="Arial Black" font-size="29" fill="white">${invested} SOL</text>

  <text x="530" y="370" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">RETURNED</text>
  <text x="530" y="400" font-family="Arial Black" font-size="29" fill="${pnlColor}">${returned} SOL</text>

  <!-- Rank benefit -->
  <line x1="40" y1="416" x2="${W-40}" y2="416" stroke="url(#ogGrad)" stroke-width="1" opacity="0.2"/>
  <rect x="40" y="424" width="${W-80}" height="40" rx="6" fill="rgba(245,166,35,0.07)"/>
  <rect x="40" y="424" width="4" height="40" rx="2" fill="${rankColor}"/>
  <text x="58" y="440" font-family="Arial" font-size="10" fill="#E8720C" letter-spacing="2">RANK BENEFIT</text>
  <text x="58" y="457" font-family="Arial Black" font-size="15" fill="${rankColor}">${rankName.toUpperCase()} RANK  |  ${feeRate}% FEE  |  SAVED $${feeSaved.toFixed(2)} TODAY</text>

  <!-- Bottom -->
  <line x1="40" y1="472" x2="${W-40}" y2="472" stroke="url(#ogGrad)" stroke-width="1" opacity="0.15"/>
  <text x="40" y="500" font-family="Arial" font-style="italic" font-size="13" fill="rgba(255,255,255,0.3)">Always Watching. Always First.</text>
  <text x="${W-40}" y="500" font-family="Arial" font-size="13" fill="#F5A623" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
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
