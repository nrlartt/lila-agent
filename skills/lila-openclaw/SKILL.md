---
name: lila-openclaw
description: LILA neural terminal, Stellar x402, MCP tools (lila_services, lila_health, lila_query), OpenClaw pairing. Use when the user works with LILA, lilagent.xyz, or OpenClaw + LILA.
---

# LILA + OpenClaw

**Canonical agent protocol (read first):** [https://lilagent.xyz/skill.md](https://lilagent.xyz/skill.md)

That URL is the **full** specification: when to activate, MCP tool contracts, `lila_query` `service`/`input` mapping, safety rules, and decision flow. This skill file is a **pointer**; prefer fetching `skill.md` for the latest revision.

## Quick reference

| Tool | Role |
|------|------|
| `lila_services` | `GET /api/services`: prices, `network`, `llmReady`, x402 flags, **`integrationHints`**, **`mppCharge`** |
| `lila_health` | `GET /api/health`: liveness |
| `lila_payer_status` | MCP-only: `LILA_PAYER_SECRET` active? payer **G** address (no secret) |
| `lila_query` | **`LILA_PAYER_SECRET` required** → x402 on `POST /api/premium/*`. Dev-only: `LILA_ALLOW_SERVER_AGENT_QUERY=true` → `POST /api/agent/query` fallback. Body: `{ "service": "chat"\|"analyze"\|"code"\|"research"\|"strategy"\|"blueprint", "input": "..." }` |

**Env (OpenClaw MCP only, not API server):** see [config/mcp-client.env.example](https://github.com/nrlartt/lila-agent/blob/main/config/mcp-client.env.example). **`LILA_BASE_URL`**, **`LILA_PAYER_SECRET`** (or file / **`LILA_AUTO_CREATE_PAYER_WALLET`**), **`STELLAR_NETWORK`**, **`STELLAR_RPC_URL`**. **Repo:** [nrlartt/lila-agent](https://github.com/nrlartt/lila-agent). **MCP config:** `config/openclaw-lila.mcp.example.json`.

**MPP Charge** (`POST /api/mpp/premium/*`): for **non-MCP** HTTP clients (`@stellar/mpp/charge/client`). OpenClaw should prefer **`lila_query`** + **`LILA_PAYER_SECRET`**. See canonical [skill.md](https://lilagent.xyz/skill.md) payment table.

## OpenClaw

Pair the device (`openclaw devices pair`), set `agents.defaults.model` / `models.providers`, add the MCP block from the repo README, restart the gateway, then verify tools in the OpenClaw UI.
