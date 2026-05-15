const sharp = require('sharp');
const path = require('path');

async function test() {
  // Load background image
  const bg = sharp('src/assets/cards/profit_1.png');
  const { width, height } = await bg.metadata();
  console.log('Image size:', width, 'x', height);

  // Create SVG overlay (transparent background, just text)
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <!-- Dark overlay for readability -->
    <rect width="${width}" height="${height}" fill="rgba(0,0,0,0.55)"/>
    
    <!-- Top border orange -->
    <rect width="${width}" height="5" fill="#F5A623"/>
    
    <!-- HawkX branding -->
    <text x="60" y="70" font-family="Arial Black" font-size="36" fill="#F5A623" letter-spacing="3">HAWKX</text>
    <text x="${width-60}" y="70" font-family="Arial" font-size="20" fill="rgba(255,255,255,0.6)" text-anchor="end">@Fazle · DEGEN (1/7)</text>
    
    <!-- Divider -->
    <line x1="60" y1="90" x2="${width-60}" y2="90" stroke="rgba(255,165,0,0.3)" stroke-width="1"/>
    
    <!-- Period -->
    <text x="60" y="150" font-family="Arial" font-size="20" fill="rgba(255,255,255,0.6)" letter-spacing="4">TODAY'S PNL</text>
    
    <!-- Big PnL -->
    <text x="60" y="280" font-family="Arial Black" font-size="90" fill="#00ff88">▲ +2.450 SOL</text>
    
    <!-- USD -->
    <text x="60" y="340" font-family="Arial" font-size="30" fill="rgba(255,255,255,0.7)">+$367.50</text>
    
    <!-- Stats row -->
    <line x1="60" y1="390" x2="${width-60}" y2="390" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <text x="60" y="430" font-family="Arial" font-size="18" fill="rgba(255,255,255,0.5)">WIN RATE</text>
    <text x="60" y="470" font-family="Arial Black" font-size="40" fill="white">68%</text>
    
    <text x="350" y="430" font-family="Arial" font-size="18" fill="rgba(255,255,255,0.5)">TRADES</text>
    <text x="350" y="470" font-family="Arial Black" font-size="40" fill="white">47</text>
    
    <text x="640" y="430" font-family="Arial" font-size="18" fill="rgba(255,255,255,0.5)">VOLUME</text>
    <text x="640" y="470" font-family="Arial Black" font-size="40" fill="white">0.500 SOL</text>
    
    <!-- Bottom -->
    <line x1="60" y1="510" x2="${width-60}" y2="510" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <text x="60" y="545" font-family="Arial" font-style="italic" font-size="18" fill="rgba(255,255,255,0.4)">Always Watching. Always First.</text>
    <text x="${width-60}" y="545" font-family="Arial" font-size="18" fill="rgba(255,165,0,0.5)" text-anchor="end">t.me/HawkX_Trade_Bot</text>
  </svg>`;

  // Composite overlay on background
  const buf = await bg
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
  
  require('fs').writeFileSync('/tmp/hawkx_test.png', buf);
  console.log('Card generated! Size:', buf.length, 'bytes');
}

test().catch(e => console.log('Error:', e.message));
