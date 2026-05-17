# HawkX Mainnet Launch Checklist

## 🔴 CRITICAL — Must fix before mainnet

### Trading Engine (executor.js)
- [ ] Replace `mockBuy()` with real Jupiter v6 swap execution
- [ ] Replace `mockSell()` with real Jupiter v6 swap execution  
- [ ] Replace `getMockPrice()` with real DexScreener/Birdeye price feed
- [ ] Replace `simulatePriceMovement()` with real WebSocket price feed
- [ ] Implement real Jito bundle execution (UI exists, no real execution)
- [ ] Real transaction hash (not `DEVNET_BUY_xxx`)
- [ ] Real token balance check before trading
- [ ] Real slippage calculation

### Config
- [ ] Switch `NETWORK` from devnet → mainnet
- [ ] Switch `HELIUS_RPC_URL` to mainnet RPC
- [ ] Switch `BACKUP_RPC_URL` to mainnet backup
- [ ] Switch `DB_PATH` to `hawkx_mainnet.db`
- [ ] Set `MOCK_TRADES=false`
- [ ] Update rank thresholds to mainnet values:
  - Flipper: 10 SOL
  - Trader: 50 SOL
  - Sniper: 150 SOL
  - Whale: 500 SOL
  - Shark: 1,500 SOL
  - Hawk Elite: 5,000 SOL

### Infrastructure
- [ ] Move from Replit → VPS (Vultr/DigitalOcean)
- [ ] Make GitHub repo private
- [ ] Set Helius IP restriction (VPS IP only)
- [ ] SQLite permissions `chmod 600`
- [ ] Automated daily DB backup
- [ ] npm audit + fix vulnerabilities

### Security
- [ ] AES-256 wallet encryption tested on mainnet ✅ (code exists)
- [ ] Non-custodial confirmed ✅
- [ ] Rate limiting tested ✅
- [ ] Kill switch tested ✅

---

## 🟡 IMPORTANT — Launch week

### Real Data Integration  
- [ ] DexScreener WebSocket for real-time prices
- [ ] Real token metadata (name, logo, mcap)
- [ ] Real wallet SOL balance display
- [ ] Real transaction history

### Notifications
- [ ] Trade confirmation with real tx hash + explorer link
- [ ] Stop loss/TP hit notifications ✅ (code exists, needs real prices)
- [ ] Rank up notifications ✅ (code exists)
- [ ] Referral earned notifications ✅ (code exists)

### Payments
- [ ] Treasury wallet setup
- [ ] Fee collection on real trades
- [ ] Referral payout tested with real SOL
- [ ] Admin revenue tracker verified

### Cards
- [ ] Real-time chart in PnL card
- [ ] Token logo on cards
- [ ] QR code on cards

---

## 🟢 ALREADY DONE ✅

### Core Features
- [x] Telegram bot framework (GrammY)
- [x] User registration + onboarding
- [x] Wallet generation + import (AES-256)
- [x] Multi-wallet support (up to 5-15 per rank)
- [x] Beginner/Pro mode UI
- [x] Settings (slippage, gas, MEV, etc.)
- [x] Portfolio/positions tracking
- [x] Stop Loss + Take Profit engine
- [x] Limit orders (price + MCap based)
- [x] Copy trade (wallet + channel)
- [x] Auto sniper
- [x] Migration sniper
- [x] Realtime sniper
- [x] Token launch
- [x] Watchlist
- [x] Referral system (6 levels)
- [x] Rank system (7 tiers)
- [x] Fee discount for referrals
- [x] Admin panel
- [x] Kill switch
- [x] RPC failover
- [x] Rate limiting
- [x] Multi-language (EN/AR/ZH/RU)
- [x] PnL cards (Sharp/SVG)
- [x] Stats cards
- [x] Rank cards
- [x] Jito tip settings (UI only)

---

## 📋 PENDING LIST (from development)

- [x] Limit order MCap trigger in stopLoss.js ✅
- [ ] Alpha/trending indicators
- [ ] Hits feed
- [ ] Helius IP restriction
- [x] Stats screen rank info update ✅
- [x] Rank screen progress bar ✅

---

## 📊 SUMMARY

| Category | Done | Remaining |
|----------|------|-----------|
| Critical | 4 | 14 |
| Important | 6 | 12 |
| Nice to have | 0 | 15 |
| **Total** | **10** | **41** |

**Estimated time to mainnet: 2-3 weeks**

## Alerts & Notifications (Mainnet TODO)
- [ ] Daily PnL Report cron job — send daily summary to users with weekly_summary=1
- [ ] Price Alert monitor — check token prices vs alerts every minute, fire when hit
- [ ] Wallet Tracker monitor — monitor tracked wallets via Helius webhooks, notify on trade
- [ ] MCap alert trigger — check mcap vs target using DexScreener API

## Rank Up Notification (Mainnet TODO)
- [ ] Fix sendPhoto network issue on VPS (test rank card sending on mainnet)
- [ ] Verify rank card image generates correctly on VPS

## ✅ COMPLETED IN THIS SESSION

### UI/UX Improvements
- [x] Portfolio screen V13 — compact layout, hold time, source labels
- [x] Wallet screen — copy address, rename, instant refresh
- [x] Settings — execution inline presets (speed/slippage/jito)
- [x] Alerts system — price alerts + wallet tracker
- [x] Rank info screen — icons, progress bar, fee savings
- [x] Main menu guides — button descriptions, tagline
- [x] Commands open directly (no extra button)
- [x] Wallet labels show everywhere — 3 per row
- [x] Auto sell per position
- [x] Risk system removed (simplified)
- [x] Rank up notification — journey message + rank card

### Mainnet TODO Added
- [ ] Remove devnet buttons (faucet, mock buy, add volume)
- [ ] Remove [DEVNET] labels from all messages
- [ ] Update bot username to @HawkX_Trade_Bot
- [ ] Update referral link to mainnet bot
- [ ] Test rank card photo sending on VPS
- [ ] Price alert monitor cron
- [ ] Wallet tracker via Helius webhooks
- [ ] Daily PnL report cron

## HawkX Launch → Sniper Integration (Mainnet TODO)
- [ ] Wire launch completion to broadcast CA to all sniper users with platform_launchlab=1
- [ ] Check each user's sniper filters before auto-sniping
- [ ] Execute snipe if filters pass
- [ ] Notify user when their launch gets sniped
