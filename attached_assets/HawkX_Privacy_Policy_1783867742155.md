# HawkX Privacy Policy

**Last Updated: July 12, 2026**

This Privacy Policy describes how HawkX ("we," "us," "our") collects, uses, and protects information in connection with your use of the HawkX Telegram bot (@HawkX_Trade_Bot).

**Data Controller:** HawkX is currently operated by an individual developer, with plans to incorporate as a registered business entity. Contact for all data matters: **fozleelahi547@gmail.com**

---

## 1. Information We Collect

### 1.1 Information from Telegram
When you interact with HawkX, Telegram provides us with:
- Your Telegram user ID
- Your Telegram username (if public)
- Message content you send directly to the Bot (e.g., commands, pasted addresses, configuration values)

### 1.2 Wallet and Trading Data
- Public wallet addresses generated or added within the Bot
- Encrypted private keys (see Section 2 — Wallet Security)
- Trading activity: trade amounts, tokens traded, timestamps, fees paid, profit/loss records
- Settings and preferences you configure (e.g., slippage tolerance, auto-sell rules, referral codes)

### 1.3 Referral Data
- Referral relationships (who referred whom)
- Referral earnings and payout history

We do **not** collect government-issued identification, banking information, or other traditional KYC (Know Your Customer) data, as HawkX does not currently require identity verification to use core trading features.

---

## 2. Wallet Security

Private keys for wallets generated within HawkX are encrypted using AES-256-GCM encryption before being stored. Access to a wallet's decrypted private key within the Bot requires your PIN (if configured). **We do not store your PIN in plaintext** (it is hashed using bcrypt).

If you choose to export your private key or seed phrase via the Bot's export feature, that information is displayed temporarily (auto-deleted from the chat after a short window) and is your sole responsibility to secure once exported. We recommend never sharing your private key or seed phrase with anyone, including anyone claiming to represent HawkX.

---

## 3. How We Use Your Information

We use collected information to:
- Execute the trades and features you request
- Calculate applicable fees and rank-based discounts
- Track and pay out referral earnings
- Maintain trade history and portfolio displays within the Bot
- Diagnose and fix technical issues
- Communicate service updates, security notices, or promotional information related to HawkX (you may be able to opt out of certain non-essential notifications via Bot settings)

We do not sell your personal information to third parties.

### Legal Basis for Processing (for users in the EU/EEA)
Where applicable, we process your information on the basis of: performance of a contract (providing the trading service you request), legitimate interest (fraud prevention, service improvement), and consent (where you opt in to optional notifications).

---

## 4. Third-Party Data Sharing & Processors

To provide core functionality, HawkX shares limited data with the following third-party services:
- **Jupiter Aggregator** — to execute token swaps (your wallet address and transaction details are necessarily part of any on-chain transaction)
- **Solana RPC providers (e.g., Helius)** — to read blockchain data and submit transactions
- **Birdeye, DexScreener, RugCheck** — queried using token contract addresses to retrieve public market and safety data; these providers do not receive your personal Telegram or wallet identity from us beyond what is inherently visible on the public blockchain
- **Hosting/infrastructure provider** — our server infrastructure (VPS hosting) stores the encrypted database described in this policy
- **Telegram** — as the messaging platform HawkX operates through; see Telegram's own Privacy Policy for how they handle your Telegram account data

Because Solana is a public blockchain, any transaction executed through HawkX is permanently and publicly visible on-chain, associated with your wallet's public address, regardless of this Privacy Policy.

---

## 5. Data Retention & Deletion

We retain trade history, referral data, and account settings for as long as your account remains active, and for a reasonable period afterward for record-keeping, dispute resolution, and legal compliance purposes.

**What can be deleted upon request:**
- Telegram account association / profile information
- Stored settings and preferences
- Referral records, where legally permissible

**What cannot be deleted:**
- Blockchain transactions — these exist permanently and independently on the public Solana ledger and are outside our control

---

## 6. Data Security

We take reasonable technical measures to protect stored data, including encryption of sensitive wallet information (AES-256-GCM) and access controls on our infrastructure. However, no method of electronic storage or transmission is completely secure, and we cannot guarantee absolute security. In the event of a data breach materially affecting your information, we will notify affected users where legally required to do so.

---

## 7. Children's Privacy

HawkX is not directed at individuals under the age of 18. We do not knowingly collect information from minors. If you believe a minor has provided us with information, please contact us so we can take appropriate action.

---

## 8. Your Rights

Depending on your jurisdiction (including rights under GDPR for EU/EEA users and CCPA for California residents where applicable), you may have rights to:
- Access the personal data we hold about you
- Correct inaccurate data
- Request deletion of your data (subject to Section 5 limitations)
- Object to or restrict certain processing
- Lodge a complaint with your local data protection supervisory authority (EU/EEA users)

To exercise these rights, contact us at: **fozleelahi547@gmail.com**

---

## 9. International Users

HawkX may be used by individuals in various jurisdictions. By using the Bot, you acknowledge that your information may be processed on servers located outside your country of residence.

---

## 10. Changes to This Policy

We may update this Privacy Policy periodically. Material changes will be communicated through the Bot or associated channels. Continued use of HawkX after changes take effect constitutes acceptance of the updated Policy.

---

## 11. Contact Us

For questions about this Privacy Policy or your data, contact: **fozleelahi547@gmail.com**

---

*HawkX's operator is not a licensed attorney or privacy professional. This Privacy Policy is intended as a good-faith, comprehensive framework but should be reviewed by qualified legal counsel — particularly regarding GDPR/CCPA specifics for your actual user base — before wide public launch.*
