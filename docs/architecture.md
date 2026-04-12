# Architecture

## High-level

LILA is a single-page application (SPA) served in production by the same Node process that hosts the REST API. The browser connects **Freighter** for user-signed **x402** payments on **Stellar**; inference runs on the server (neural gateway or optional HTTP backends).

```
Browser (React)
    │  HTTPS
    ▼
Express
    ├── Static files (production: dist/)
    ├── Public JSON: /api/services, /api/health
    ├── x402 middleware: POST /api/premium/*
    ├── Optional: POST /api/agent/query (server agent pays)
    └── LLM layer (server/llm.js)
            │
            ├── Stellar RPC / facilitator (x402 settlement)
            └── Remote inference (gateway preferred when configured)
```

## Key modules

| Area | Path | Role |
|------|------|------|
| API entry | `server/index.js` | Express app, CORS, Helmet, routes, SPA fallback |
| x402 | `@x402/express` + config | Payment requirements on premium POSTs |
| Agent client | `server/agentClient.js` | Server wallet paying premium URLs |
| LLM | `server/llm.js` | Provider selection, prompts, OpenClaw WS / HTTP |
| Rate limit | `server/rateLimit.js` | Premium POST throttling |
| Client | `src/` | React, terminal, `createUserPaidFetch` for x402 |

## Payment flow (user-paid)

1. Client POSTs to `/api/premium/<service>` with JSON body.
2. If x402 is active, first response may be **402** with payment requirements.
3. Client uses `@x402/fetch` to sign with Freighter and retry with proof headers.
4. Facilitator verifies settlement; handler returns AI JSON.

## Frontend routes

| Path | Purpose |
|------|---------|
| `/` | Marketing / lab-style landing |
| `/terminal` | Full-height terminal UI |

See [Frontend](frontend.md) for details.
