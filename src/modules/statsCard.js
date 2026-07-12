const sharp = require('sharp');
const path = require('path');
const QRCode = require('qrcode');

// Generate a small QR code (referral link) as a base64 PNG data URI, for embedding in card SVGs
async function generateReferralQR(referralUrl) {
  try {
    const dataUrl = await QRCode.toDataURL(referralUrl, { width: 120, margin: 1, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
    return dataUrl;
  } catch (e) {
    console.log("[QR] generation failed:", e.message);
    return null;
  }
}

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


// Generates a mini price-chart SVG (up-trend for profit, down for loss)
function generateChartSVG(width, height, isProfit) {
  const pts = [];
  const n = 24;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * width;
    // base trend line + noise; profit trends up, loss trends down
    const trend = isProfit ? (i / (n - 1)) : (1 - i / (n - 1));
    const noise = Math.sin(i * 0.9) * 0.08 + (Math.random() - 0.5) * 0.06;
    const yNorm = 1 - Math.max(0, Math.min(1, trend * 0.7 + 0.15 + noise));
    const y = yNorm * height;
    pts.push([x, y]);
  }
  const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ' L' + width + ' ' + height + ' L0 ' + height + ' Z';
  const color = isProfit ? '#14F195' : '#ff4444';
  const fillId = isProfit ? 'chartUp' : 'chartDown';
  return `
    <defs>
      <linearGradient id="${fillId}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${color}" stop-opacity="0.35"/>
        <stop offset="100%" style="stop-color:${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#${fillId})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>
  `;
}

async function generateTradeCard(opts) {
  const {
    username = 'Trader',
    rankName = 'Scout',
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
    hideAmounts = false, // legacy master switch (per-card quick toggle) - hides everything when true
    hideInvested = false,
    hideSolAmount = false,
    hideHoldTime = false,
    holdTime = null,
    referralCode = null,
  } = opts;

  const W = 640, H = 420;
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
  const formatMcap = (n) => {
    if (!n || n <= 0) return "N/A";
    if (n >= 1e9) return "$" + (n/1e9).toFixed(2) + "B";
    if (n >= 1e6) return "$" + (n/1e6).toFixed(2) + "M";
    if (n >= 1e3) return "$" + (n/1e3).toFixed(2) + "K";
    return "$" + n.toFixed(2);
  };

  // Referral QR code - only if a referral code was provided
  let qrDataUrl = null;
  if (referralCode) {
    qrDataUrl = await generateReferralQR(`https://t.me/HawkX_Trade_Bot?start=${referralCode}`);
  }

  const refCodeShort = referralCode ? String(referralCode).slice(0,14) : "";
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1c0e00"/>
      <stop offset="50%" style="stop-color:#0A0A0A"/>
      <stop offset="100%" style="stop-color:#1c0e00"/>
    </linearGradient>
    <linearGradient id="ogGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#FF9500"/>
      <stop offset="100%" style="stop-color:#FF6B00"/>
    </linearGradient>
    <linearGradient id="pnlGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${pnlColor}"/>
      <stop offset="100%" style="stop-color:${isProfit ? '#00cc77' : '#cc2222'}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="75%">
      <stop offset="0%" style="stop-color:#FF6B00" stop-opacity="0.15"/>
      <stop offset="100%" style="stop-color:#FF6B00" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="4" fill="url(#ogGrad)"/>
  <rect y="${H-4}" width="${W}" height="4" fill="url(#ogGrad)"/>
  <rect width="3" height="${H}" fill="url(#ogGrad)"/>
  <rect x="${W-3}" width="3" height="${H}" fill="url(#ogGrad)"/>

  <text x="24" y="34" font-family="Arial Black" font-size="19" fill="#FF6B00" letter-spacing="3">HAWKX</text>
  <text x="${W-24}" y="18" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.7)" text-anchor="end">@${username}</text>
  <text x="${W-24}" y="32" font-family="Arial Black" font-size="12" fill="${rankColor}" text-anchor="end">${rankName.toUpperCase()} (${rankNum}/7)</text>
  <line x1="24" y1="42" x2="${W-24}" y2="42" stroke="url(#ogGrad)" stroke-width="1" opacity="0.4"/>

  <text x="24" y="60" font-family="Arial" font-size="10" fill="#FF9500" letter-spacing="2">SOLD ${sellPct}%${(holdTime && !hideAmounts && !hideHoldTime) ? "  ·  HELD " + holdTime.toUpperCase() : ""}</text>
  <text x="24" y="96" font-family="Arial Black" font-size="30" fill="#FFD27A">$${tokenName.slice(0,14)}</text>
  ${isProfit ? '<text x="' + (W-24) + '" y="92" font-family="Arial Black" font-size="22" fill="' + pnlColor + '" text-anchor="end">' + (hideAmounts ? "***" : multiplier + "x") + '</text>' : ''}

  <text x="24" y="150" font-family="Arial Black" font-size="42" fill="url(#pnlGrad)">${isProfit ? '&#9650;' : '&#9660;'} ${(hideAmounts || hideSolAmount) ? '***' : sign+(Math.abs(pnlSol) < 0.001 ? Math.abs(pnlSol).toFixed(6) : Math.abs(pnlSol).toFixed(3))+' SOL'}</text>
  <text x="${W-24}" y="146" font-family="Arial Black" font-size="20" fill="${pnlColor}" text-anchor="end">${sign}${Math.abs(pnlPct).toFixed(1)}%</text>
  <text x="${W-24}" y="168" font-family="Arial" font-size="16" fill="#FF9500" text-anchor="end">${hideAmounts ? '***' : sign+'$'+Math.abs(pnlUsd).toFixed(2)}</text>
  <text x="24" y="196" font-family="Arial" font-size="13" fill="rgba(255,255,255,0.65)">${memeText}</text>
  <line x1="24" y1="206" x2="${W-24}" y2="206" stroke="url(#ogGrad)" stroke-width="1" opacity="0.25"/>

  <text x="24" y="222" font-family="Arial" font-size="8" fill="#FF9500" letter-spacing="1.5">ENTRY</text>
  <text x="24" y="238" font-family="Arial Black" font-size="16" fill="white">${formatMcap(entryMcap)}</text>
  <text x="180" y="222" font-family="Arial" font-size="8" fill="#FF9500" letter-spacing="1.5">EXIT</text>
  <text x="180" y="238" font-family="Arial Black" font-size="16" fill="white">${formatMcap(exitMcap)}</text>
  <text x="336" y="222" font-family="Arial" font-size="8" fill="#FF9500" letter-spacing="1.5">INVESTED</text>
  <text x="336" y="238" font-family="Arial Black" font-size="15" fill="white">${(hideAmounts || hideInvested) ? '***' : (invested < 0.001 ? invested.toFixed(6) : invested.toFixed(4))+' \u25CE'}</text>
  <text x="470" y="222" font-family="Arial" font-size="8" fill="#FF9500" letter-spacing="1.5">RETURNED</text>
  <text x="470" y="238" font-family="Arial Black" font-size="15" fill="${pnlColor}">${(hideAmounts || hideInvested) ? '***' : (returned < 0.001 ? returned.toFixed(6) : returned.toFixed(4))+' \u25CE'}</text>
  <line x1="24" y1="250" x2="${W-24}" y2="250" stroke="url(#ogGrad)" stroke-width="1" opacity="0.2"/>

  <rect x="24" y="260" width="${qrDataUrl ? W-140 : W-48}" height="34" rx="6" fill="rgba(255,107,0,0.08)"/>
  <rect x="24" y="260" width="3" height="34" rx="1.5" fill="${rankColor}"/>
  <text x="36" y="274" font-family="Arial" font-size="8" fill="#FF9500" letter-spacing="1.5">RANK BENEFIT</text>
  <text x="36" y="288" font-family="Arial Black" font-size="12" fill="${rankColor}">${rankName.toUpperCase()} · ${feeRate}% FEE · SAVED $${hideAmounts ? "***" : feeSaved < 0.01 ? feeSaved.toFixed(4) : feeSaved.toFixed(2)}</text>

  ${qrDataUrl ? `<image x="${W-104}" y="256" width="40" height="40" href="${qrDataUrl}"/><text x="${W-84}" y="304" font-family="Arial Black" font-size="8" fill="#FF9500" text-anchor="middle">10% DISCOUNT</text><text x="${W-84}" y="314" font-family="Arial" font-size="7" fill="rgba(255,255,255,0.5)" text-anchor="middle">${refCodeShort}</text>` : ''}

  <line x1="24" y1="326" x2="${W-24}" y2="326" stroke="url(#ogGrad)" stroke-width="1" opacity="0.15"/>
  <text x="24" y="346" font-family="Arial" font-style="italic" font-size="10" fill="rgba(255,255,255,0.35)">Always Watching. Always First.</text>
  <text x="${W-24}" y="346" font-family="Arial" font-size="10" fill="#FF6B00" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

  try {
    const buf = await sharp(Buffer.from(svg), { density: 288 }).png({ quality: 100, compressionLevel: 6 }).toBuffer();
    return { type: 'photo', buffer: buf };
  } catch(e) {
    console.error('[TradeCard] Error:', e.message);
    return { type: 'text', text: `🦅 *TRADE CLOSED*\n${tokenName}\n${sign}${Math.abs(pnlPct).toFixed(1)}%\n${hideAmounts ? '***' : sign+Math.abs(pnlSol).toFixed(4)+' SOL'}` };
  }
}





async function generateStatsCard(opts) {
  const {
    username = 'Trader', rankName = 'Scout', rankNum = 1,
    period = 'today', pnlSol = 0, pnlUsd = 0, trades = 0,
    winRate = 0, volume = 0, weekPnl = 0, monthPnl = 0,
    nextRankSol = 0, rankProgress = 0,
    bestTrade = 0, worstTrade = 0, totalFees = 0, streak = 0, avgTrade = 0, feeSaved = 0,
    referralCode = null,
  } = opts;
  const W = 640, H = 420;
  const isProfit = pnlSol >= 0;
  const refCodeShort2 = referralCode ? String(referralCode).slice(0,14) : "";
  let qrDataUrl = null;
  if (referralCode) {
    qrDataUrl = await generateReferralQR(`https://t.me/HawkX_Trade_Bot?start=${referralCode}`);
  }
  const fmtK = (n) => { const v = Math.abs(n); if (v >= 1e6) return (n/1e6).toFixed(2)+"M"; if (v >= 1e3) return (n/1e3).toFixed(2)+"K"; if (v > 0 && v < 0.01) return n.toFixed(6); return n.toFixed(4); };
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
  // Real SOL/USD price for the card's dollar figure (was hardcoded to 150)
  let _cardSolPx = 150;
  try {
    const db = require("../../database");
    _cardSolPx = await db.getSolPriceUsdShared();
  } catch {}

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1c0e00"/>
      <stop offset="50%" style="stop-color:#0A0A0A"/>
      <stop offset="100%" style="stop-color:#1c0e00"/>
    </linearGradient>
    <linearGradient id="ogGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#FF9500"/>
      <stop offset="100%" style="stop-color:#FF6B00"/>
    </linearGradient>
    <linearGradient id="pnlGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${pnlColor}"/>
      <stop offset="100%" style="stop-color:${isProfit ? '#00cc77' : '#cc2222'}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="75%">
      <stop offset="0%" style="stop-color:${periodAccent}" stop-opacity="0.15"/>
      <stop offset="100%" style="stop-color:${periodAccent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="4" fill="${periodAccent}"/>
  <rect y="${H-4}" width="${W}" height="4" fill="${periodAccent}"/>
  <rect width="3" height="${H}" fill="${periodAccent}"/>
  <rect x="${W-3}" width="3" height="${H}" fill="${periodAccent}"/>

  <text x="24" y="30" font-family="Arial Black" font-size="19" fill="#FF6B00" letter-spacing="3">HAWKX</text>
  <text x="${W-24}" y="18" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.7)" text-anchor="end">@${username}</text>
  <text x="${W-24}" y="32" font-family="Arial Black" font-size="12" fill="${rankColor}" text-anchor="end">${rankName.toUpperCase()} (${rankNum}/7)</text>
  <line x1="24" y1="42" x2="${W-24}" y2="42" stroke="${periodAccent}" stroke-width="1" opacity="0.4"/>

  <text x="24" y="62" font-family="Arial" font-size="11" fill="${periodAccent}" letter-spacing="3">${periodLabel}</text>
  <text x="24" y="118" font-family="Arial Black" font-size="42" fill="url(#pnlGrad)">${periodPnl >= 0 ? '&#9650;' : '&#9660;'} ${periodSign}${Math.abs(periodPnl) < 0.001 ? Math.abs(periodPnl).toFixed(6) : Math.abs(periodPnl).toFixed(3)} SOL</text>
  <text x="26" y="140" font-family="Arial" font-size="16" fill="#FF9500">${periodSign}$${(Math.abs(periodPnl)*_cardSolPx).toFixed(2)}</text>
  <line x1="24" y1="154" x2="${W-24}" y2="154" stroke="url(#ogGrad)" stroke-width="1" opacity="0.25"/>

  <text x="24" y="174" font-family="Arial" font-size="8" fill="${periodAccent}" letter-spacing="1.5">WIN RATE</text>
  <text x="24" y="196" font-family="Arial Black" font-size="22" fill="white">${winRate}%</text>
  <text x="140" y="174" font-family="Arial" font-size="8" fill="${periodAccent}" letter-spacing="1.5">TRADES</text>
  <text x="140" y="196" font-family="Arial Black" font-size="22" fill="white">${trades}</text>
  <text x="250" y="174" font-family="Arial" font-size="8" fill="${periodAccent}" letter-spacing="1.5">STREAK</text>
  <text x="250" y="196" font-family="Arial Black" font-size="22" fill="${streak >= 0 ? '#14F195' : '#FF4444'}">${streak >= 0 ? '+' : ''}${streak}</text>
  <text x="360" y="174" font-family="Arial" font-size="8" fill="${periodAccent}" letter-spacing="1.5">BEST</text>
  <text x="360" y="196" font-family="Arial Black" font-size="17" fill="#14F195">+${fmtK(bestTrade)}</text>
  <text x="490" y="174" font-family="Arial" font-size="8" fill="${periodAccent}" letter-spacing="1.5">WORST</text>
  <text x="490" y="196" font-family="Arial Black" font-size="17" fill="#FF4444">${fmtK(worstTrade)}</text>
  <line x1="24" y1="208" x2="${W-24}" y2="208" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

  <text x="24" y="228" font-family="Arial" font-size="8" fill="${periodAccent}" letter-spacing="1.5">AVG TRADE</text>
  <text x="24" y="248" font-family="Arial Black" font-size="16" fill="white">${avgTrade >= 0 ? '+' : ''}${fmtK(avgTrade)} SOL</text>
  <text x="180" y="228" font-family="Arial" font-size="8" fill="${periodAccent}" letter-spacing="1.5">FEES PAID / SAVED</text>
  <text x="180" y="248" font-family="Arial Black" font-size="13" fill="#F5A623">${fmtK(totalFees)} / $${feeSaved.toFixed(2)}</text>
  <text x="340" y="228" font-family="Arial" font-size="8" fill="${periodAccent}" letter-spacing="1.5">WEEK</text>
  <text x="340" y="248" font-family="Arial Black" font-size="16" fill="${weekPnl >= 0 ? '#14F195' : '#FF4444'}">${wSign}${fmtK(weekPnl)}</text>
  <text x="470" y="228" font-family="Arial" font-size="8" fill="${periodAccent}" letter-spacing="1.5">MONTH</text>
  <text x="470" y="248" font-family="Arial Black" font-size="16" fill="${monthPnl >= 0 ? '#14F195' : '#FF4444'}">${mSign}${fmtK(monthPnl)}</text>
  <line x1="24" y1="262" x2="${W-24}" y2="262" stroke="url(#ogGrad)" stroke-width="1" opacity="0.2"/>

  <text x="24" y="280" font-family="Arial" font-size="10" fill="${periodAccent}" letter-spacing="1.5">RANK PROGRESS → ${nextRankNames[rankNum] || 'MAX'}</text>
  <rect x="24" y="288" width="${W-48}" height="9" rx="4.5" fill="rgba(255,255,255,0.1)"/>
  <rect x="24" y="288" width="${Math.max(4,(W-48)*(rankProgress/100))}" height="9" rx="4.5" fill="${periodAccent}"/>
  <text x="24" y="312" font-family="Arial" font-size="11" fill="rgba(255,255,255,0.5)">${rankProgress.toFixed(0)}% · ${fmtK(volume)} / ${nextRankSol || "MAX"} SOL</text>

  <rect x="24" y="324" width="${qrDataUrl ? W-140 : W-48}" height="1" fill="rgba(255,255,255,0)"/>
  ${qrDataUrl ? `<image x="${W-104}" y="322" width="40" height="40" href="${qrDataUrl}"/><text x="${W-84}" y="370" font-family="Arial Black" font-size="8" fill="#FF9500" text-anchor="middle">10% DISCOUNT</text><text x="${W-84}" y="380" font-family="Arial" font-size="7" fill="rgba(255,255,255,0.5)" text-anchor="middle">${refCodeShort2}</text>` : ''}

  <line x1="24" y1="392" x2="${W-24}" y2="392" stroke="url(#ogGrad)" stroke-width="1" opacity="0.15"/>
  <text x="24" y="410" font-family="Arial" font-style="italic" font-size="10" fill="rgba(255,255,255,0.35)">Always Watching. Always First.</text>
  <text x="${W-24}" y="410" font-family="Arial" font-size="10" fill="#FF6B00" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;


  try {
    const buf = await sharp(Buffer.from(svg), { density: 288 }).png({ quality: 100, compressionLevel: 6 }).toBuffer();
    return { type: 'photo', buffer: buf };
  } catch(e) {
    console.error('[StatsCard] Error:', e.message);
    return { type: 'text', text: `🦅 *HAWKX ${periodLabel}*\n@${username}\n${periodSign}${Math.abs(periodPnl).toFixed(4)} SOL` };
  }
}

async function generateRankCard(opts) {
  const {
    username = 'Trader', rankName = 'Scout', rankNum = 1,
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
    const buf = await sharp(Buffer.from(svg), { density: 288 }).png({ quality: 100, compressionLevel: 6 }).toBuffer();
    return { type: 'photo', buffer: buf };
  } catch(e) {
    console.error('[RankCard] Error:', e.message);
    return { type: 'text', text: `🦅 *${rankName}* Rank ${rankNum}/7\nFee: ${fee}%` };
  }
}

module.exports = { generateStatsCard, generateRankCard, generateTradeCard };
