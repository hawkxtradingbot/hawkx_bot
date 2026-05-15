const sharp = require('sharp');

function generateCardSVG(opts) {
  const {
    username = 'Trader',
    rankName = 'Degen',
    rankNum = 1,
    period = 'today',
    pnlSol = 0,
    pnlUsd = 0,
    trades = 0,
    winRate = 0,
    volume = 0,
  } = opts;

  const isProfit = pnlSol >= 0;
  const sign = isProfit ? '+' : '';
  const periodLabel = period === 'today' ? "TODAY'S PNL" : period === 'week' ? 'WEEKLY PNL' : 'MONTHLY PNL';
  
  // Colors
  const bgColor = isProfit ? '#0a0f1a' : '#1a0a0a';
  const accentColor = isProfit ? '#00ff88' : '#ff4444';
  const glowColor = isProfit ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)';
  const arrow = isProfit ? '▲' : '▼';

  return `<svg width="1000" height="520" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0d0d1a;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${accentColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${accentColor};stop-opacity:0.5" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1000" height="520" fill="url(#bg)"/>
  
  <!-- Glow circle -->
  <circle cx="500" cy="260" r="300" fill="${glowColor}"/>
  
  <!-- Top border accent -->
  <rect width="1000" height="4" fill="url(#accent)"/>
  
  <!-- Left accent line -->
  <rect x="0" y="0" width="4" height="520" fill="${accentColor}" opacity="0.5"/>

  <!-- HawkX Logo area -->
  <text x="50" y="60" font-family="Arial Black, Arial" font-weight="900" font-size="28" fill="${accentColor}" letter-spacing="4">🦅 HAWKX</text>
  <text x="860" y="60" font-family="Arial" font-size="18" fill="rgba(255,255,255,0.5)" text-anchor="middle">[DEVNET]</text>

  <!-- Divider -->
  <line x1="50" y1="80" x2="950" y2="80" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

  <!-- Username + Rank -->
  <text x="50" y="130" font-family="Arial" font-size="22" fill="rgba(255,255,255,0.8)">@${username}</text>
  <text x="950" y="130" font-family="Arial Black" font-size="20" fill="${accentColor}" text-anchor="end">${rankName.toUpperCase()} (${rankNum}/7)</text>

  <!-- Period label -->
  <text x="50" y="185" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.5)" letter-spacing="3">${periodLabel}</text>

  <!-- Big PnL number -->
  <text x="50" y="280" font-family="Arial Black, Arial" font-weight="900" font-size="80" fill="${accentColor}" filter="url(#glow)">${arrow} ${sign}${Math.abs(pnlSol).toFixed(3)} SOL</text>
  
  <!-- USD value -->
  <text x="50" y="330" font-family="Arial" font-size="28" fill="rgba(255,255,255,0.7)">${sign}$${Math.abs(pnlUsd).toFixed(2)}</text>

  <!-- Divider -->
  <line x1="50" y1="360" x2="950" y2="360" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

  <!-- Stats row -->
  <text x="50" y="405" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.5)">WIN RATE</text>
  <text x="50" y="435" font-family="Arial Black" font-size="32" fill="white">${winRate}%</text>

  <text x="300" y="405" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.5)">TRADES</text>
  <text x="300" y="435" font-family="Arial Black" font-size="32" fill="white">${trades}</text>

  <text x="550" y="405" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.5)">VOLUME</text>
  <text x="550" y="435" font-family="Arial Black" font-size="32" fill="white">${volume.toFixed(3)} SOL</text>

  <!-- Bottom tagline -->
  <line x1="50" y1="460" x2="950" y2="460" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  <text x="50" y="495" font-family="Arial" font-style="italic" font-size="16" fill="rgba(255,255,255,0.4)">Always Watching. Always First.</text>
  <text x="950" y="495" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.3)" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;
}

async function test() {
  const svg = generateCardSVG({
    username: 'Fazle',
    rankName: 'Degen',
    rankNum: 1,
    period: 'today',
    pnlSol: 2.450,
    pnlUsd: 367.50,
    trades: 47,
    winRate: 68,
    volume: 0.5
  });
  
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  require('fs').writeFileSync('/tmp/hawkx_card.png', buf);
  console.log('Card generated! Size:', buf.length, 'bytes');
}

test().catch(e => console.log('Error:', e.message));
