# API reference

Base URL is your deployment origin. **Production:** `https://lilagent.xyz` (same origin for SPA + API when deployed per [Deployment](deployment.md)). Local: `http://localhost:3001`.

All JSON bodies use `Content-Type: application/json` unless noted.

## Public

### `GET /api/services`

Metadata for the UI and clients. No secrets.

**Response (example shape):**

```json
{
  "name": "LILA Neural Terminal",
  "version": "4.0",
  "network": "stellar:testnet",
  "networkLabel": "Testnet",
  "rpcUrl": "https://...",
  "payTo": "G...|null",
  "x402Server": true,
  "x402Agent": true,
  "userPaysWithWallet": true,
  "mppCharge": false,
  "mppPremiumBase": null,
  "integrationHints": {
    "websiteTerminal": { "protocol": "x402", "description": "...", "paths": ["POST /api/premium/chat", "..."] },
    "mcpLilaQuery": { "protocol": "x402", "description": "...", "paths": ["POST /api/agent/query"] },
    "externalAgentMpp": { "protocol": "mpp-charge", "description": "...", "paths": [] }
  },
  "llmReady": true,
  "services": [
    { "id": "chat", "name": "Neural Chat", "price": "$0.001", "description": "..." }
  ]
}
```

- `llmReady`: `true` when remote inference is configured (not static-only).
- `x402Server`: `true` when `STELLAR_PAY_TO` is set and payment middleware loaded.
- `mppCharge`: `true` when [MPP Charge](https://developers.stellar.org/docs/build/agentic-payments/mpp) routes are enabled (`MPP_ENABLED=true` and `MPP_SECRET_KEY` set).
- `mppPremiumBase`: e.g. `/api/mpp/premium` when MPP is on, else `null`.

### `GET /api/health`

Liveness probe.

```json
{
  "status": "online",
  "agent": "LILA",
  "version": "4.0",
  "uptime": 123.45,
  "x402Server": true,
  "llmReady": true
}
```

## Premium (x402 protected when configured)

When x402 middleware is active, these endpoints require a successful payment (or valid proof headers) per request.

| Method | Path | Body fields |
|--------|------|-------------|
| POST | `/api/premium/chat` | `{ "message": string }` |
| POST | `/api/premium/analyze` | `{ "query": string }` |
| POST | `/api/premium/code` | `{ "prompt": string }` |
| POST | `/api/premium/research` | `{ "topic": string }` |

**Response (typical):**

```json
{
  "service": "chat",
  "response": "...",
  "cost": "$0.001",
  "ai": true
}
```

Exact pricing is configured in server x402 middleware.

## Premium (MPP Charge, optional)

When `MPP_ENABLED` is set, parallel routes use **MPP Charge** (Soroban SAC, `@stellar/mpp`). Clients should use the [MPP charge client](https://github.com/stellar/stellar-mpp-sdk/blob/main/examples/charge-client.ts), not `@x402/fetch`. Same JSON bodies and prices as x402 premium routes; responses include `"payment": "mpp"`.

| Method | Path | Body fields |
|--------|------|-------------|
| POST | `/api/mpp/premium/chat` | `{ "message": string }` |
| POST | `/api/mpp/premium/analyze` | `{ "query": string }` |
| POST | `/api/mpp/premium/code` | `{ "prompt": string }` |
| POST | `/api/mpp/premium/research` | `{ "topic": string }` |

## MCP bridge (optional)

External MCP clients (OpenClaw, Cursor, …) can use the repository **`npm run mcp`** stdio server, which calls `/api/services`, `/api/health`, and `/api/agent/query`. Register the server in OpenClaw via **`mcp.servers`** ([OpenClaw `mcp` CLI](https://docs.openclaw.ai/cli/mcp)); example fragment: [config/openclaw-lila.mcp.example.json](../config/openclaw-lila.mcp.example.json). Stellar / x402 links: [Stellar agentic resources](stellar-agentic-resources.md).

## Agent (optional)

### `POST /api/agent/query`

Server-side agent pays the premium URL using `STELLAR_AGENT_SECRET` when x402 and agent are configured.

**Body:**

```json
{
  "service": "chat|analyze|code|research",
  "input": "string"
}
```

**Errors:** `400` for missing/invalid `service`; `500` on payment failure.

## Rate limiting

`POST` paths under `/api/premium/*` may be rate-limited per IP. See `server/rateLimit.js` and `RATE_LIMIT_MAX_PER_MIN` in [Environment](environment.md).
