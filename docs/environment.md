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

| Variable | Description |
|----------|-------------|
| `LILA_PUBLIC_URL` | Public HTTPS base URL (no trailing slash). Production: **`https://lilagent.xyz`**. Remote agents set MCP `env.LILA_BASE_URL` to this value. |
| `LILA_BASE_URL` | Base URL for `npm run mcp` (stdio MCP) to reach `/api/services`, `/api/health`, `/api/agent/query` (default `http://127.0.0.1:$PORT`). |
| `LILA_DOTENV_PATH` | Optional absolute path to `.env` if the MCP process is started with `cwd` outside the repo. |

See [OpenClaw & MCP](openclaw-mcp.md) and [Stellar agentic resources](stellar-agentic-resources.md).

## Inference (server)

| Variable | Description |
|----------|-------------|
| `OPENCLAW_GATEWAY_URL` | WebSocket URL for neural gateway (preferred when set) |
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
