const sharp = require('sharp');
const { Bot } = require('grammy');
const { InputFile } = require('grammy');
const config = require('./config');

async function test() {
  const W = 1000, H = 560;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgC" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0d00"/>
      <stop offset="50%" style="stop-color:#0a0d14"/>
      <stop offset="100%" style="stop-color:#1a0d00"/>
    </linearGradient>
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#F5A623"/>
      <stop offset="100%" style="stop-color:#E8720C"/>
    </linearGradient>
    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#14F195"/>
      <stop offset="100%" style="stop-color:#00cc77"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bgC)"/>

  <!-- Background decorative elements -->
  <!-- Large circle glow top right -->
  <circle cx="820" cy="150" r="200" fill="rgba(245,166,35,0.06)"/>
  <!-- Small circle bottom left -->
  <circle cx="150" cy="450" r="120" fill="rgba(20,241,149,0.04)"/>
  <!-- Grid lines subtle -->
  <line x1="0" y1="180" x2="${W}" y2="180" stroke="rgba(245,166,35,0.05)" stroke-width="1"/>
  <line x1="0" y1="390" x2="${W}" y2="390" stroke="rgba(245,166,35,0.05)" stroke-width="1"/>
  <line x1="500" y1="0" x2="500" y2="${H}" stroke="rgba(245,166,35,0.05)" stroke-width="1"/>
  <!-- Diagonal accent lines -->
  <line x1="600" y1="0" x2="${W}" y2="300" stroke="rgba(245,166,35,0.04)" stroke-width="1"/>
  <line x1="700" y1="0" x2="${W}" y2="200" stroke="rgba(245,166,35,0.04)" stroke-width="1"/>

  <!-- Orange gradient strips top/bottom -->
  <rect width="${W}" height="55" fill="url(#orangeGrad)" opacity="0.12"/>
  <rect y="505" width="${W}" height="55" fill="url(#orangeGrad)" opacity="0.12"/>

  <!-- Borders -->
  <rect width="${W}" height="5" fill="url(#orangeGrad)"/>
  <rect y="555" width="${W}" height="5" fill="url(#orangeGrad)"/>
  <rect width="4" height="${H}" fill="url(#orangeGrad)"/>
  <rect x="996" width="4" height="${H}" fill="url(#orangeGrad)"/>

  <!-- Header -->
  <text x="40" y="52" font-family="Arial Black" font-size="30" fill="#F5A623" letter-spacing="6">H A W K X</text>
  <text x="960" y="36" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.8)" text-anchor="end">@Fazle</text>
  <text x="960" y="60" font-family="Arial Black" font-size="18" fill="#F5A623" text-anchor="end">DEGEN (1/7)</text>
  <line x1="40" y1="78" x2="960" y2="78" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.4"/>

  <!-- Trade label + Token -->
  <text x="40" y="118" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="4">TRADE CLOSED</text>
  <text x="40" y="172" font-family="Arial Black" font-size="54" fill="white">BONK</text>

  <!-- Big PnL - NO GLOW, sharp text -->
  <text x="40" y="278" font-family="Arial Black" font-size="80" fill="url(#greenGrad)">▲ +2.450 SOL</text>
  <text x="42" y="322" font-family="Arial Black" font-size="30" fill="#14F195">+245.0%</text>
  <text x="248" y="322" font-family="Arial" font-size="24" fill="#F5A623">+$367.50</text>

  <!-- Meme text -->
  <text x="42" y="360" font-family="Arial Black" font-size="19" fill="rgba(255,255,255,0.75)">WE ARE SO BACK 🚀🚀🚀</text>

  <line x1="40" y1="378" x2="960" y2="378" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.2"/>

  <!-- Stats row -->
  <text x="40" y="410" font-family="Arial" font-size="12" fill="#E8720C" letter-spacing="3">ENTRY</text>
  <text x="40" y="445" font-family="Arial Black" font-size="34" fill="white">$50K</text>

  <text x="190" y="410" font-family="Arial" font-size="12" fill="#E8720C" letter-spacing="3">EXIT</text>
  <text x="190" y="445" font-family="Arial Black" font-size="34" fill="white">$245K</text>

  <text x="370" y="410" font-family="Arial" font-size="12" fill="#E8720C" letter-spacing="3">INVESTED</text>
  <text x="370" y="445" font-family="Arial Black" font-size="34" fill="white">0.10 SOL</text>

  <text x="600" y="410" font-family="Arial" font-size="12" fill="#E8720C" letter-spacing="3">RETURNED</text>
  <text x="600" y="445" font-family="Arial Black" font-size="34" fill="url(#greenGrad)">2.55 SOL</text>

  <!-- QR Code placeholder (simple box with link) -->
  <rect x="840" y="390" width="110" height="110" rx="8" fill="white"/>
  <rect x="848" y="398" width="94" height="94" rx="4" fill="black"/>
  <!-- QR pattern simulation -->
  <rect x="855" y="405" width="22" height="22" fill="white" rx="2"/>
  <rect x="858" y="408" width="16" height="16" fill="black" rx="1"/>
  <rect x="861" y="411" width="10" height="10" fill="white"/>
  <rect x="903" y="405" width="22" height="22" fill="white" rx="2"/>
  <rect x="906" y="408" width="16" height="16" fill="black" rx="1"/>
  <rect x="909" y="411" width="10" height="10" fill="white"/>
  <rect x="855" y="453" width="22" height="22" fill="white" rx="2"/>
  <rect x="858" y="456" width="16" height="16" fill="black" rx="1"/>
  <rect x="861" y="459" width="10" height="10" fill="white"/>
  <!-- QR dots -->
  <rect x="883" y="408" width="4" height="4" fill="white"/>
  <rect x="890" y="412" width="4" height="4" fill="white"/>
  <rect x="883" y="420" width="4" height="4" fill="white"/>
  <rect x="895" y="418" width="4" height="4" fill="white"/>
  <rect x="885" y="435" width="4" height="4" fill="white"/>
  <rect x="893" y="428" width="4" height="4" fill="white"/>
  <rect x="878" y="445" width="4" height="4" fill="white"/>
  <rect x="900" y="440" width="4" height="4" fill="white"/>
  <rect x="910" y="455" width="4" height="4" fill="white"/>
  <rect x="918" y="448" width="4" height="4" fill="white"/>
  <text x="895" y="516" font-family="Arial" font-size="9" fill="rgba(255,255,255,0.5)" text-anchor="middle">SCAN ME</text>

  <!-- Bottom -->
  <line x1="40" y1="468" x2="820" y2="468" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.15"/>
  <text x="40" y="520" font-family="Arial" font-style="italic" font-size="14" fill="rgba(255,255,255,0.35)">Always Watching. Always First. 🦅</text>
  <text x="40" y="542" font-family="Arial" font-size="13" fill="#F5A623" opacity="0.5">t.me/HawkX_Trade_Bot</text>
</svg>`;

  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
  await bot.api.sendPhoto(config.ADMIN_IDS[0], new InputFile(buf, 'card_c2.png'));
  console.log('Sent!');
  process.exit(0);
}

test().catch(e => { console.log('Error:', e.message); process.exit(1); });
