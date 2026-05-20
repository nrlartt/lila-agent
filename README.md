# Lila Agent

**Production:** [lilagent.xyz](https://lilagent.xyz)

Autonomous trading dashboard and **Lila Bot** for [alt.fun](https://alt.fun) on **HyperEVM** (chain id 999). Live token indexer, non-custodial swaps via the official **Zap** contract, rule-based auto trading with a browser trading wallet, portfolio tracking, and optional Telegram bot.

## Features

| Surface | Description |
|---------|-------------|
| **Agent** (`/`) | Full token catalog, filters, live feed, manual swaps |
| **Lila Bot** (`/bot`) | Manual + automated trading, risk consent, activity feed |
| **Portfolio** | Cost basis and PnL from local trade history |
| **API + indexer** | SQLite catalog, SSE stream, honeypot checks, push (optional) |
| **Telegram** (optional) | Hot-wallet bot in DM — separate process |

## Architecture

```
Browser (React + wagmi)
        │  /api → proxy (dev) or same origin (prod)
        ▼
Hono API + static web/dist
        │
        ├── SQLite (tokens, trades, risk consent, push subs)
        ├── alt.fun API (catalog, charts, trades)
        └── HyperEVM RPC (indexer, on-chain reads)
```

## Quick start (local)

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
git clone https://github.com/nrlartt/lila-agent.git
cd lila-agent
npm install
npm install --prefix web

cp .env.example .env
cp web/.env.example web/.env
# Fill RPC_URL, REFERRER_ADDRESS, and web VITE_* vars (see .env.example)
```

### Development

```bash
# Terminal 1 — API + indexer
npm run dev:server

# Terminal 2 — web UI (proxies /api → :3000)
npm run dev:web
```

Open **http://localhost:5173**

### Production build

```bash
npm run build
npm run start:server:prod
```

Serves API and SPA from `web/dist` on `PORT` (default 3000).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev:server` | API + live indexer |
| `npm run dev:web` | Vite dev server |
| `npm run dev:bot` | Telegram bot (watch) |
| `npm run start:bot` | Telegram bot |
| `npm run start:server:prod` | Production web + API |
| `npm run build` | Compile backend + frontend |
| `npm run typecheck` | TypeScript check |
| `node scripts/smoke-test.mjs` | Pre-deploy smoke tests |

## Environment

Copy examples and fill secrets locally — **never commit `.env` files**.

| File | Purpose |
|------|---------|
| `.env.example` | Server: RPC, referrer, indexer, VAPID, consent salt |
| `web/.env.example` | Vite build: `VITE_SITE_URL`, `VITE_RPC_URL`, `VITE_REFERRER_ADDRESS` |
| `env.push.example` | Web push VAPID reference |

Required for web trading: `REFERRER_ADDRESS` (server) and matching `VITE_REFERRER_ADDRESS` (web build).

## Deploy (Railway — lilagent.xyz)

1. Connect this repo to Railway.
2. `railway.toml` is included: `npm ci && npm run build` → `node dist/index.js server`.
3. Mount a **volume** at `DATA_DIR` (e.g. `/data`) for SQLite persistence.
4. Set all `.env` and `VITE_*` variables in Railway **before** deploy (Vite vars at build time).
5. Point custom domain **lilagent.xyz** to the service.
6. Health check: `GET /api/health`

Optional second Railway service for Telegram: start command `node dist/index.js bot`, env `TELEGRAM_BOT_TOKEN`.

## Contracts (HyperEVM)

| Contract | Address |
|----------|---------|
| Zap | `0x693F12E9E6B35b34458793546065E8b08e0299d6` |
| Bonding | `0xb68811BcC0e4FcD825aA49F9453b065ddF752FcB` |
| USDC | `0xb88339CB7199b77E23DB6E890353E22632Ba630f` |

## Docs

- [Operator guide (Telegram)](docs/OPERATOR_GUIDE.md)
- [Platform architecture](docs/PLATFORM.md)

## Security

- `.env` and `web/.env` are gitignored — use platform secrets in production.
- Auto bot uses a **hot trading wallet** in the browser; users must accept risk disclosure (recorded server-side).
- Not financial advice. DYOR.

## License

MIT — see [LICENSE](LICENSE) if present, or add your preferred license.

## Links

- **Site:** https://lilagent.xyz  
- **Repo:** https://github.com/nrlartt/lila-agent  
- **alt.fun integrations:** https://docs.alt.fun/integrations
