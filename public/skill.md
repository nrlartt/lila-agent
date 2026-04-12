# LILA — Agent protocol (canonical)

> **Join LILA Network**  
> If you are an AI agent runtime (OpenClaw, Cursor, Claude Code, or any MCP host): **read this entire file** and follow it when integrating with LILA. This document is the source of truth for tool usage, safety, and behavior.  
> **Canonical URL:** `https://lilagent.xyz/skill.md` — prefer fetching this URL for the latest revision.

---

## 1. What you are connecting to

**LILA** is a neural terminal stack: paid AI services (**chat**, **analyze**, **code**, **research**) settled on **Stellar** via **x402** (HTTP 402 + Soroban + USDC). The public site and API live at **`https://lilagent.xyz`**.

You typically interact through the **MCP stdio server** in the [`lila-agent`](https://github.com/nrlartt/lila-agent) repository (`npm run mcp`), which calls LILA’s HTTP endpoints. You are **not** the end-user’s browser wallet; **`lila_query`** uses the **operator’s server agent wallet** when x402 is enabled.

---

## 2. When this protocol applies

Activate this behavior when **any** of the following is true:

- The user mentions **LILA**, **lilagent.xyz**, **x402**, **Stellar**, or **neural terminal**.
- You have MCP tools whose names match **`lila_*`** (or are prefixed, e.g. `lila_lila_query`).
- The user asks you to perform paid AI tasks that map to LILA services (conversation, market-style analysis, Soroban-oriented code, structured research).
- You are configured with **`LILA_BASE_URL=https://lilagent.xyz`** (or a staging URL provided by the operator).

Do **not** use LILA tools for unrelated tasks (e.g. generic web search) unless the user explicitly ties the request to LILA.

---

## 3. Preconditions (before any tool call)

1. **MCP server** for LILA is registered and running (see repo `config/openclaw-lila.mcp.example.json` and [`docs/openclaw-mcp.md`](https://github.com/nrlartt/lila-agent/blob/main/docs/openclaw-mcp.md)).
2. Environment **`LILA_BASE_URL`** must point to the live API (production: **`https://lilagent.xyz`**, no trailing slash). Local dev may use `http://127.0.0.1:3001`.
3. Understand that **real USDC** may be spent when the server has **`STELLAR_PAY_TO`**, **`STELLAR_AGENT_SECRET`**, and a funded agent wallet; **`lila_services`** exposes whether x402 and agent are ready.

---

## 4. MCP tools — contracts

| Tool | HTTP | Inputs | When to use |
|------|------|--------|-------------|
| `lila_services` | `GET /api/services` | none | First call to learn prices, `network`, `llmReady`, `x402Server`, `x402Agent`. |
| `lila_health` | `GET /api/health` | none | Liveness only; uptime and `llmReady`. |
| `lila_query` | `POST /api/agent/query` | JSON: `service`, `input` | All paid AI work routed through LILA. |

Tool names in your runtime may be **prefixed** (e.g. `lila_lila_query`). Use the tools list returned by the host.

### `lila_query` — `service` values

| `service` | User intent (examples) | Body semantics |
|-----------|-------------------------|----------------|
| `chat` | Conversation, Q&A, short reasoning | `input` = user message |
| `analyze` | Market / macro / asset discussion (no guaranteed live prices unless response includes them) | `input` = question or topic |
| `code` | Soroban / Stellar-oriented code, snippets | `input` = prompt |
| `research` | Longer structured brief | `input` = topic |

Map the user’s natural language to **one** `service` per call. If unclear, default to **`chat`** and keep `input` faithful to the user’s words.

---

## 5. Mandatory decision flow

```
User request about LILA / paid AI / Stellar x402
    │
    ├─ Need catalog, pricing, or readiness? ──► lila_services
    │
    ├─ Need only up/down status? ──► lila_health
    │
    └─ Need an AI answer via LILA? ──► lila_query(service, input)
```

1. Prefer **`lila_services`** once per session (or when the user asks about cost/network) before heavy use of **`lila_query`**.
2. Use **`lila_health`** if the user asks “is LILA up?” or you need a quick health signal.
3. Use **`lila_query`** for every substantive generation task you delegate to LILA.

---

## 6. Behavior rules (must follow)

1. **Truthfulness:** Do not invent Stellar addresses, transaction hashes, block heights, “live” prices, or wallet balances. Treat **tool output** as authoritative; if a field is missing, say so.
2. **Costs:** When `x402Server` / payment info is present, acknowledge that requests may incur **USDC** cost borne by the **server agent** (not the chat user’s Freighter). Do not promise free mainnet spend.
3. **No Freighter in MCP path:** The MCP **`lila_query`** path does **not** use the end-user’s browser wallet. Do not instruct the user to “sign in Freighter” for MCP tool calls unless you are describing the **website terminal** flow separately.
4. **Errors:** If a tool returns non-2xx or error JSON, surface a concise explanation to the user and **do not** fabricate a successful LILA response.
5. **Rate limits:** Premium routes may be rate-limited per IP; if you receive 429 or similar, backoff and inform the user.
6. **Privacy:** Do not exfiltrate secrets from tool responses into public channels; redact keys if echoing logs.

---

## 7. What you must not do

- Claim LILA executed a **trade**, **on-chain transfer**, or **bridge** unless the tool output explicitly states it.
- Use LILA tools to **spam** endpoints or loop **`lila_query`** without user intent.
- Mix **unrelated** tool outputs as if they were LILA (hallucinated integration).

---

## 8. Human documentation

- **Site docs:** `https://lilagent.xyz/docs`
- **Repo:** `https://github.com/nrlartt/lila-agent`
- **OpenClaw MCP:** [`docs/openclaw-mcp.md`](https://github.com/nrlartt/lila-agent/blob/main/docs/openclaw-mcp.md)

---

## 9. Versioning

This file is deployed from the `lila-agent` repository **`public/skill.md`**. Operators may pin deployments; agents should **fetch `https://lilagent.xyz/skill.md`** when instructed to obtain the latest protocol.

---

*OpenClaw-compatible. Lobster gang stays based.*
