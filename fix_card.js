const sharp = require('sharp');
const path = require('path');
const { Bot } = require('grammy');
const { InputFile } = require('grammy');
const config = require('./config');

async function test() {
  const bg = sharp('src/assets/cards/profit_7.png');
  const { width: W, height: H } = await bg.metadata();

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- Strong dark overlay -->
  <rect width="${W}" height="${H}" fill="rgba(0,0,0,0.68)"/>

  <!-- Top orange border -->
  <rect width="${W}" height="5" fill="#F5A623"/>
  <rect y="${H-5}" width="${W}" height="5" fill="#F5A623"/>
  <rect x="0" y="0" width="4" height="${H}" fill="#F5A623" opacity="0.7"/>

  <!-- Header bg -->
  <rect width="${W}" height="95" fill="rgba(0,0,0,0.4)"/>

  <!-- HAWKX -->
  <text x="50" y="65" font-family="Arial Black" font-size="34" fill="#F5A623" letter-spacing="4">HAWKX</text>

  <!-- Username + Rank -->
  <text x="${W-50}" y="45" font-family="Arial" font-size="19" fill="rgba(255,255,255,0.8)" text-anchor="end">@Fazle</text>
  <text x="${W-50}" y="72" font-family="Arial Black" font-size="21" fill="#aaaaaa" text-anchor="end">DEGEN (1/7)</text>

  <!-- Divider -->
  <line x1="50" y1="92" x2="${W-50}" y2="92" stroke="#F5A623" stroke-width="1" opacity="0.5"/>

  <!-- Period -->
  <text x="50" y="130" font-family="Arial" font-size="17" fill="rgba(255,255,255,0.5)" letter-spacing="4">TODAY'S PNL</text>

  <!-- Big PnL -->
  <text x="50" y="245" font-family="Arial Black" font-size="90" fill="#00ff88">▲ +2.450 SOL</text>

  <!-- % and USD same line -->
  <text x="55" y="292" font-family="Arial Black" font-size="30" fill="#00ff88">+245.0%</text>
  <text x="280" y="292" font-family="Arial" font-size="26" fill="rgba(255,255,255,0.6)">+$367.50</text>

  <!-- Divider -->
  <line x1="50" y1="315" x2="${W-50}" y2="315" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

  <!-- Stats row 1 -->
  <text x="50" y="352" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.45)" letter-spacing="2">WIN RATE</text>
  <text x="50" y="395" font-family="Arial Black" font-size="44" fill="white">68%</text>

  <text x="280" y="352" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.45)" letter-spacing="2">TRADES</text>
  <text x="280" y="395" font-family="Arial Black" font-size="44" fill="white">47</text>

  <text x="510" y="352" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.45)" letter-spacing="2">VOLUME</text>
  <text x="510" y="395" font-family="Arial Black" font-size="44" fill="white">0.50 SOL</text>

  <!-- Stats row 2 - Week/Month -->
  <line x1="50" y1="415" x2="${W-50}" y2="415" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  
  <text x="50" y="440" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.4)" letter-spacing="2">THIS WEEK</text>
  <text x="50" y="468" font-family="Arial Black" font-size="28" fill="#00ff88">+5.23 SOL</text>

  <text x="280" y="440" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.4)" letter-spacing="2">THIS MONTH</text>
  <text x="280" y="468" font-family="Arial Black" font-size="28" fill="#00ff88">+12.44 SOL</text>

  <!-- Rank progress -->
  <line x1="50" y1="488" x2="${W-50}" y2="488" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="50" y="510" font-family="Arial" font-size="13" fill="rgba(255,255,255,0.35)" letter-spacing="2">RANK PROGRESS → FLIPPER</text>
  <rect x="50" y="520" width="600" height="10" rx="5" fill="rgba(255,255,255,0.1)"/>
  <rect x="50" y="520" width="30" height="10" rx="5" fill="#aaaaaa"/>
  <text x="665" y="530" font-family="Arial" font-size="13" fill="#aaaaaa">5%</text>

  <!-- Bottom -->
  <text x="50" y="${H-18}" font-family="Arial" font-style="italic" font-size="15" fill="rgba(255,255,255,0.3)">Always Watching. Always First.</text>
  <text x="${W-50}" y="${H-18}" font-family="Arial" font-size="15" fill="rgba(255,165,0,0.4)" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

  const buf = await bg
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();

  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
  await bot.api.sendPhoto(config.ADMIN_IDS[0], new InputFile(buf, 'card.png'));
  console.log('Sent!');
  process.exit(0);
}

test().catch(e => { console.log('Error:', e.message); process.exit(1); });
