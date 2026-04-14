// config.js — HawkX V10 DEVNET
require("dotenv").config();

const config = Object.freeze({
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  // ── DEVNET RPC ──
  HELIUS_RPC_URL: process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com",
  BACKUP_RPC_URL: process.env.BACKUP_RPC_URL || "https://api.devnet.solana.com",
  NETWORK: process.env.NETWORK || "devnet",

  // ── DEVNET FLAGS ──
  DEVNET_MODE: process.env.DEVNET_MODE === "true",
  MOCK_TRADES: process.env.MOCK_TRADES === "true",
  AUTO_AIRDROP: process.env.AUTO_AIRDROP === "true",

  // ── WALLET & SECURITY ──
  TREASURY_WALLET: process.env.TREASURY_WALLET,
  TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY,
  AES_MASTER_SECRET: process.env.AES_MASTER_SECRET,
  ADMIN_IDS: (process.env.ADMIN_IDS || "").split(",").map((id) => id.trim()),

  // ── JITO (mocked in devnet) ──
  JITO_TIP_ACCOUNT: process.env.JITO_TIP_ACCOUNT,
  JITO_BLOCK_ENGINE_URL: process.env.JITO_BLOCK_ENGINE_URL,

  // ── DB ──
  DB_PATH: process.env.DB_PATH || "./hawkx_devnet.db",
  MIN_PAYOUT_SOL: parseFloat(process.env.MIN_PAYOUT_SOL || "0.001"),
  DAILY_PAYOUT_CRON: process.env.DAILY_PAYOUT_CRON || "* * * * *",
  RANK_CHECK_CRON: process.env.RANK_CHECK_CRON || "*/1 * * * *",
  INVITE_CODE_REQUIRED: process.env.INVITE_CODE_REQUIRED === "true",
  INVITE_CODE: process.env.INVITE_CODE || "TESTCODE2026",

  // ── FEE RATES (same as mainnet) ──
  FEE_RATES: {
    trial: 0.003,
    scout: 0.01,
    scoutReferral: 0.009,
    tracker: 0.0085,
    hunter: 0.008,
    predator: 0.0075,
    apex: 0.007,
    hawk: 0.006,
    hawkElite: 0.005,
  },

  // ── RANK THRESHOLDS (LOWERED FOR FAST TESTING) ──
  // Normal: 10/50/200/500/1000/2000 SOL
  // Devnet: 0.1/0.5/1/2/5/10 SOL so you can rank up quickly
  RANK_THRESHOLDS: {
    1: 0,
    2: 0.1,
    3: 0.5,
    4: 1,
    5: 2,
    6: 5,
    7: 10,
  },

  RANK_NAMES: {
    1: "Scout",
    2: "Tracker",
    3: "Hunter",
    4: "Predator",
    5: "Apex",
    6: "Hawk",
    7: "Hawk Elite",
  },

  RANK_FEE_KEYS: {
    1: "scout",
    2: "tracker",
    3: "hunter",
    4: "predator",
    5: "apex",
    6: "hawk",
    7: "hawkElite",
  },

  WALLET_LIMITS: {
    1: 5,
    2: 8,
    3: 10,
    4: 15,
    5: 18,
    6: 20,
    7: 20,
  },

  REFERRAL_RATES: [0.3, 0.04, 0.03, 0.02, 0.015, 0.01],

  // ── DEVNET TEST TOKENS (real devnet CAs for testing) ──
  TEST_TOKENS: {
    USDC_DEVNET: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
    SOL: "So11111111111111111111111111111111111111112",
  },
});

module.exports = config;
