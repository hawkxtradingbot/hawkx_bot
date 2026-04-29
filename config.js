require("dotenv").config();

const config = Object.freeze({
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  // ── DEVNET RPC ──
  HELIUS_RPC_URL: process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com",
  BACKUP_RPC_URL: process.env.BACKUP_RPC_URL || "https://api.devnet.solana.com",
  NETWORK: process.env.NETWORK || "devnet",

  // ── DEVNET FLAGS ──
  DEVNET_MODE:  process.env.DEVNET_MODE  === "true",
  MOCK_TRADES:  process.env.MOCK_TRADES  === "true",
  AUTO_AIRDROP: process.env.AUTO_AIRDROP === "true",

  // ── WALLET & SECURITY ──
  TREASURY_WALLET:      process.env.TREASURY_WALLET,
  TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY,
  AES_MASTER_SECRET:    process.env.AES_MASTER_SECRET,
  ADMIN_IDS: (process.env.ADMIN_IDS || "").split(",").map((id) => id.trim()),

  // ── JITO ──
  JITO_TIP_ACCOUNT:      process.env.JITO_TIP_ACCOUNT,
  JITO_BLOCK_ENGINE_URL: process.env.JITO_BLOCK_ENGINE_URL,

  // ── DB ──
  DB_PATH:        process.env.DB_PATH || "./hawkx_devnet.db",
  MIN_PAYOUT_SOL: parseFloat(process.env.MIN_PAYOUT_SOL || "0.001"),
  DAILY_PAYOUT_CRON: "0 */12 * * *",
  RANK_CHECK_CRON:   "*/2 * * * *",

  INVITE_CODE_REQUIRED: process.env.INVITE_CODE_REQUIRED === "true",
  INVITE_CODE: process.env.INVITE_CODE || "FAZLERABBI2026",

  // ── FEE RATES — #03 ──
  // Rank 1 Degen:     1.00%
  // Rank 2 Flipper:   0.85%
  // Rank 3 Trader:    0.80%
  // Rank 4 Sniper:    0.75%
  // Rank 5 Whale:     0.70%
  // Rank 6 Shark:     0.60%
  // Rank 7 Hawk Elite: 0.50%
  FEE_RATES: {
    rank1: 0.0100,
    rank2: 0.0085,
    rank3: 0.0080,
    rank4: 0.0075,
    rank5: 0.0070,
    rank6: 0.0060,
    rank7: 0.0050,
  },

  // ── RANK THRESHOLDS (devnet = lowered for fast testing) ──
  RANK_THRESHOLDS: {
    1: 0,
    2: 0.1,    // mainnet: 10 SOL
    3: 0.5,    // mainnet: 50 SOL
    4: 1,      // mainnet: 200 SOL
    5: 2,      // mainnet: 500 SOL
    6: 5,      // mainnet: 1000 SOL
    7: 10,     // mainnet: 2000 SOL
  },

  // ── RANK NAMES — #02 Option A ──
  RANK_NAMES: {
    1: "Degen",
    2: "Flipper",
    3: "Trader",
    4: "Sniper",
    5: "Whale",
    6: "Shark",
    7: "Hawk Elite",
  },

  RANK_FEE_KEYS: {
    1: "rank1",
    2: "rank2",
    3: "rank3",
    4: "rank4",
    5: "rank5",
    6: "rank6",
    7: "rank7",
  },

  // ── WALLET LIMITS BY RANK — #09 ──
  WALLET_LIMITS: {
    1: 5,
    2: 5,
    3: 5,
    4: 15,
    5: 15,
    6: 15,
    7: 15,
  },

  // ── REFERRAL RATES — #04 L1 = 30% standard ──
  REFERRAL_RATES: [0.30, 0.04, 0.03, 0.02, 0.015, 0.01],

  // ── DEVNET TEST TOKENS ──
  TEST_TOKENS: {
    USDC_DEVNET: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
    SOL:         "So11111111111111111111111111111111111111112",
  },
});

module.exports = config;
