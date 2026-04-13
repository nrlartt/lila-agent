# Environment variables

Load order: `.env` at the repository root (see `server/index.js` and Vite for client-side `VITE_*`).

## Stellar & x402

| Variable | Required | Description |
|----------|----------|-------------|
| `STELLAR_PAY_TO` | For x402 middleware | Public key receiving USDC |
| `STELLAR_AGENT_SECRET` | Optional | Server agent secret for `/api/agent/query` |
| `STELLAR_NETWORK` | Recommended | e.g. `stellar:testnet` or `stellar:pubnet` |
| `FACILITATOR_URL` | Defaulted | x402 facilitator HTTP endpoint |
| `STELLAR_RPC_URL` | Defaulted | Soroban / Horizon RPC |

### Optional: MPP Charge (parallel to x402)

| Variable | Description |
|----------|-------------|
| `MPP_ENABLED` | Set `true` to expose **`/api/mpp/premium/*`** with [MPP Charge](https://developers.stellar.org/docs/build/agentic-payments/mpp) (Soroban SAC `transfer`, no x402 facilitator). |
| `MPP_SECRET_KEY` | Random secret for MPP challenge binding (HMAC). **Not** a Stellar key. |

Requires `STELLAR_PAY_TO` (recipient) and the same `STELLAR_NETWORK` / `STELLAR_RPC_URL` as the rest of the app. Existing **`/api/premium/*`** x402 routes are unchanged.

## Server

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3001`) |
| `NODE_ENV` | `production` for static SPA + minified behavior |
| `CORS_ORIGIN` | Comma-separated allowed browser origins in production (e.g. **`https://lilagent.xyz`**) |
| `ENABLE_HSTS` | `true` only behind HTTPS termination |
| `RATE_LIMIT_MAX_PER_MIN` | Caps premium POSTs per IP per minute |
| `LILA_INTERNAL_BASE_URL` | Optional. Base URL the server uses when `/api/agent/query` pays premium routes (default `http://127.0.0.1:$PORT`). Set in Docker or when `localhost` is wrong. |

## MCP & remote agents (OpenClaw, Cursor, Claude Code)

**Payer wallet and automatic key creation apply only to the external MCP process** — not the HTTP API server. Template: **[`config/mcp-client.env.example`](../config/mcp-client.env.example)**.

| Variable | Description |
|----------|-------------|
| `LILA_PUBLIC_URL` | On the **API server**: public HTTPS base (no trailing slash). MCP clients use **`LILA_BASE_URL`** instead for HTTP calls. |
| `LILA_BASE_URL` | **MCP process only.** Base URL to reach `/api/services`, `/api/premium/*`, etc. (default `http://127.0.0.1:$PORT`). |
| `LILA_PAYER_SECRET`, `LILA_PAYER_SECRET_FILE`, `LILA_AUTO_CREATE_PAYER_WALLET`, `LILA_ALLOW_SERVER_AGENT_QUERY` | **MCP process only.** See template file. |
| `LILA_DOTENV_PATH` | Optional absolute path to an env file for the **MCP** process if `cwd` is outside the repo. |

See [OpenClaw & MCP](openclaw-mcp.md) and [Stellar agentic resources](stellar-agentic-resources.md).

## Inference (server)

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | `groq` \| `openclaw` \| `openai` \| `auto` (default). **`auto`** order: OpenClaw if `OPENCLAW_GATEWAY_URL` is set, else Groq, else OpenAI. Set **`groq`** to use Groq even when an OpenClaw URL is present. |
| `OPENCLAW_GATEWAY_URL` | WebSocket URL for neural gateway (used before Groq when `LLM_PROVIDER` is `auto` or `openclaw`) |
| `OPENCLAW_GATEWAY_TOKEN` | Optional bearer token |
| `OPENCLAW_GATEWAY_SCOPES` | Optional comma-separated scopes |
| `OPENCLAW_CONNECT_WITH_DEVICE` | Device-signed connect |
| `OPENCLAW_DEVICE_AUTH_FALLBACK` | Retry with device auth after token failure |

Additional HTTP inference keys are read by the server if set; see `server/llm.js` for precedence (gateway first, then optional HTTP backends).

## Client build (`VITE_*`)

| Variable | Description |
|----------|-------------|
| `VITE_SITE_URL` | Public site origin for metadata/footer (default **`https://lilagent.xyz`** in `defaultSiteLinks.json`) |
| `VITE_API_ORIGIN` | If the SPA is **not** same-origin as the API, set the API origin (no trailing slash). Same host as the app → leave unset. |
| `VITE_UNICORNSTUDIO_PROJECT_ID` | Optional hero background project id (build-time) |
| `VITE_GITHUB_URL` | Public GitHub repository URL (nav/footer links + default docs URL) |
| `VITE_DOCS_URL` | Optional override for **Docs** menu link (default: `.../blob/main/docs/README.md` under `VITE_GITHUB_URL`) |
| `VITE_X_URL` | Public X (Twitter) profile or project URL |

Copy from [`.env.example`](../.env.example) and never commit real secrets.
