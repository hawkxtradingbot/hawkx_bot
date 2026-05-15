const sharp = require('sharp');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '../assets/cards');

function getProfitCard(pnlPct) {
  if (pnlPct >= 500) return 'profit_7.png';
  if (pnlPct >= 200) return 'profit_6.png';
  if (pnlPct >= 100) return 'profit_5.png';
  if (pnlPct >= 50)  return 'profit_4.png';
  if (pnlPct >= 20)  return 'profit_3.png';
  if (pnlPct >= 5)   return 'profit_2.png';
  return 'profit_1.png';
}

function getLossCard(pnlPct) {
  if (pnlPct <= -99) return 'loss_7.png';
  if (pnlPct <= -80) return 'loss_6.png';
  if (pnlPct <= -50) return 'loss_5.png';
  if (pnlPct <= -30) return 'loss_4.png';
  if (pnlPct <= -20) return 'loss_3.png';
  if (pnlPct <= -5)  return 'loss_2.png';
  return 'loss_1.png';
}

function getRankCard(rankNum) {
  if (rankNum >= 2) return `rank_${rankNum}.png`;
  return null;
}

function getRankColor(rankNum) {
  const colors = {
    1: '#aaaaaa', // Degen - grey
    2: '#00ccff', // Flipper - blue
    3: '#00ff88', // Trader - green
    4: '#ff9900', // Sniper - orange
    5: '#ff00ff', // Whale - purple
    6: '#ff4444', // Shark - red
    7: '#FFD700', // Hawk Elite - gold
  };
  return colors[rankNum] || '#ffffff';
}

function getOverlayOpacity(pnlPct) {
  // Less opacity = show character more
  if (Math.abs(pnlPct) >= 100) return 0.35;
  if (Math.abs(pnlPct) >= 50)  return 0.40;
  return 0.45;
}


async function generateTradeCard(opts) {
  const {
    username = 'Trader',
    rankName = 'Degen',
    rankNum = 1,
    tokenName = 'TOKEN',
    sellPct = 100,
    pnlSol = 0,
    pnlPct = 0,
    pnlUsd = 0,
    entryMcap = 0,
    exitMcap = 0,
    invested = 0,
    returned = 0,
    feeSaved = 0,
    feeRate = 1.00,
    dailyFeeSaved = 0,
    weeklyFeeSaved = 0,
    monthlyFeeSaved = 0,
    hideAmounts = false,
  } = opts;

  const W = 1000, H = 520;
  const isProfit = pnlSol >= 0;
  const sign = isProfit ? '+' : '';
  const pnlColor = isProfit ? '#14F195' : '#FF4444';
  const multiplier = invested > 0 ? (returned / invested).toFixed(1) : '0';

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
  const formatMcap = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;

  // Generate chart
  const chartSVG = generateChartSVG(W, H * 0.55, isProfit);

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
    <linearGradient id="chartFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(0,0,0,0)"/>
      <stop offset="100%" style="stop-color:rgba(8,12,18,0.95)"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g transform="translate(0,50)">${chartSVG}</g>
  <rect width="${W}" height="${H}" fill="url(#chartFade)"/>
  <rect width="${W}" height="52" fill="url(#ogGrad)" opacity="0.12"/>
  <rect y="${H-48}" width="${W}" height="48" fill="url(#ogGrad)" opacity="0.12"/>
  <rect width="${W}" height="5" fill="url(#ogGrad)"/>
  <rect y="${H-5}" width="${W}" height="5" fill="url(#ogGrad)"/>
  <rect width="4" height="${H}" fill="url(#ogGrad)"/>
  <rect x="${W-4}" width="4" height="${H}" fill="url(#ogGrad)"/>
  <text x="40" y="47" font-family="Arial Black" font-size="28" fill="#F5A623" letter-spacing="6">H A W K X</text>
  <text x="${W-40}" y="30" font-family="Arial" font-size="15" fill="rgba(255,255,255,0.8)" text-anchor="end">@${username}</text>
  <text x="${W-40}" y="52" font-family="Arial Black" font-size="17" fill="${rankColor}" text-anchor="end">${rankName.toUpperCase()} (${rankNum}/7)</text>
  <line x1="40" y1="68" x2="${W-40}" y2="68" stroke="url(#ogGrad)" stroke-width="1" opacity="0.4"/>
  <text x="40" y="100" font-family="Arial" font-size="12" fill="#E8720C" letter-spacing="4">TRADE CLOSED  |  SOLD ${sellPct}%</text>
  <text x="40" y="155" font-family="Arial Black" font-size="60" fill="white">${tokenName}</text>
  ${isProfit ? '<text x="' + (W-40) + '" y="150" font-family="Arial Black" font-size="46" fill="' + pnlColor + '" text-anchor="end">' + (hideAmounts ? "***" : multiplier + "x") + '</text>' : ''}
  <text x="40" y="252" font-family="Arial Black" font-size="74" fill="url(#pnlGrad)">${isProfit ? '&#9650;' : '&#9660;'} ${hideAmounts ? '***' : sign+(Math.abs(pnlSol) < 0.001 ? Math.abs(pnlSol).toFixed(6) : Math.abs(pnlSol).toFixed(3))+' SOL'}</text>
  <text x="42" y="292" font-family="Arial Black" font-size="27" fill="${pnlColor}">${sign}${Math.abs(pnlPct).toFixed(1)}%</text>
  <text x="225" y="292" font-family="Arial" font-size="22" fill="#F5A623">${hideAmounts ? '***' : sign+'$'+Math.abs(pnlUsd).toFixed(2)}</text>
  <text x="42" y="326" font-family="Arial Black" font-size="17" fill="rgba(255,255,255,0.75)">${memeText}</text>
  <line x1="40" y1="342" x2="${W-40}" y2="342" stroke="url(#ogGrad)" stroke-width="1" opacity="0.25"/>
  <text x="40" y="370" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">ENTRY</text>
  <text x="40" y="400" font-family="Arial Black" font-size="29" fill="white">${entryMcap > 0 ? formatMcap(entryMcap) : 'N/A'}</text>
  <text x="175" y="370" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">EXIT</text>
  <text x="175" y="400" font-family="Arial Black" font-size="29" fill="white">${exitMcap > 0 ? formatMcap(exitMcap) : 'N/A'}</text>
  <text x="330" y="370" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">INVESTED</text>
  <text x="330" y="400" font-family="Arial Black" font-size="26" fill="white">${hideAmounts ? '***' : (invested < 0.001 ? invested.toFixed(6) : invested.toFixed(4))+' SOL'}</text>
  <text x="600" y="370" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">RETURNED</text>
  <text x="600" y="400" font-family="Arial Black" font-size="26" fill="${pnlColor}">${hideAmounts ? '***' : (returned < 0.001 ? returned.toFixed(6) : returned.toFixed(4))+' SOL'}</text>
  <line x1="40" y1="416" x2="${W-40}" y2="416" stroke="url(#ogGrad)" stroke-width="1" opacity="0.2"/>
  <rect x="40" y="424" width="${W-80}" height="40" rx="6" fill="rgba(245,166,35,0.07)"/>
  <rect x="40" y="424" width="4" height="40" rx="2" fill="${rankColor}"/>
  <text x="58" y="440" font-family="Arial" font-size="10" fill="#E8720C" letter-spacing="2">RANK BENEFIT</text>
  <text x="58" y="457" font-family="Arial Black" font-size="15" fill="${rankColor}">${rankName.toUpperCase()} RANK  |  ${feeRate}% FEE  |  TRADE:$${hideAmounts ? "***" : feeSaved < 0.01 ? feeSaved.toFixed(4) : feeSaved.toFixed(2)} DAY:$${hideAmounts ? "***" : dailyFeeSaved < 0.01 ? dailyFeeSaved.toFixed(4) : dailyFeeSaved.toFixed(2)} WK:$${hideAmounts ? "***" : weeklyFeeSaved < 0.01 ? weeklyFeeSaved.toFixed(4) : weeklyFeeSaved.toFixed(2)}</text>
  <line x1="40" y1="472" x2="${W-40}" y2="472" stroke="url(#ogGrad)" stroke-width="1" opacity="0.15"/>
  <text x="40" y="500" font-family="Arial" font-style="italic" font-size="13" fill="rgba(255,255,255,0.3)">Always Watching. Always First.</text>
  <text x="${W-40}" y="500" font-family="Arial" font-size="13" fill="#F5A623" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

  try {
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    return { type: 'photo', buffer: buf };
  } catch(e) {
    console.error('[TradeCard] Error:', e.message);
    return { type: 'text', text: `🦅 *TRADE CLOSED*\n${tokenName}\n${sign}${Math.abs(pnlPct).toFixed(1)}%\n${hideAmounts ? '***' : sign+Math.abs(pnlSol).toFixed(4)+' SOL'}` };
  }
}





async function generateStatsCard(opts) {
  const {
    username = 'Trader', rankName = 'Degen', rankNum = 1,
    period = 'today', pnlSol = 0, pnlUsd = 0, trades = 0,
    winRate = 0, volume = 0, weekPnl = 0, monthPnl = 0,
    nextRankSol = 0, rankProgress = 0,
    bestTrade = 0, worstTrade = 0, totalFees = 0, streak = 0, avgTrade = 0,
  } = opts;
  const W = 1000, H = 520;
  const isProfit = pnlSol >= 0;
  const pnlColor = isProfit ? '#14F195' : '#FF4444';
  const periodLabel = period === 'today' ? "TODAY'S PNL" : period === 'week' ? 'WEEKLY PNL' : 'MONTHLY PNL';
  const rankColors = ['','#aaaaaa','#00ccff','#00ff88','#ff9900','#cc44ff','#ff4444','#FFD700'];
  const rankColor = rankColors[rankNum] || '#F5A623';
  const periodAccent = period === 'today' ? '#00aaff' : period === 'week' ? '#14F195' : '#FFD700';
  const nextRankNames = ['','Flipper','Trader','Sniper','Whale','Shark','Hawk Elite','MAX'];
  const wSign = weekPnl >= 0 ? '+' : '';
  const mSign = monthPnl >= 0 ? '+' : '';
  const periodPnl = period === 'today' ? pnlSol : period === 'week' ? weekPnl : monthPnl;
  const periodSign = periodPnl >= 0 ? '+' : '';

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${period === 'today' ? '#00071a' : period === 'week' ? '#001a07' : '#1a1000'}"/>
      <stop offset="45%" style="stop-color:#080c12"/>
      <stop offset="100%" style="stop-color:${period === 'today' ? '#00071a' : period === 'week' ? '#001a07' : '#1a1000'}"/>
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
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="52" fill="url(#ogGrad)" opacity="0.12"/>
  <rect y="${H-48}" width="${W}" height="48" fill="url(#ogGrad)" opacity="0.12"/>
  <rect width="${W}" height="5" fill="${periodAccent}"/>
  <rect y="${H-5}" width="${W}" height="5" fill="${periodAccent}"/>
  <rect width="4" height="${H}" fill="${periodAccent}"/>
  <rect x="${W-4}" width="4" height="${H}" fill="${periodAccent}"/>
  <text x="40" y="47" font-family="Arial Black" font-size="28" fill="#F5A623" letter-spacing="6">H A W K X</text>
  <text x="${W-40}" y="30" font-family="Arial" font-size="15" fill="rgba(255,255,255,0.8)" text-anchor="end">@${username}</text>
  <text x="${W-40}" y="52" font-family="Arial Black" font-size="17" fill="${rankColor}" text-anchor="end">${rankName.toUpperCase()} (${rankNum}/7)</text>
  <line x1="40" y1="68" x2="${W-40}" y2="68" stroke="${periodAccent}" stroke-width="1" opacity="0.5"/>
  <text x="40" y="100" font-family="Arial" font-size="12" fill="${periodAccent}" letter-spacing="4">${periodLabel}</text>
  <text x="40" y="200" font-family="Arial Black" font-size="74" fill="url(#pnlGrad)">${periodPnl >= 0 ? '&#9650;' : '&#9660;'} ${periodSign}${Math.abs(periodPnl) < 0.001 ? Math.abs(periodPnl).toFixed(6) : Math.abs(periodPnl).toFixed(3)} SOL</text>
  <text x="42" y="235" font-family="Arial" font-size="24" fill="#F5A623">${periodSign}$${(Math.abs(periodPnl)*150).toFixed(2)}</text>
  <line x1="40" y1="255" x2="${W-40}" y2="255" stroke="url(#ogGrad)" stroke-width="1" opacity="0.25"/>
  <text x="40" y="282" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="2">WIN RATE</text>
  <text x="40" y="315" font-family="Arial Black" font-size="36" fill="white">${winRate}%</text>
  <text x="200" y="282" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="2">TRADES</text>
  <text x="200" y="315" font-family="Arial Black" font-size="36" fill="white">${trades}</text>
  <text x="360" y="282" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="2">STREAK</text>
  <text x="360" y="315" font-family="Arial Black" font-size="36" fill="${streak >= 0 ? '#14F195' : '#FF4444'}">${streak >= 0 ? '+' : ''}${streak}</text>
  <text x="560" y="282" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="2">BEST TRADE</text>
  <text x="560" y="315" font-family="Arial Black" font-size="30" fill="#14F195">+${bestTrade.toFixed(3)} SOL</text>
  <text x="800" y="282" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="2">WORST TRADE</text>
  <text x="800" y="315" font-family="Arial Black" font-size="30" fill="#FF4444">${worstTrade.toFixed(3)} SOL</text>
  <line x1="40" y1="332" x2="${W-40}" y2="332" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="40" y="355" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="2">AVG TRADE</text>
  <text x="40" y="383" font-family="Arial Black" font-size="26" fill="white">${avgTrade >= 0 ? '+' : ''}${avgTrade.toFixed(3)} SOL</text>
  <text x="250" y="355" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="2">FEES PAID</text>
  <text x="250" y="383" font-family="Arial Black" font-size="26" fill="#F5A623">${totalFees.toFixed(4)} SOL</text>
  <text x="480" y="355" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="2">THIS WEEK</text>
  <text x="480" y="383" font-family="Arial Black" font-size="26" fill="${weekPnl >= 0 ? '#14F195' : '#FF4444'}">${wSign}${weekPnl.toFixed(3)} SOL</text>
  <text x="730" y="355" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="2">THIS MONTH</text>
  <text x="730" y="383" font-family="Arial Black" font-size="26" fill="${monthPnl >= 0 ? '#14F195' : '#FF4444'}">${mSign}${monthPnl.toFixed(3)} SOL</text>
  <line x1="40" y1="400" x2="${W-40}" y2="400" stroke="url(#ogGrad)" stroke-width="1" opacity="0.2"/>
  <text x="40" y="420" font-family="Arial" font-size="12" fill="${periodAccent}" letter-spacing="2">RANK PROGRESS → ${nextRankNames[rankNum] || 'MAX'}</text>
  <rect x="40" y="430" width="${W-80}" height="10" rx="5" fill="rgba(255,255,255,0.1)"/>
  <rect x="40" y="430" width="${Math.max(4,(W-80)*(rankProgress/100))}" height="10" rx="5" fill="${periodAccent}"/>
  <text x="40" y="456" font-family="Arial" font-size="12" fill="rgba(255,255,255,0.4)">${rankProgress.toFixed(0)}% · ${volume >= 1000 ? (volume/1000).toFixed(1)+"K" : volume.toFixed(2)} / ${nextRankSol || "MAX"} SOL</text>
  <line x1="40" y1="470" x2="${W-40}" y2="470" stroke="url(#ogGrad)" stroke-width="1" opacity="0.15"/>
  <text x="40" y="500" font-family="Arial" font-style="italic" font-size="13" fill="rgba(255,255,255,0.3)">Always Watching. Always First.</text>
  <text x="${W-40}" y="500" font-family="Arial" font-size="13" fill="#F5A623" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

  try {
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    return { type: 'photo', buffer: buf };
  } catch(e) {
    console.error('[StatsCard] Error:', e.message);
    return { type: 'text', text: `🦅 *HAWKX ${periodLabel}*\n@${username}\n${periodSign}${Math.abs(periodPnl).toFixed(4)} SOL` };
  }
}

async function generateRankCard(opts) {
  const {
    username = 'Trader', rankName = 'Degen', rankNum = 1,
    volume = 0, nextRankSol = 0, rankProgress = 0,
    fee = 1.00, totalTrades = 0, winRate = 0,
  } = opts;
  const W = 1000, H = 520;
  const rankColors = ['','#aaaaaa','#00ccff','#00ff88','#ff9900','#cc44ff','#ff4444','#FFD700'];
  const rankColor = rankColors[rankNum] || '#F5A623';
  const nextRankNames = ['','Flipper','Trader','Sniper','Whale','Shark','Hawk Elite','MAX'];
  const nextRank = nextRankNames[rankNum] || 'MAX';
  const savingsPct = ((1.00 - fee) * 100).toFixed(0);

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0d14"/>
      <stop offset="100%" style="stop-color:#0a0d14"/>
    </linearGradient>
    <linearGradient id="ogGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#F5A623"/>
      <stop offset="100%" style="stop-color:#E8720C"/>
    </linearGradient>
    <linearGradient id="rankGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${rankColor}"/>
      <stop offset="100%" style="stop-color:${rankColor}88"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="820" cy="180" r="180" fill="${rankColor}" opacity="0.04"/>
  <line x1="500" y1="0" x2="${W}" y2="300" stroke="${rankColor}" stroke-width="1" opacity="0.05"/>
  <line x1="600" y1="0" x2="${W}" y2="200" stroke="${rankColor}" stroke-width="1" opacity="0.05"/>
  <rect width="${W}" height="5" fill="url(#rankGrad)"/>
  <rect y="${H-5}" width="${W}" height="5" fill="url(#rankGrad)"/>
  <rect width="4" height="${H}" fill="url(#rankGrad)"/>
  <rect x="${W-4}" width="4" height="${H}" fill="url(#rankGrad)"/>
  <rect width="${W}" height="52" fill="url(#ogGrad)" opacity="0.1"/>
  <text x="40" y="47" font-family="Arial Black" font-size="28" fill="#F5A623" letter-spacing="6">H A W K X</text>
  <text x="${W-40}" y="30" font-family="Arial" font-size="15" fill="rgba(255,255,255,0.8)" text-anchor="end">@${username}</text>
  <text x="${W-40}" y="52" font-family="Arial Black" font-size="17" fill="${rankColor}" text-anchor="end">RANK CARD</text>
  <line x1="40" y1="68" x2="${W-40}" y2="68" stroke="url(#ogGrad)" stroke-width="1" opacity="0.4"/>
  <text x="40" y="110" font-family="Arial" font-size="14" fill="#E8720C" letter-spacing="4">YOUR RANK</text>
  <text x="40" y="210" font-family="Arial Black" font-size="100" fill="${rankColor}">${rankName.toUpperCase()}</text>
  <text x="40" y="250" font-family="Arial" font-size="20" fill="rgba(255,255,255,0.5)">Rank ${rankNum} of 7</text>
  <line x1="40" y1="268" x2="${W-40}" y2="268" stroke="url(#ogGrad)" stroke-width="1" opacity="0.2"/>
  <text x="40" y="296" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">TRADING FEE</text>
  <text x="40" y="334" font-family="Arial Black" font-size="38" fill="${rankColor}">${fee.toFixed(2)}%</text>
  <text x="220" y="296" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">FEE SAVED</text>
  <text x="220" y="334" font-family="Arial Black" font-size="38" fill="#14F195">${savingsPct}%</text>
  <text x="400" y="296" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">VOLUME</text>
  <text x="400" y="334" font-family="Arial Black" font-size="32" fill="white">${volume >= 1000 ? (volume/1000).toFixed(1)+"K" : volume.toFixed(2)} SOL</text>
  <text x="620" y="296" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">TRADES</text>
  <text x="620" y="334" font-family="Arial Black" font-size="38" fill="white">${totalTrades}</text>
  <text x="800" y="296" font-family="Arial" font-size="11" fill="#E8720C" letter-spacing="3">WIN RATE</text>
  <text x="800" y="334" font-family="Arial Black" font-size="38" fill="white">${winRate}%</text>
  <line x1="40" y1="355" x2="${W-40}" y2="355" stroke="url(#ogGrad)" stroke-width="1" opacity="0.2"/>
  <text x="40" y="375" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">PROGRESS TO ${nextRank.toUpperCase()}</text>
  <rect x="40" y="385" width="${W-80}" height="16" rx="8" fill="none" stroke="${rankColor}" stroke-width="2" stroke-dasharray="8,5" opacity="0.5"/>
  <rect x="40" y="385" width="${Math.max(8,(W-80)*(rankProgress/100))}" height="16" rx="8" fill="url(#rankGrad)" opacity="0.9"/>
  <text x="40" y="418" font-family="Arial" font-size="13" fill="${rankColor}">${rankProgress.toFixed(0)}% · ${volume >= 1000 ? (volume/1000).toFixed(1)+"K" : volume.toFixed(2)} / ${nextRankSol || "MAX"} SOL needed</text>
  <line x1="40" y1="438" x2="${W-40}" y2="438" stroke="url(#ogGrad)" stroke-width="1" opacity="0.15"/>
  <text x="40" y="468" font-family="Arial" font-style="italic" font-size="13" fill="rgba(255,255,255,0.3)">Always Watching. Always First.</text>
  <text x="${W-40}" y="468" font-family="Arial" font-size="13" fill="#F5A623" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

  try {
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    return { type: 'photo', buffer: buf };
  } catch(e) {
    console.error('[RankCard] Error:', e.message);
    return { type: 'text', text: `🦅 *${rankName}* Rank ${rankNum}/7\nFee: ${fee}%` };
  }
}

module.exports = { generateStatsCard, generateRankCard, generateTradeCard };
