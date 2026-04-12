# OpenClaw, Stellar x402, and LILA MCP

This project exposes LILA to **any MCP client** (including [OpenClaw](https://docs.openclaw.ai/)) via a **stdio MCP server** that calls your HTTP API — especially **`POST /api/agent/query`**, which uses **`STELLAR_AGENT_SECRET`** to settle **x402** on Stellar when configured.

For background on x402, MPP, and Stellar tooling, see [Stellar agentic resources](stellar-agentic-resources.md).

## What you need on the LILA side

1. **LILA HTTP server** running (`npm run dev:server` or `npm start`).
2. **Stellar**: `STELLAR_PAY_TO`, `STELLAR_AGENT_SECRET`, funded agent wallet (USDC + XLM for fees) on the chosen network — see [Environment](environment.md).
3. **Env**: set `LILA_PUBLIC_URL` in `.env` when your API is deployed publicly; use that value as **`LILA_BASE_URL`** in OpenClaw MCP `env` for remote gateways.

## MCP server (stdio)

From the repository root (after `npm install`):

```bash
npm run mcp
```

Tools: `lila_services`, `lila_health`, `lila_query` (see [API](api.md)).

Optional: **`LILA_DOTENV_PATH`** — absolute path to `.env` if the MCP process is started with a working directory outside this repo.

## Register LILA in OpenClaw

OpenClaw stores outbound MCP definitions under **`mcp.servers`** in `~/.openclaw/openclaw.json` (see [OpenClaw CLI: mcp](https://docs.openclaw.ai/cli/mcp)).

### Stdio fields (official)

| Field | Purpose |
| --- | --- |
| `command` | Executable (e.g. `node`) |
| `args` | Arguments (e.g. `mcp/lila-server.mjs`) |
| `cwd` / `workingDirectory` | **Repository root** (where `node_modules` exists) |
| `env` | e.g. `LILA_BASE_URL` pointing at your LILA API |

### Example fragment

Copy and merge **`config/openclaw-lila.mcp.example.json`** into your OpenClaw config. Set:

- **`cwd`** — absolute path to this repo on your machine.
- **`env.LILA_BASE_URL`** — `http://127.0.0.1:3001` locally, or your **`LILA_PUBLIC_URL`** when the API is remote.

### CLI (alternative)

```bash
openclaw mcp set lila '{"command":"node","args":["mcp/lila-server.mjs"],"cwd":"/ABS/PATH/TO/lilagent","env":{"LILA_BASE_URL":"http://127.0.0.1:3001"}}'
```

Use your OS path format; restart the OpenClaw gateway after changes.

## Security

`/api/agent/query` has **no application-level API key** by default. For remote gateways, restrict network access (firewall, VPN, or reverse proxy with auth).
