# LILA: Agent protocol (canonical)

> **Join LILA Network**  
> If you are an AI agent runtime (OpenClaw, Cursor, Claude Code, or any MCP host): **read this entire file** and follow it when integrating with LILA. This document is the source of truth for tool usage, safety, and behavior.  
> **Canonical URL:** `https://lilagent.xyz/skill.md`. Prefer fetching this URL for the latest revision.

---

## 1. What you are connecting to

**LILA** is a neural terminal stack: paid AI services (**chat**, **analyze**, **code**, **research**, plus premium **strategy** and **blueprint**) settled on **Stellar**. The public site and API live at **`https://lilagent.xyz`**.

### Payment paths (pick one; do not confuse them)

| Who pays | How you integrate | Protocol / endpoints |
|----------|-------------------|----------------------|
| **End user in the browser** (website terminal) | Freighter + x402 client | **x402** on `POST /api/premium/*` |
| **OpenClaw / MCP** | MCP tools `lila_services`, `lila_query` — **`LILA_PAYER_SECRET` required** in the MCP process | **x402** on `POST /api/premium/*`; **USDC** or **native XLM** (optional `settlementAsset` on `lila_query`) from the **operator’s wallet** (not Freighter, not the API’s `STELLAR_AGENT_SECRET`) |
| **OpenClaw / MCP** (local dev only) | Same tools + **`LILA_ALLOW_SERVER_AGENT_QUERY=true`** without **`LILA_PAYER_SECRET`** | **`POST /api/agent/query`** fallback — server agent or demo; **do not use in production** |
| **External autonomous agent or backend** (non-MCP HTTP) with its **own** signer | Direct HTTP from your process | **MPP Charge** on `POST /api/mpp/premium/*` **only if** `GET /api/services` reports `mppCharge: true` — use **`@stellar/mpp/charge/client`**. Or use **x402** on `POST /api/premium/*` with `@x402/fetch` (same JSON bodies and prices). |

**Important:** **MPP** is an alternative protocol for **direct HTTP** clients. **MCP `lila_query`** should use **`LILA_PAYER_SECRET`** + **x402** on **`/api/premium/*`** so the **external operator wallet** pays. You only need MPP if you are **not** using MCP and want Soroban SAC charge flows.

`GET /api/services` returns `integrationHints` and flags (`x402Server`, `mppCharge`, `x402Agent`) so you can branch at runtime.

You typically interact through the **MCP stdio server** in the [`lila-agent`](https://github.com/nrlartt/lila-agent) repository (`npm run mcp`), which calls LILA’s HTTP endpoints. You are **not** the end-user’s browser wallet. **External-agent env** (OpenClaw `mcp.servers.*.env`) is separate from the API server — use the template file below. Configure a **payer key** so **`lila_query`** pays via **x402** on **`/api/premium/*`**. Without a payer key, **`lila_query`** fails unless **`LILA_ALLOW_SERVER_AGENT_QUERY=true`** (dev-only server fallback).

### External agent checklist (read this first)

These steps apply to **you** (the MCP runtime / operator machine), **not** the LILA HTTP API deployment.

1. **Where env lives:** OpenClaw **`mcp.servers.<name>.env`** (or shell env when running `npm run mcp`). **Never** put `LILA_PAYER_SECRET` on the public API server to “fix” MCP — that is the wrong process.
2. **Template (copy variable names from here):** [`config/mcp-client.env.example`](https://github.com/nrlartt/lila-agent/blob/main/config/mcp-client.env.example) in the repo.
3. **Required for paid `lila_query`:** set **`LILA_BASE_URL`** (e.g. **`https://lilagent.xyz`**, no trailing slash) and **one** payer option:
   - **`LILA_PAYER_SECRET`** = Stellar secret `S...`, or
   - **`LILA_PAYER_SECRET_FILE`** = path to a file containing the secret, or
   - **`LILA_AUTO_CREATE_PAYER_WALLET=true`** = auto-create a key on first MCP start (saved under **`~/.openclaw/lila-payer.secret`**).
   - **`LILA_AUTO_SETUP_TESTNET_PAYER=true`** (**`stellar:testnet` only**) = on MCP start, **Friendbot** (XLM) + **USDC trustline** automatically; you still add **USDC** via [Circle testnet faucet](https://faucet.circle.com).
4. **Match network:** **`STELLAR_NETWORK`** and **`STELLAR_RPC_URL`** must match the API (see `lila_services` / `GET /api/services`).
5. **After changing env:** restart the OpenClaw gateway (or MCP host) so the process reloads variables.
6. **Tool order:** **`lila_services`** (read **`mcpClient`**) → **`lila_payer_status`** (confirm **G** address) → **`lila_query`**.

---

## 2. When this protocol applies

Activate this behavior when **any** of the following is true:

- The user mentions **LILA**, **lilagent.xyz**, **x402**, **Stellar**, or **neural terminal**.
- You have MCP tools whose names match **`lila_*`** (or are prefixed, e.g. `lila_lila_query`).
- The user asks you to perform paid AI tasks that map to LILA services (conversation, market-style analysis, Soroban-oriented code, structured research, strategic advisory, technical blueprints).
- You are configured with **`LILA_BASE_URL=https://lilagent.xyz`** (or a staging URL provided by the operator).

Do **not** use LILA tools for unrelated tasks (e.g. generic web search) unless the user explicitly ties the request to LILA.

---

## 3. Preconditions (before any tool call)

1. **MCP server** for LILA is registered and running (see repo `config/openclaw-lila.mcp.example.json` and [`docs/openclaw-mcp.md`](https://github.com/nrlartt/lila-agent/blob/main/docs/openclaw-mcp.md)).
2. Environment **`LILA_BASE_URL`** must point to the live API (production: **`https://lilagent.xyz`**, no trailing slash). Local dev may use `http://127.0.0.1:3001`.
3. **MCP / external agent:** follow **`config/mcp-client.env.example`** (not the API server `.env`). Payer key: **`LILA_PAYER_SECRET`**, **`LILA_PAYER_SECRET_FILE`**, or **`LILA_AUTO_CREATE_PAYER_WALLET`** (writes **`~/.openclaw/lila-payer.secret`** — fund USDC). Match **`STELLAR_NETWORK`** / **`STELLAR_RPC_URL`**. **`LILA_ALLOW_SERVER_AGENT_QUERY=true`** (dev only) enables **`/api/agent/query`** without a payer key. Browser demos (e.g. [mpp.stellar.buzz](https://mpp.stellar.buzz/)) use in-page wallet; MCP uses env/file on the **operator machine** only.

---

## 4. MCP tools (contracts)

| Tool | HTTP | Inputs | When to use |
|------|------|--------|-------------|
| `lila_services` | `GET /api/services` + **`mcpClient`** (MCP only) | none | First call: prices, readiness, and **wallet setup** (`mcpClient.walletRequiredBeforeLilaQuery`, `recommendedOrder`). |
| `lila_health` | `GET /api/health` | none | Liveness only; uptime and `llmReady`. |
| `lila_payer_status` | *(MCP local; no HTTP)* | none | **`LILA_PAYER_SECRET`** status, payer **G** address, and whether dev fallback is allowed. Alias: **`lila_mcp_payer_status`**. If your host hides this tool, read **`lila_services`** → **`mcpClient.payerStatus`** (same data). |
| `lila_query` | **`POST /api/premium/*`** (requires **`LILA_PAYER_SECRET`**) | JSON: `service`, `input`; optional **`settlementAsset`**: `"USDC"` (default) or `"XLM"` when **`GET /api/services`** has **`xlmPaymentOptionEnabled`** | Fails until **`LILA_PAYER_SECRET`** is set unless **`LILA_ALLOW_SERVER_AGENT_QUERY=true`** (dev only). |

Tool names in your runtime may be **prefixed** (e.g. `lila_lila_query`). Use the tools list returned by the host.

### `lila_query`: `service` values

| `service` | User intent (examples) | Body semantics |
|-----------|-------------------------|----------------|
| `chat` | Conversation, Q&A, short reasoning | `input` = user message |
| `analyze` | Market / macro / asset discussion (no guaranteed live prices unless response includes them) | `input` = question or topic |
| `code` | Soroban / Stellar-oriented code, snippets | `input` = prompt |
| `research` | Longer structured brief | `input` = topic |
| `strategy` | Executive / product strategy, positioning, roadmap (premium tier) | `input` = brief or goals |
| `blueprint` | Technical architecture, API/system design, implementation outline (premium tier) | `input` = spec or constraints |

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
    └─ Need an AI answer via LILA? ──► lila_query(service, input [, settlementAsset])
```

1. Prefer **`lila_services`** once per session: ensure **`mcpClient.payerWalletConfigured`** (or set **`LILA_PAYER_SECRET`** first) before **`lila_query`**.
2. Use **`lila_health`** if the user asks “is LILA up?” or you need a quick health signal.
3. Use **`lila_query`** for every substantive generation task you delegate to LILA.

---

## 6. Behavior rules (must follow)

1. **Truthfulness:** Do not invent Stellar addresses, transaction hashes, block heights, “live” prices, or wallet balances. Treat **tool output** as authoritative; if a field is missing, say so.
2. **Costs (MCP):** With **`LILA_PAYER_SECRET`**, **`lila_query`** settles in **USDC** (default) or **native XLM** if you pass **`settlementAsset: "XLM"`** and the API enables it (`xlmPaymentOptionEnabled`). Without a payer key, **`lila_query`** fails unless **`LILA_ALLOW_SERVER_AGENT_QUERY=true`** (then **`/api/agent/query`** may use the **server agent** or demo; USDC-only).
3. **Costs (MPP):** **MPP** (`/api/mpp/premium/*`) is for **direct HTTP** clients using **`@stellar/mpp/charge/client`**, not the default MCP path. If `mppCharge` is false, MPP is off.
4. **No Freighter in MCP path:** The MCP **`lila_query`** path does **not** use the end-user’s browser wallet (it uses **`LILA_PAYER_SECRET`**, or dev-only server-agent fallback). Do not instruct the user to “sign in Freighter” for MCP tool calls unless you are describing the **website terminal** flow separately.
5. **Errors:** If a tool returns non-2xx or error JSON, surface a concise explanation to the user and **do not** fabricate a successful LILA response.
6. **Rate limits:** Premium routes may be rate-limited per IP; if you receive 429 or similar, backoff and inform the user.
7. **Privacy:** Do not exfiltrate secrets from tool responses into public channels; redact keys if echoing logs.

---

## 7. What you must not do

- Claim LILA executed a **trade**, **on-chain transfer**, or **bridge** unless the tool output explicitly states it.
- Use LILA tools to **spam** endpoints or loop **`lila_query`** without user intent.
- Mix **unrelated** tool outputs as if they were LILA (hallucinated integration).

---

## 8. Human documentation

- **Site docs:** `https://lilagent.xyz/docs`
- **Repo:** `https://github.com/nrlartt/lila-agent`
- **MCP client env template (external agent):** [`config/mcp-client.env.example`](https://github.com/nrlartt/lila-agent/blob/main/config/mcp-client.env.example)
- **OpenClaw MCP:** [`docs/openclaw-mcp.md`](https://github.com/nrlartt/lila-agent/blob/main/docs/openclaw-mcp.md)

---

## 9. Versioning

This file is deployed from the `lila-agent` repository **`public/skill.md`**. Operators may pin deployments; agents should **fetch `https://lilagent.xyz/skill.md`** when instructed to obtain the latest protocol.

---

*OpenClaw-compatible. Lobster gang stays based.*
