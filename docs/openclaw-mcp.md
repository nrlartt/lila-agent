# OpenClaw, Stellar x402, and LILA MCP

This project exposes LILA to **any MCP client** (including [OpenClaw](https://docs.openclaw.ai/)) via a **stdio MCP server**. **`lila_query`** uses **`LILA_PAYER_SECRET`** (your Stellar secret in the MCP `env`) to pay via **x402** on **`POST /api/premium/*`**. If **`LILA_PAYER_SECRET`** is unset, it falls back to **`POST /api/agent/query`** (demo or the API server’s **`STELLAR_AGENT_SECRET`**).

**Production API origin:** **`https://lilagent.xyz`** (no path prefix). Other agents should use this as **`LILA_BASE_URL`** when calling the MCP-backed HTTP API.

For background on x402, MPP, and Stellar tooling, see [Stellar agentic resources](stellar-agentic-resources.md).

## What you need on the LILA side

1. **LILA HTTP server** running (`npm run dev:server` or `npm start`).
2. **Stellar (API server):** `STELLAR_PAY_TO` and facilitator settings so **`/api/premium/*`** can settle x402. For **OpenClaw paying from your wallet**, add **`LILA_PAYER_SECRET`** to the MCP process (funded with USDC + XLM). Server **`STELLAR_AGENT_SECRET`** is only needed for the **`/api/agent/query`** fallback when MCP does not set **`LILA_PAYER_SECRET`**. See [Environment](environment.md).
3. **Env on the server:** `LILA_PUBLIC_URL=https://lilagent.xyz` (and `CORS_ORIGIN` including `https://lilagent.xyz`).

## MCP server (stdio)

From the repository root (after `npm install`):

```bash
npm run mcp
```

Tools: `lila_services`, `lila_health`, `lila_payer_status` (whether `LILA_PAYER_SECRET` is active), `lila_query` (see [API](api.md)).

On a machine that talks to **production**, set before starting the MCP process:

```bash
# Linux/macOS
export LILA_BASE_URL=https://lilagent.xyz
npm run mcp
```

```powershell
# Windows PowerShell
$env:LILA_BASE_URL = "https://lilagent.xyz"
npm run mcp
```

Optional: **`LILA_DOTENV_PATH`**: absolute path to `.env` if the MCP process is started with a working directory outside this repo.

## Register LILA in OpenClaw

OpenClaw stores outbound MCP definitions under **`mcp.servers`** in `~/.openclaw/openclaw.json` (see [OpenClaw CLI: mcp](https://docs.openclaw.ai/cli/mcp)).

### Stdio fields (official)

| Field | Purpose |
| --- | --- |
| `command` | Executable (e.g. `node`) |
| `args` | Arguments (e.g. `mcp/lila-server.mjs`) |
| `cwd` / `workingDirectory` | **Repository root** (where `node_modules` exists) |
| `env` | **`LILA_BASE_URL`**: `https://lilagent.xyz` (or `http://127.0.0.1:3001` locally). **`LILA_PAYER_SECRET`**: your Stellar secret so **`lila_query`** pays via x402 (recommended). Optional: **`STELLAR_NETWORK`**, **`STELLAR_RPC_URL`** to match the deployment. |

### Example fragment

Copy and merge **`config/openclaw-lila.mcp.example.json`** into your OpenClaw config. Set:

- **`cwd`**: absolute path to this repo on your machine.
- **`env.LILA_BASE_URL`**: **`https://lilagent.xyz`** when the agent should use the live deployment.

### CLI (alternative)

```bash
openclaw mcp set lila '{"command":"node","args":["mcp/lila-server.mjs"],"cwd":"/ABS/PATH/TO/lilagent","env":{"LILA_BASE_URL":"https://lilagent.xyz","LILA_PAYER_SECRET":"YOUR_S_SECRET"}}'
```

For local development only:

```bash
openclaw mcp set lila '{"command":"node","args":["mcp/lila-server.mjs"],"cwd":"/ABS/PATH/TO/lilagent","env":{"LILA_BASE_URL":"http://127.0.0.1:3001"}}'
```

Use your OS path format; restart the OpenClaw gateway after changes.

### Automated bootstrap (same machine as the repo)

After `npm install`, from the repository root:

```bash
npm run openclaw:bootstrap
```

This copies **`skills/lila-openclaw`** to **`~/.openclaw/skills/lila-openclaw`** (override with **`OPENCLAW_HOME`**) and prints a ready-to-paste **`openclaw mcp set lila`** command with **`cwd`** pointing at this repo and **`LILA_BASE_URL`** defaulting to **`https://lilagent.xyz`**. Use **`--base-url=https://...`** or **`LILA_BASE_URL`** to change the API origin.

**x402:** **`STELLAR_PAY_TO`** and **`STELLAR_AGENT_SECRET`** belong on the **LILA HTTP server** environment (e.g. Railway), not on the OpenClaw MCP client. The MCP process only calls your public API; settlement uses the server’s agent wallet when those vars are set on the API.

## MCP vs Skill: do agents need a Skill?

| Layer | Required? | Role |
|-------|-----------|------|
| **MCP server** (`npm run mcp` + `mcp.servers` in OpenClaw) | **Yes** for tool calls | Registers `lila_services`, `lila_health`, `lila_payer_status`, `lila_query` so the gateway can spawn the process and expose tools. |
| **Skill** (`SKILL.md`) | **No**, but **recommended** | Teaches the model *when* to use LILA (x402, Stellar, paid AI) and *how* to sequence tools. Without a skill, tools may still appear in context if MCP is wired, but behavior is less consistent. |

This repo ships an optional skill: **`skills/lila-openclaw/SKILL.md`**. Install it per [Creating Skills](https://docs.openclaw.ai/tools/creating-skills) (e.g. copy the folder to `~/.openclaw/skills/lila-openclaw` or your workspace skills path) and restart the gateway.

## Security

`/api/agent/query` has **no application-level API key** by default. For remote gateways, restrict network access (firewall, VPN, or reverse proxy with auth).
