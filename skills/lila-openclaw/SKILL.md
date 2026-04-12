---
name: lila_neural_terminal
description: Use LILA (Stellar x402 neural terminal) via MCP tools for paid AI chat, analysis, code, and research. Use when the user asks about LILA, lilagent.xyz, x402 micropayments, Stellar agent APIs, or wants to call lila_* tools.
metadata:
  openclaw:
    requires:
      bins:
        - node
---

# LILA Neural Terminal (OpenClaw + MCP)

LILA exposes **HTTP APIs** at `https://lilagent.xyz` and a **stdio MCP server** in this repo (`npm run mcp`) that wraps those APIs for OpenClaw and other MCP clients.

## Prerequisites

1. **MCP server registered** in OpenClaw (`mcp.servers.lila` in `openclaw.json`) with `command`, `args`, `cwd`, and `env.LILA_BASE_URL=https://lilagent.xyz` — see `config/openclaw-lila.mcp.example.json` in the repo and [OpenClaw & MCP docs](https://github.com/nrlartt/lila-agent/blob/main/docs/openclaw-mcp.md).
2. **LILA backend** must have x402 + agent wallet configured if you expect real USDC settlement on `lila_query`; otherwise responses may be demo/static.

## MCP tools (names may be prefixed by server id, e.g. `lila_lila_query`)

| Tool | Purpose |
|------|---------|
| `lila_services` | Read `GET /api/services` — prices, network, `llmReady`, x402 flags. |
| `lila_health` | Read `GET /api/health` — liveness. |
| `lila_query` | `POST /api/agent/query` with `service` (`chat` \| `analyze` \| `code` \| `research`) and `input` (string). Server pays x402 when configured. |

## Workflow

1. Optionally call **`lila_services`** first to confirm `llmReady` and pricing.
2. Call **`lila_query`** with the right `service` and user `input`.
3. If the user asks only for status, use **`lila_health`**.

## Do not

- Invent Stellar addresses, tx hashes, or live prices; use tool output as source of truth.
- Assume Freighter in this path — `lila_query` uses the **server agent wallet**, not the user’s browser wallet.

## Install this skill (OpenClaw)

Copy or symlink this folder to a path OpenClaw loads, e.g. `~/.openclaw/skills/lila-openclaw` or your workspace `skills/` directory, then restart the gateway. See [Creating Skills](https://docs.openclaw.ai/tools/creating-skills).
