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
| `lila_services` | `GET /api/services`: prices, `network`, `llmReady`, x402 flags |
| `lila_health` | `GET /api/health`: liveness |
| `lila_query` | `POST /api/agent/query`: body `{ "service": "chat"\|"analyze"\|"code"\|"research", "input": "..." }` |

**Env:** `LILA_BASE_URL=https://lilagent.xyz` (no trailing slash). **Repo:** [nrlartt/lila-agent](https://github.com/nrlartt/lila-agent). **MCP config:** `config/openclaw-lila.mcp.example.json`.

## OpenClaw

Pair the device (`openclaw devices pair`), set `agents.defaults.model` / `models.providers`, add the MCP block from the repo README, restart the gateway, then verify tools in the OpenClaw UI.
