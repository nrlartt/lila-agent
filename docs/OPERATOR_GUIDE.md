# Operator Guide — Launch Your Telegram Bot

This guide is for **you**, the bot operator. End users only need the Telegram link and the in-bot `/help` text.

---

## 1. Create the Telegram bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot`.
3. Choose a **display name** (e.g. `Alt Fun Trading Bot`).
4. Choose a **username** ending in `bot` (e.g. `MyAltFunTradeBot`).
5. BotFather replies with a token like `7123456789:AAH...` — this is `TELEGRAM_BOT_TOKEN`.

Optional (recommended):

- `/setdescription` — short explanation + link to alt.fun.
- `/setabouttext` — “Non-custodial. You control your wallet. DYOR.”
- `/setcommands` — the app registers commands automatically on start; you can still set them in BotFather if needed.
- `/setuserpic` — upload a logo.

Your public link: **`https://t.me/<YourBotUsername>`**

---

## 2. Configure the server

On your PC or VPS (Ubuntu recommended):

```bash
# Install Node.js 20+
node -v

git clone <your-repo> alt-bot
cd alt-bot
npm install
cp .env.example .env
```

Edit `.env`:

```env
TELEGRAM_BOT_TOKEN=<paste from BotFather>
REFERRER_ADDRESS=0xYourReferralWallet
RPC_URL=https://rpc.hyperliquid.xyz/evm
SLIPPAGE_PERCENT=10
```

- **`REFERRER_ADDRESS`** — must be **your** wallet (not the same as users’ trading wallets). Every user buy calls `Zap.buy(..., referrer)` with this address.
- Do **not** put `PRIVATE_KEY` in `.env` on the public server unless you use CLI there.

Test locally:

```bash
npm run start:bot
```

Open `https://t.me/<YourBotUsername>` → **Start** → run `/help`.

---

## 3. Keep the bot online 24/7

Users must reach your process continuously. Options:

### A) VPS + PM2 (recommended)

```bash
npm run build
npm install -g pm2
pm2 start npm --name alt-bot -- run start:bot
pm2 save
pm2 startup
```

Logs: `pm2 logs alt-bot`

### B) Windows (your PC stays on)

```powershell
cd C:\path\to\alt
npm run start:bot
```

Use only for testing — if the PC sleeps, the bot stops.

### C) Docker / Railway / Fly.io

- Build: `npm run build`
- Start command: `node dist/index.js bot`
- Set env vars in the dashboard (never commit secrets).

---

## 4. Go public

1. **Pin a message** in your Telegram channel/group with:
   - Bot link: `https://t.me/<YourBotUsername>`
   - “Use private chat only for `/wallet`”
   - Minimum trade sizes (20 USDC buy / 12 USDC sell)
   - Risk disclaimer (not financial advice; hot wallet risk)

2. **Verify** with a test wallet:
   - Small USDC + HYPE on HyperEVM
   - `/wallet` → `/approve` → `/quote buy` → `/buy`

3. **Monitor** `pm2 logs` for errors (RPC down, graduation pause, etc.).

---

## 5. How you earn

- On each user **buy**, Zap emits `Referred(trader, referrer, usdcAmount)` when `referrer` ≠ trader.
- Attribution and payouts are handled by **alt.fun’s infrastructure** (off-chain indexing). Confirm referral terms with alt.fun if needed.
- **Sells** do not pass a referrer parameter — revenue depends on **buy volume** through your bot.

Grow usage by sharing the bot link where alt.fun traders gather.

---

## 6. Checklist before sharing widely

- [ ] `REFERRER_ADDRESS` is correct and controlled by you  
- [ ] Bot runs under PM2 (or equivalent) with auto-restart  
- [ ] `.env` is not in git  
- [ ] You tested buy + sell on a real token  
- [ ] Channel pin includes security warning about private keys  
- [ ] BotFather description and profile are set  

---

## 7. Troubleshooting

| Issue | Fix |
|-------|-----|
| Bot does not respond | Check token, `pm2 status`, firewall |
| `Missing TELEGRAM_BOT_TOKEN` | Fill `.env` in the same directory you start from |
| User “No wallet connected” | They must use **private chat**, then `/wallet` |
| Buy reverts `TokenIsGraduating` | Wait ~1 min; token is migrating to HyperSwap |
| Sell reverts buffer | User should `/sell <token> max` and retry after ~10s |
| RPC errors | Set a dedicated RPC in `RPC_URL` |

---

## 8. Optional next steps

- Custom domain landing page linking to `t.me/...`
- Channel alerts for new alt.fun launches (separate indexer)
- WalletConnect instead of pasted keys (larger build — not in v1)

For integration details see [alt.fun integrations](https://docs.alt.fun/integrations).
