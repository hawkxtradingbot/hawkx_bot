const sharp = require('sharp');
const { Bot } = require('grammy');
const { InputFile } = require('grammy');
const config = require('./config');

function getMemeText(pnlPct) {
  if (pnlPct >= 500) return "LEGENDARY. ABSOLUTE HAWK 🦅👑";
  if (pnlPct >= 200) return "WE'RE SO BACK 🚀🚀🚀";
  if (pnlPct >= 100) return "WAGMI BRO 💎🙌";
  if (pnlPct >= 50)  return "Nice trade, hawk 🦅";
  if (pnlPct >= 20)  return "Steady gains 💪";
  if (pnlPct >= 5)   return "Small wins add up 🎯";
  if (pnlPct >= 0)   return "Green is green 🟢";
  if (pnlPct >= -10) return "It's fine... 😅";
  if (pnlPct >= -30) return "We take those losses 😬";
  if (pnlPct >= -50) return "NGMI... or are we? 💀";
  if (pnlPct >= -80) return "Absolute rekt 😭";
  return "This is fine 🔥🔥🔥";
}

async function test() {
  const pnlPct = 245;
  const isProfit = pnlPct >= 0;
  const bgFile = isProfit ? 'profit_4.png' : 'loss_4.png';
  
  const bg = sharp(`src/assets/cards/${bgFile}`);
  const { width: W, height: H } = await bg.metadata();
  const panelW = Math.floor(W * 0.58);
  const memeText = getMemeText(pnlPct);

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  
  <!-- Left dark panel only -->
  <rect width="${panelW}" height="${H}" fill="rgba(0,0,0,0.88)"/>
  
  <!-- Right side subtle dark -->
  <rect x="${panelW}" width="${W-panelW}" height="${H}" fill="rgba(0,0,0,0.25)"/>

  <!-- Top/Bottom/Left borders -->
  <rect width="${W}" height="5" fill="#F5A623"/>
  <rect y="${H-5}" width="${W}" height="5" fill="#F5A623"/>
  <rect x="0" y="0" width="4" height="${H}" fill="#F5A623" opacity="0.8"/>
  <rect x="${W-4}" y="0" width="4" height="${H}" fill="#F5A623" opacity="0.8"/>

  <!-- Header bar -->
  <rect width="${panelW}" height="88" fill="rgba(0,0,0,0.5)"/>
  <text x="40" y="58" font-family="Arial Black" font-size="32" fill="#F5A623" letter-spacing="4">HAWKX</text>
  <line x1="40" y1="82" x2="${panelW-20}" y2="82" stroke="#F5A623" stroke-width="1" opacity="0.4"/>

  <!-- Username top right of panel -->
  <text x="${panelW-20}" y="40" font-family="Arial" font-size="17" fill="white" text-anchor="end">@Fazle</text>
  <text x="${panelW-20}" y="65" font-family="Arial Black" font-size="18" fill="#F5A623" text-anchor="end">DEGEN (1/7)</text>

  <!-- Token name -->
  <text x="40" y="135" font-family="Arial" font-size="15" fill="#E8720C" letter-spacing="3">TRADE CLOSED</text>
  <text x="40" y="185" font-family="Arial Black" font-size="54" fill="white">BONK</text>

  <!-- Big PnL -->
  <text x="40" y="285" font-family="Arial Black" font-size="76" fill="#14F195">▲ +2.450 SOL</text>
  <text x="42" y="328" font-family="Arial Black" font-size="32" fill="#14F195">+245.0%</text>
  <text x="240" y="328" font-family="Arial" font-size="26" fill="#F5A623">+$367.50</text>

  <!-- Meme text -->
  <text x="40" y="375" font-family="Arial Black" font-size="22" fill="white">${memeText}</text>

  <line x1="40" y1="398" x2="${panelW-20}" y2="398" stroke="#F5A623" stroke-width="1" opacity="0.2"/>

  <!-- Entry/Exit -->
  <text x="40" y="430" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">ENTRY MCAP</text>
  <text x="40" y="462" font-family="Arial Black" font-size="32" fill="white">$50K</text>

  <text x="220" y="430" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">EXIT MCAP</text>
  <text x="220" y="462" font-family="Arial Black" font-size="32" fill="white">$245K</text>

  <text x="400" y="430" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">INVESTED</text>
  <text x="400" y="462" font-family="Arial Black" font-size="32" fill="white">0.10 SOL</text>

  <line x1="40" y1="480" x2="${panelW-20}" y2="480" stroke="#F5A623" stroke-width="1" opacity="0.2"/>

  <!-- Returned -->
  <text x="40" y="510" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">RETURNED</text>
  <text x="40" y="545" font-family="Arial Black" font-size="38" fill="#14F195">2.55 SOL</text>

  <!-- Bottom tagline -->
  <line x1="40" y1="565" x2="${panelW-20}" y2="565" stroke="#F5A623" stroke-width="1" opacity="0.15"/>
  <text x="40" y="${H-20}" font-family="Arial" font-style="italic" font-size="14" fill="rgba(255,255,255,0.35)">Always Watching. Always First. 🦅</text>
  <text x="40" y="${H-4}" font-family="Arial" font-size="13" fill="#F5A623" opacity="0.5">t.me/HawkX_Trade_Bot</text>
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
