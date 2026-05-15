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

  <!-- Top/Bottom orange border -->
  <rect width="${W}" height="5" fill="#F5A623"/>
  <rect y="${H-5}" width="${W}" height="5" fill="#F5A623"/>
  <rect x="0" y="0" width="4" height="${H}" fill="#F5A623" opacity="0.7"/>
  <rect x="${W-4}" y="0" width="4" height="${H}" fill="#F5A623" opacity="0.7"/>

  <!-- Header -->
  <rect width="${W}" height="95" fill="rgba(0,0,0,0.45)"/>
  <text x="50" y="65" font-family="Arial Black" font-size="34" fill="#F5A623" letter-spacing="4">HAWKX</text>
  <text x="${W-50}" y="45" font-family="Arial" font-size="19" fill="rgba(255,255,255,0.8)" text-anchor="end">@Fazle</text>
  <text x="${W-50}" y="72" font-family="Arial Black" font-size="21" fill="#9945FF" text-anchor="end">DEGEN (1/7)</text>
  <line x1="50" y1="92" x2="${W-50}" y2="92" stroke="#F5A623" stroke-width="1" opacity="0.5"/>

  <!-- Period -->
  <text x="50" y="130" font-family="Arial" font-size="17" fill="#9945FF" letter-spacing="4">TODAY'S PNL</text>

  <!-- Big PnL -->
  <text x="50" y="245" font-family="Arial Black" font-size="90" fill="#14F195">▲ +2.450 SOL</text>
  <text x="55" y="292" font-family="Arial Black" font-size="30" fill="#14F195">+245.0%</text>
  <text x="280" y="292" font-family="Arial" font-size="26" fill="#F5A623">+$367.50</text>

  <!-- Divider -->
  <line x1="50" y1="315" x2="${W-50}" y2="315" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

  <!-- LEFT stats column -->
  <text x="50" y="352" font-family="Arial" font-size="14" fill="#9945FF" letter-spacing="2">WIN RATE</text>
  <text x="50" y="398" font-family="Arial Black" font-size="44" fill="white">68%</text>

  <text x="50" y="435" font-family="Arial" font-size="14" fill="#9945FF" letter-spacing="2">TRADES</text>
  <text x="50" y="475" font-family="Arial Black" font-size="38" fill="white">47</text>

  <text x="50" y="505" font-family="Arial" font-size="14" fill="#9945FF" letter-spacing="2">VOLUME</text>
  <text x="50" y="545" font-family="Arial Black" font-size="38" fill="white">0.50 SOL</text>

  <!-- CENTER divider -->
  <line x1="${W/2}" y1="315" x2="${W/2}" y2="560" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

  <!-- RIGHT stats column -->
  <text x="${W/2 + 50}" y="352" font-family="Arial" font-size="14" fill="#9945FF" letter-spacing="2">THIS WEEK</text>
  <text x="${W/2 + 50}" y="398" font-family="Arial Black" font-size="44" fill="#14F195">+5.23 SOL</text>

  <text x="${W/2 + 50}" y="435" font-family="Arial" font-size="14" fill="#9945FF" letter-spacing="2">THIS MONTH</text>
  <text x="${W/2 + 50}" y="475" font-family="Arial Black" font-size="38" fill="#14F195">+12.44 SOL</text>

  <text x="${W/2 + 50}" y="505" font-family="Arial" font-size="14" fill="#9945FF" letter-spacing="2">ALL TIME VOL</text>
  <text x="${W/2 + 50}" y="545" font-family="Arial Black" font-size="38" fill="#F5A623">0.50 SOL</text>

  <!-- Rank progress -->
  <line x1="50" y1="562" x2="${W-50}" y2="562" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="50" y="582" font-family="Arial" font-size="13" fill="#9945FF" letter-spacing="2">RANK PROGRESS → FLIPPER</text>
  <rect x="50" y="592" width="${W-100}" height="10" rx="5" fill="rgba(255,255,255,0.1)"/>
  <rect x="50" y="592" width="${(W-100)*0.05}" height="10" rx="5" fill="#9945FF"/>
  <text x="${50 + (W-100)*0.05 + 10}" y="602" font-family="Arial" font-size="13" fill="#9945FF">5%</text>

  <!-- Bottom -->
  <text x="50" y="${H-18}" font-family="Arial" font-style="italic" font-size="15" fill="rgba(255,255,255,0.3)">Always Watching. Always First.</text>
  <text x="${W-50}" y="${H-18}" font-family="Arial" font-size="15" fill="rgba(255,165,0,0.45)" text-anchor="end">t.me/HawkX_Trade_Bot</text>
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
