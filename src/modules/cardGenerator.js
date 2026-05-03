// cardGenerator.js — HawkX Card Generator (image + text fallback)

const path = require("path");
const SOL_PRICE  = 150;
const CARDS_DIR  = path.join(__dirname, "../assets/cards");

const RANK_NAMES = ["","Degen","Flipper","Trader","Sniper","Whale","Shark","Hawk Elite"];
const RANK_EMOJI = ["","🎲","🔄","📊","🎯","🐋","🦈","👑"];

const PROFIT_EXPR = ["",
  "Small win. Keep stacking.",
  "Clean entry. Hawk approved.",
  "Strategy paying off.",
  "You are early. They notice now.",
  "Double. The hawk never misses.",
  "Generational trade. Screenshot.",
  "You just changed your life.",
];
const LOSS_EXPR = ["",
  "Small dip. Stay focused.",
  "Cut or hold. Your call.",
  "Every hawk takes a hit. Rise.",
  "Market humbles us all. Adapt.",
  "Pain is temporary. We reload.",
  "We don't quit. We reload.",
  "Rock bottom. Only way is up.",
];

const PROFIT_MOOD = ["","😊","😎","🤩","🔥","🚀","💎","👑"];
const LOSS_MOOD   = ["","😐","😬","😰","😭","💀","⚰️","🌑"];

function getProfitLevel(pct) {
  if (pct >= 500) return 7;
  if (pct >= 200) return 6;
  if (pct >= 100) return 5;
  if (pct >= 50)  return 4;
  if (pct >= 30)  return 3;
  if (pct >= 10)  return 2;
  return 1;
}

function getLossLevel(pct) {
  const a = Math.abs(pct);
  if (a >= 90) return 7;
  if (a >= 70) return 6;
  if (a >= 50) return 5;
  if (a >= 30) return 4;
  if (a >= 15) return 3;
  if (a >= 5)  return 2;
  return 1;
}

function formatMcap(n) {
  if (!n || n === 0) return "N/A";
  if (n >= 1_000_000_000) return `$${(n/1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n/1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n/1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

// ── Try to load card image with sharp border ─────────────────
async function loadCardImage(imgFile, isProfit) {
  const sharp = require("sharp");
  const fs    = require("fs");
  const imgPath = path.join(CARDS_DIR, imgFile);
  if (!fs.existsSync(imgPath)) return null;

  const borderColor = isProfit
    ? { r: 0, g: 200, b: 80, alpha: 1 }
    : { r: 220, g: 40, b: 40, alpha: 1 };
  const borderSize = 8;

  const meta   = await sharp(imgPath).metadata();
  const width  = meta.width  || 800;
  const height = meta.height || 600;

  const bordered = await sharp(imgPath)
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .extend({
      top: borderSize, bottom: borderSize,
      left: borderSize, right: borderSize,
      background: borderColor,
    })
    .resize(width, height)
    .png()
    .toBuffer();

  return bordered;
}

// ── Generate PnL Card ────────────────────────────────────────
async function generatePnlCard(opts) {
  const {
    username    = "Trader",
    rankNum     = 1,
    tokenName   = "TOKEN",
    pnlPct      = 0,
    pnlSol      = 0,
    entryMcap   = 0,
    exitMcap    = 0,
    hideAmounts = false,
  } = opts;

  const isProfit  = pnlPct >= 0;
  const level     = isProfit ? getProfitLevel(pnlPct) : getLossLevel(pnlPct);
  const expr      = isProfit ? PROFIT_EXPR[level] : LOSS_EXPR[level];
  const mood      = isProfit ? PROFIT_MOOD[level] : LOSS_MOOD[level];
  const sign      = isProfit ? "+" : "";
  const arrow     = isProfit ? "📈" : "📉";
  const pnlUsd    = Math.abs(pnlSol * SOL_PRICE);
  const rankName  = RANK_NAMES[rankNum] || "Degen";
  const rankEmoji = RANK_EMOJI[rankNum] || "🎲";

  const solLine = hideAmounts ? `${sign}**** SOL` : `${sign}${Math.abs(pnlSol).toFixed(4)} SOL`;
  const usdLine = hideAmounts ? `${sign}$****`    : `${sign}$${pnlUsd.toFixed(2)}`;

  // Try image card first
  try {
    const imgFile = isProfit ? `profit_${level}.png` : `loss_${level}.png`;
    const buf = await loadCardImage(imgFile, isProfit);
    if (buf) return { type: "photo", buffer: buf };
  } catch {}

  // Text fallback
  const card =
    `🦅 *HAWKX PNL CARD*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 @${username} · ${rankEmoji} ${rankName}\n` +
    `🪙 *${tokenName}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${arrow} *${sign}${Math.abs(pnlPct).toFixed(1)}%* ${mood}\n` +
    `💰 ${solLine}\n` +
    `💵 ${usdLine}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 Entry MCap: *${formatMcap(entryMcap)}*\n` +
    `📊 Exit MCap:  *${formatMcap(exitMcap)}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_"${expr}"_\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_Always Watching. Always First. 🦅_`;

  return { type: "text", text: card };
}

// ── Generate Rank Card ───────────────────────────────────────
async function generateRankCard(opts) {
  const { username = "Trader", rankNum = 1, volume = 0 } = opts;

  const name    = RANK_NAMES[rankNum] || "Unknown";
  const emoji   = RANK_EMOJI[rankNum] || "🎲";
  const nextVol = [0,10,50,200,500,1000,2000,2000][rankNum] || 2000;
  const fee     = [0,1.00,0.85,0.80,0.75,0.70,0.60,0.50][rankNum] || 1.00;
  const wallets = rankNum >= 4 ? 15 : 5;
  const pct     = rankNum === 7 ? 100 : Math.min(99, (volume / nextVol) * 100);
  const savings = ((1.0 - fee) * 100).toFixed(0);
  const tags    = ["","Every legend starts here.","You found the rhythm.",
    "Strategy over luck.","Precision is your edge.","The market feels you.",
    "Always hunting. Always winning.","Always Watching. Always First."];
  const topPct  = ["","","","","Top 25%","Top 15%","Top 5%","Top 1% 👑"][rankNum] || "";

  const barLen  = 20;
  const filled  = Math.round((pct / 100) * barLen);
  const bar     = "█".repeat(filled) + "░".repeat(barLen - filled);

  // Try image card (rank images exist from rank 2+)
  if (rankNum >= 2) {
    try {
      const imgFile = `rank_${rankNum}.png`;
      const buf = await loadCardImage(imgFile, true);
      if (buf) return { type: "photo", buffer: buf };
    } catch {}
  }

  // Text fallback
  const card =
    `🦅 *HAWKX RANK CARD*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 @${username}${topPct ? ` · ${topPct}` : ""}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${emoji} *${name.toUpperCase()}*\n` +
    `📍 Rank ${rankNum} of 7\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💎 Fee:        *${fee}%*\n` +
    `👛 Wallets:    *${wallets}*\n` +
    `💰 Saves vs 1%: *${savings}%*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📈 Volume Progress\n` +
    `\`${bar}\` ${pct.toFixed(0)}%\n` +
    `${volume.toLocaleString()} / ${nextVol.toLocaleString()} SOL\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_"${tags[rankNum]}"_\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `_Always Watching. Always First. 🦅_`;

  return { type: "text", text: card };
}

module.exports = { generatePnlCard, generateRankCard };
