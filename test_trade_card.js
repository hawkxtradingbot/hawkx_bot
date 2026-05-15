const sharp = require('sharp');
const { Bot } = require('grammy');
const { InputFile } = require('grammy');
const config = require('./config');

async function test() {
  const bg = sharp('src/assets/cards/profit_4.png');
  const { width: W, height: H } = await bg.metadata();

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="rgba(0,0,0,0.78)"/>
  <rect width="${W}" height="5" fill="#F5A623"/>
  <rect y="${H-5}" width="${W}" height="5" fill="#F5A623"/>
  <rect x="0" y="0" width="4" height="${H}" fill="#F5A623" opacity="0.7"/>
  <rect x="${W-4}" y="0" width="4" height="${H}" fill="#F5A623" opacity="0.7"/>

  <!-- Header -->
  <rect width="${W}" height="95" fill="rgba(0,0,0,0.5)"/>
  <text x="50" y="65" font-family="Arial Black" font-size="34" fill="#F5A623" letter-spacing="4">HAWKX</text>
  <text x="${W-50}" y="45" font-family="Arial" font-size="19" fill="white" text-anchor="end">@Fazle</text>
  <text x="${W-50}" y="72" font-family="Arial Black" font-size="21" fill="#F5A623" text-anchor="end">DEGEN (1/7)</text>
  <line x1="50" y1="92" x2="${W-50}" y2="92" stroke="#F5A623" stroke-width="1" opacity="0.5"/>

  <!-- Token name -->
  <text x="50" y="140" font-family="Arial" font-size="17" fill="#E8720C" letter-spacing="4">TRADE CLOSED</text>
  <text x="50" y="185" font-family="Arial Black" font-size="52" fill="white">BONK</text>

  <!-- Big PnL -->
  <text x="50" y="300" font-family="Arial Black" font-size="90" fill="#14F195">▲ +2.450 SOL</text>
  <text x="55" y="348" font-family="Arial Black" font-size="34" fill="#14F195">+245.0%</text>
  <text x="300" y="348" font-family="Arial" font-size="28" fill="#F5A623">+$367.50</text>

  <line x1="50" y1="372" x2="${W-50}" y2="372" stroke="#F5A623" stroke-width="1" opacity="0.2"/>

  <!-- Entry/Exit mcap -->
  <text x="50" y="412" font-family="Arial" font-size="14" fill="#E8720C" letter-spacing="2">ENTRY MCAP</text>
  <text x="50" y="452" font-family="Arial Black" font-size="38" fill="white">$50K</text>

  <text x="280" y="412" font-family="Arial" font-size="14" fill="#E8720C" letter-spacing="2">EXIT MCAP</text>
  <text x="280" y="452" font-family="Arial Black" font-size="38" fill="white">$245K</text>

  <text x="510" y="412" font-family="Arial" font-size="14" fill="#E8720C" letter-spacing="2">INVESTED</text>
  <text x="510" y="452" font-family="Arial Black" font-size="38" fill="white">0.10 SOL</text>

  <text x="780" y="412" font-family="Arial" font-size="14" fill="#E8720C" letter-spacing="2">RETURNED</text>
  <text x="780" y="452" font-family="Arial Black" font-size="38" fill="#14F195">2.55 SOL</text>

  <!-- Bottom -->
  <line x1="50" y1="475" x2="${W-50}" y2="475" stroke="#F5A623" stroke-width="1" opacity="0.2"/>
  <text x="50" y="${H-18}" font-family="Arial" font-style="italic" font-size="15" fill="rgba(255,255,255,0.4)">Always Watching. Always First.</text>
  <text x="${W-50}" y="${H-18}" font-family="Arial" font-size="15" fill="#F5A623" opacity="0.6" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

  const buf = await bg
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();

  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
  await bot.api.sendPhoto(config.ADMIN_IDS[0], new InputFile(buf, 'trade_card.png'));
  console.log('Sent!');
  process.exit(0);
}

test().catch(e => { console.log('Error:', e.message); process.exit(1); });
