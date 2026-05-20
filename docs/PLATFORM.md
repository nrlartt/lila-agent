# Platform Architecture

**Lila Agent** — Telegram bot + web dashboard sharing the same alt.fun Zap integration on HyperEVM.

## Components

| Component | Command | Purpose |
|-----------|---------|---------|
| **Indexer** | runs with server | Indexes `Bonding` events into SQLite |
| **API** | `npm run dev:server` | REST + SSE live feed |
| **Web** | `npm run dev:web` | Wallet connect, monitor, trade |
| **Telegram** | `npm run start:bot` | Mobile trading (hot wallet in DM) |

## Data flow

```
HyperEVM Bonding contract
        ↓ events (TokenLaunched, Trade, …)
   Indexer → SQLite (data/altfun.db)
        ↓
   API /api/tokens, /api/stream (SSE)
        ↓
   Web UI (live feed + trade via wagmi)
```

## New token monitor

The indexer listens for `TokenLaunched` on the Bonding contract and enriches each token with:

- Name, ticker, description, image, URLs (`getTokenInfo`)
- Lifecycle: curve / graduating / graduated
- Pair reserves, LT buffer, exchange rate
- Trade history from `Trade` events

## Web trading (non-custodial)

Users connect **MetaMask / Rabby** in the browser. Trades call `Zap.buy` / `Zap.sell` from the user's wallet with `VITE_REFERRER_ADDRESS`.

No private keys are stored on the server for web users.

## Development

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
cd web && cp .env.example .env
# set VITE_REFERRER_ADDRESS
npm install && npm run dev
```

Open http://localhost:5173

## Production

```bash
npm run build
# web/.env → VITE_REFERRER_ADDRESS
PORT=3000 node dist/index.js server
```

Serves API and `web/dist` on one port.
