<div align="center">

# LILA

### Neural terminal · Paid AI on Stellar · x402 micropayments

[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-7C3AED?logo=stellar&logoColor=white)](https://stellar.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-lilagent.xyz-22c55e)](https://lilagent.xyz/)

**[Architecture](#architecture)** · **[How it works](#how-it-works)** · **[Product surface](#product-surface)** · **[Security](#security)** · **[Deploy](#deploy)** · **[Docs](docs/README.md)** · **[Contributing](CONTRIBUTING.md)**

</div>

---

## Documentation

**In-app docs:** **[lilagent.xyz/docs](https://lilagent.xyz/docs)**. Extended Markdown reference: **[docs/README.md](docs/README.md)** (architecture, API, environment, deployment, frontend).

## What LILA is

**Production:** **[lilagent.xyz](https://lilagent.xyz/)** (SPA + API on the same origin when deployed as documented).

**LILA** is a full-stack demo of **pay-per-request AI** on **Stellar**: a browser terminal plus REST API where each premium call is paid with **x402** (HTTP 402 + Soroban auth + USDC settlement), using **Freighter** in the browser. No subscription keys in the client for payments: users sign transfers from their own wallet.

The **landing page** is a separate route from the **terminal** (`/` vs `/terminal`). The server exposes public metadata (`/api/services`, `/api/health`) and **paid** routes under `/api/premium/*` protected by x402 middleware when `STELLAR_PAY_TO` is configured.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                           │
│  Home · Terminal · Freighter · @x402/fetch (user-paid)      │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Express (Node) · Helmet · CORS · rate limit (premium)       │
│  /api/premium/chat|analyze|code|research  ← x402 middleware  │
│  /api/services · /api/health · /api/agent/query (optional MCP fallback) │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   Stellar (RPC)      x402 facilitator    Neural gateway + optional HTTP inference
   Soroban / USDC     (HTTP)              (OpenClaw preferred when configured)
```

---

## How it works

1. **Operator** opens the app, connects **Freighter**, and runs commands like `/chat`, `/analyze`, `/code`, `/research`.
2. The **frontend** calls `/api/premium/<service>` with JSON body. If x402 is active, the first response is **HTTP 402** with payment requirements.
3. The **client** uses `@x402/fetch` to complete payment (sign with Freighter, retry with proof headers).
4. The **facilitator** verifies and settles **USDC** on Stellar; the server returns the **AI response** (remote inference when configured, otherwise static fallbacks).
5. **OpenClaw / MCP:** **`LILA_PAYER_SECRET`** is **required** in the MCP env so **`lila_query`** pays via x402 on **`/api/premium/*`** from **your** wallet. **`LILA_ALLOW_SERVER_AGENT_QUERY=true`** (dev only) enables **`/api/agent/query`** without it (server **`STELLAR_AGENT_SECRET`** or demo).

See **`.env.example`** for all variables (Stellar network, pay-to address, facilitator URL, optional **neural gateway** via WebSocket, optional HTTP inference keys).

---

## Product surface

| Surface | Purpose |
|--------|---------|
| `GET /api/services` | Public: network label, x402 on/off, service list (no secrets). |
| `GET /api/health` | Liveness: uptime; `llmReady` = remote inference available (boolean). |
| `POST /api/premium/*` | Paid AI endpoints (chat, analyze, code, research). |
| `POST /api/agent/query` | Optional MCP fallback when **`LILA_ALLOW_SERVER_AGENT_QUERY=true`** and no **`LILA_PAYER_SECRET`**: server agent or demo. |
| `npm run mcp` | **External agent** process only. Env template: [config/mcp-client.env.example](config/mcp-client.env.example). Docs: [docs/openclaw-mcp.md](docs/openclaw-mcp.md), [Skill](skills/lila-openclaw/SKILL.md), [config/openclaw-lila.mcp.example.json](config/openclaw-lila.mcp.example.json). |
| SPA `/` | Marketing / lab-style landing (hero + sections). |
| SPA `/docs` | Technical documentation (API, env, MCP, deployment). |
| SPA `/terminal` | Full-height terminal UI. |

---

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Freighter](https://www.freighter.app/) (for user-paid flows)
- **VS Code / Cursor:** install the workspace-recommended **Dotenv** extension (`.vscode/extensions.json`) so `.env` uses key/value syntax colors.

### Install

```bash
git clone https://github.com/nrlartt/lila-agent.git
cd lila-agent
npm install
cp .env.example .env
```

Edit `.env` with testnet keys and optional server-side inference settings. Fund testnet accounts and USDC as described in [Stellar Lab](https://lab.stellar.org/) and your issuer docs.

### Development

```bash
npm run dev
```

- UI: **http://localhost:5173** (frontend dev server; `/api` → `http://localhost:3001`)
- API: **http://localhost:3001**

### Production

```bash
npm run build
npm start
```

Serves the built SPA from `dist/` and the API on `PORT` (default `3001`). Put **HTTPS** and **reverse proxy** in front; set `CORS_ORIGIN` and optionally `ENABLE_HSTS=true` when TLS is terminated.

---

## Security

- **Helmet** security headers; **CORS** configurable via `CORS_ORIGIN` in production.
- **Rate limiting** on `/api/premium/*` (see `server/rateLimit.js`).
- **Secrets** only in `.env` (never committed). See **[SECURITY.md](SECURITY.md)** for reporting issues and hardening guidance.

---

## Deploy

1. Build: `npm run build`
2. Set `NODE_ENV=production`, `PORT`, Stellar and inference-related env vars on the host.
3. **HTTPS** required for real wallets; configure `CORS_ORIGIN` to your site origin.
4. Optional: `ENABLE_HSTS=true` only behind valid TLS.

### GitHub

Use **only this project directory** as the Git repository root (not your user home folder). If `git status` lists unrelated paths, run `git init` inside a clean copy of `lilagent/` or clone from GitHub into an empty folder.

```bash
cd lilagent
git init
git add .
git commit -m "Initial commit: LILA Neural Terminal"
git branch -M main
git remote add origin https://github.com/nrlartt/lila-agent.git
git push -u origin main
```

GitHub shows **README**, **Contributing**, **MIT license**, and **Security** when `README.md`, `CONTRIBUTING.md`, `LICENSE`, and `SECURITY.md` exist at the repo root (same pattern as professional OSS repos).

---

## Repo layout

```
lilagent/
├── docs/             # Technical documentation (see docs/README.md)
├── server/           # Express + x402 + LLM wiring
├── src/              # React app (pages, terminal, wallet client)
├── index.html
├── LICENSE           # MIT
├── CONTRIBUTING.md
├── SECURITY.md
└── .env.example
```

---

## For builders, demos, and hackathon-style submissions

This README is structured for **fast evaluation**: clone, configure `.env`, run `npm run dev`, and trace **x402 + USDC on Stellar**. The **product UI** stays neutral (no event-specific labels). Context and talking points live here and in your live demo.

---

## Third-party

- **Unicorn Studio** (optional hero WebGL) loads from jsDelivr; configure `VITE_UNICORNSTUDIO_PROJECT_ID` or use the default embed. See their terms for commercial use.
- **Stellar**, **x402**, **Freighter**, and any configured inference gateway are subject to their respective terms.

---

## License

[MIT](LICENSE)
