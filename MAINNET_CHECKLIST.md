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
