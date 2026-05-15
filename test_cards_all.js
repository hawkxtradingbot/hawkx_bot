const sharp = require('sharp');
const { Bot } = require('grammy');
const { InputFile } = require('grammy');
const config = require('./config');

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

async function sendCard(svgContent, name) {
  const W = 1000, H = 560;
  const buf = await sharp(Buffer.from(svgContent)).png().toBuffer();
  await bot.api.sendPhoto(config.ADMIN_IDS[0], new InputFile(buf, `${name}.png`), { caption: `Style: ${name}` });
  await new Promise(r => setTimeout(r, 800));
}

// ── OPTION A — Dark Gradient ──────────────────────────────────
const svgA = `<svg width="1000" height="560" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgA" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0e1a"/>
      <stop offset="100%" style="stop-color:#1a1208"/>
    </linearGradient>
    <linearGradient id="pnlA" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#14F195"/>
      <stop offset="100%" style="stop-color:#00cc77"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="560" fill="url(#bgA)"/>
  <rect width="1000" height="5" fill="#F5A623"/>
  <rect y="555" width="1000" height="5" fill="#F5A623"/>
  <rect width="4" height="560" fill="#F5A623"/>
  <rect x="996" width="4" height="560" fill="#F5A623"/>
  <rect width="1000" height="88" fill="rgba(245,166,35,0.08)"/>
  <text x="40" y="58" font-family="Arial Black" font-size="32" fill="#F5A623" letter-spacing="5">HAWKX</text>
  <text x="960" y="42" font-family="Arial" font-size="17" fill="rgba(255,255,255,0.8)" text-anchor="end">@Fazle</text>
  <text x="960" y="68" font-family="Arial Black" font-size="19" fill="#F5A623" text-anchor="end">DEGEN (1/7)</text>
  <line x1="40" y1="85" x2="960" y2="85" stroke="#F5A623" stroke-width="1" opacity="0.3"/>
  <text x="40" y="128" font-family="Arial" font-size="14" fill="#E8720C" letter-spacing="4">TRADE CLOSED</text>
  <text x="40" y="178" font-family="Arial Black" font-size="52" fill="white">BONK</text>
  <text x="40" y="290" font-family="Arial Black" font-size="82" fill="url(#pnlA)">▲ +2.450 SOL</text>
  <text x="42" y="335" font-family="Arial Black" font-size="30" fill="#14F195">+245.0%</text>
  <text x="250" y="335" font-family="Arial" font-size="24" fill="#F5A623">+$367.50</text>
  <text x="42" y="372" font-family="Arial Black" font-size="20" fill="rgba(255,255,255,0.7)">WE'RE SO BACK 🚀🚀🚀</text>
  <line x1="40" y1="392" x2="960" y2="392" stroke="#F5A623" stroke-width="1" opacity="0.2"/>
  <text x="40" y="425" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">ENTRY</text>
  <text x="40" y="458" font-family="Arial Black" font-size="34" fill="white">$50K</text>
  <text x="200" y="425" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">EXIT</text>
  <text x="200" y="458" font-family="Arial Black" font-size="34" fill="white">$245K</text>
  <text x="380" y="425" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">INVESTED</text>
  <text x="380" y="458" font-family="Arial Black" font-size="34" fill="white">0.10 SOL</text>
  <text x="620" y="425" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">RETURNED</text>
  <text x="620" y="458" font-family="Arial Black" font-size="34" fill="#14F195">2.55 SOL</text>
  <line x1="40" y1="478" x2="960" y2="478" stroke="#F5A623" stroke-width="1" opacity="0.15"/>
  <text x="40" y="535" font-family="Arial" font-style="italic" font-size="14" fill="rgba(255,255,255,0.35)">Always Watching. Always First. 🦅</text>
  <text x="960" y="535" font-family="Arial" font-size="14" fill="#F5A623" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

// ── OPTION B — Neon Dark ──────────────────────────────────────
const svgB = `<svg width="1000" height="560" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <linearGradient id="neonGreen" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#14F195"/>
      <stop offset="100%" style="stop-color:#00ff88"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="560" fill="#000000"/>
  <rect width="1000" height="3" fill="#14F195"/>
  <rect y="557" width="1000" height="3" fill="#14F195"/>
  <rect width="3" height="560" fill="#14F195"/>
  <rect x="997" width="3" height="560" fill="#14F195"/>
  <rect x="3" y="3" width="994" height="554" fill="none" stroke="#14F195" stroke-width="1" opacity="0.2"/>
  <text x="40" y="58" font-family="Arial Black" font-size="32" fill="#14F195" letter-spacing="5" filter="url(#glow)">HAWKX</text>
  <text x="960" y="42" font-family="Arial" font-size="17" fill="rgba(255,255,255,0.8)" text-anchor="end">@Fazle</text>
  <text x="960" y="68" font-family="Arial Black" font-size="19" fill="#14F195" text-anchor="end">DEGEN (1/7)</text>
  <line x1="40" y1="85" x2="960" y2="85" stroke="#14F195" stroke-width="1" opacity="0.3"/>
  <text x="40" y="128" font-family="Arial" font-size="14" fill="rgba(20,241,149,0.6)" letter-spacing="4">TRADE CLOSED</text>
  <text x="40" y="178" font-family="Arial Black" font-size="52" fill="white">BONK</text>
  <text x="40" y="290" font-family="Arial Black" font-size="82" fill="url(#neonGreen)" filter="url(#glow)">▲ +2.450 SOL</text>
  <text x="42" y="335" font-family="Arial Black" font-size="30" fill="#14F195">+245.0%</text>
  <text x="250" y="335" font-family="Arial" font-size="24" fill="rgba(255,255,255,0.6)">+$367.50</text>
  <text x="42" y="372" font-family="Arial Black" font-size="20" fill="rgba(255,255,255,0.8)">WE'RE SO BACK 🚀🚀🚀</text>
  <line x1="40" y1="392" x2="960" y2="392" stroke="#14F195" stroke-width="1" opacity="0.2"/>
  <text x="40" y="425" font-family="Arial" font-size="13" fill="rgba(20,241,149,0.6)" letter-spacing="2">ENTRY</text>
  <text x="40" y="458" font-family="Arial Black" font-size="34" fill="white">$50K</text>
  <text x="200" y="425" font-family="Arial" font-size="13" fill="rgba(20,241,149,0.6)" letter-spacing="2">EXIT</text>
  <text x="200" y="458" font-family="Arial Black" font-size="34" fill="white">$245K</text>
  <text x="380" y="425" font-family="Arial" font-size="13" fill="rgba(20,241,149,0.6)" letter-spacing="2">INVESTED</text>
  <text x="380" y="458" font-family="Arial Black" font-size="34" fill="white">0.10 SOL</text>
  <text x="620" y="425" font-family="Arial" font-size="13" fill="rgba(20,241,149,0.6)" letter-spacing="2">RETURNED</text>
  <text x="620" y="458" font-family="Arial Black" font-size="34" fill="#14F195" filter="url(#glow)">2.55 SOL</text>
  <line x1="40" y1="478" x2="960" y2="478" stroke="#14F195" stroke-width="1" opacity="0.15"/>
  <text x="40" y="535" font-family="Arial" font-style="italic" font-size="14" fill="rgba(255,255,255,0.35)">Always Watching. Always First. 🦅</text>
  <text x="960" y="535" font-family="Arial" font-size="14" fill="#14F195" opacity="0.5" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

// ── OPTION C — HawkX Branded ──────────────────────────────────
const svgC = `<svg width="1000" height="560" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgC" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1a0f00"/>
      <stop offset="40%" style="stop-color:#0d1117"/>
      <stop offset="100%" style="stop-color:#1a0f00"/>
    </linearGradient>
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#F5A623"/>
      <stop offset="100%" style="stop-color:#E8720C"/>
    </linearGradient>
    <filter id="glowC">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <rect width="1000" height="560" fill="url(#bgC)"/>
  <!-- Orange gradient top strip -->
  <rect width="1000" height="60" fill="url(#orangeGrad)" opacity="0.15"/>
  <!-- Orange gradient bottom strip -->
  <rect y="500" width="1000" height="60" fill="url(#orangeGrad)" opacity="0.15"/>
  <!-- Borders -->
  <rect width="1000" height="5" fill="url(#orangeGrad)"/>
  <rect y="555" width="1000" height="5" fill="url(#orangeGrad)"/>
  <rect width="4" height="560" fill="url(#orangeGrad)"/>
  <rect x="996" width="4" height="560" fill="url(#orangeGrad)"/>
  <!-- Hawk watermark SVG shape -->
  <text x="750" y="420" font-family="Arial Black" font-size="280" fill="rgba(245,166,35,0.04)" text-anchor="middle">🦅</text>
  <!-- Header -->
  <text x="40" y="55" font-family="Arial Black" font-size="32" fill="url(#orangeGrad)" letter-spacing="5">HAWKX</text>
  <text x="960" y="38" font-family="Arial" font-size="17" fill="rgba(255,255,255,0.85)" text-anchor="end">@Fazle</text>
  <text x="960" y="64" font-family="Arial Black" font-size="19" fill="#F5A623" text-anchor="end">DEGEN (1/7)</text>
  <line x1="40" y1="82" x2="960" y2="82" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.4"/>
  <text x="40" y="125" font-family="Arial" font-size="14" fill="#E8720C" letter-spacing="4">TRADE CLOSED</text>
  <text x="40" y="178" font-family="Arial Black" font-size="52" fill="white">BONK</text>
  <text x="40" y="288" font-family="Arial Black" font-size="82" fill="#14F195" filter="url(#glowC)">▲ +2.450 SOL</text>
  <text x="42" y="332" font-family="Arial Black" font-size="30" fill="#14F195">+245.0%</text>
  <text x="250" y="332" font-family="Arial" font-size="24" fill="#F5A623">+$367.50</text>
  <text x="42" y="370" font-family="Arial Black" font-size="20" fill="rgba(255,255,255,0.75)">WE'RE SO BACK 🚀🚀🚀</text>
  <line x1="40" y1="390" x2="960" y2="390" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.25"/>
  <text x="40" y="422" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">ENTRY</text>
  <text x="40" y="455" font-family="Arial Black" font-size="34" fill="white">$50K</text>
  <text x="200" y="422" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">EXIT</text>
  <text x="200" y="455" font-family="Arial Black" font-size="34" fill="white">$245K</text>
  <text x="380" y="422" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">INVESTED</text>
  <text x="380" y="455" font-family="Arial Black" font-size="34" fill="white">0.10 SOL</text>
  <text x="620" y="422" font-family="Arial" font-size="13" fill="#E8720C" letter-spacing="2">RETURNED</text>
  <text x="620" y="455" font-family="Arial Black" font-size="34" fill="#14F195">2.55 SOL</text>
  <line x1="40" y1="475" x2="960" y2="475" stroke="url(#orangeGrad)" stroke-width="1" opacity="0.2"/>
  <text x="40" y="532" font-family="Arial" font-style="italic" font-size="14" fill="rgba(255,255,255,0.35)">Always Watching. Always First. 🦅</text>
  <text x="960" y="532" font-family="Arial" font-size="14" fill="#F5A623" opacity="0.55" text-anchor="end">t.me/HawkX_Trade_Bot</text>
</svg>`;

async function main() {
  await sendCard(svgA, 'A - Dark Gradient');
  await sendCard(svgB, 'B - Neon Dark');
  await sendCard(svgC, 'C - HawkX Branded');
  console.log('All 3 sent!');
  process.exit(0);
}

main().catch(e => { console.log('Error:', e.message); process.exit(1); });
