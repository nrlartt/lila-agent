/**
 * MCP server (stdio). Exposes LILA to OpenClaw, Cursor, Claude Code, and other MCP clients.
 *
 * When LILA_PAYER_SECRET is set, lila_query pays from that wallet via x402 on POST /api/premium/*.
 * Otherwise it falls back to POST /api/agent/query (demo or server STELLAR_AGENT_SECRET).
 *
 * Do not write to stdout except MCP JSON-RPC (use console.error for debug).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getPayerPaidFetch } from "./x402PayerClient.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath =
  process.env.LILA_DOTENV_PATH?.trim() || path.join(__dirname, "..", ".env");
dotenv.config({
  path: envPath,
  override: true,
  quiet: true,
});

const PORT = process.env.PORT || "3001";
const baseUrl = (process.env.LILA_BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");

const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";
const RPC_URL = process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const PAY_TO = process.env.STELLAR_PAY_TO?.trim() || "";

const BODY_KEY_MAP = { chat: "message", analyze: "query", code: "prompt", research: "topic" };
const PRICE_MAP = { chat: "$0.001", analyze: "$0.01", code: "$0.005", research: "$0.02" };

const EXPLORER_BASE =
  NETWORK === "stellar:testnet"
    ? "https://stellar.expert/explorer/testnet/tx/"
    : "https://stellar.expert/explorer/public/tx/";

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

function jsonResult(obj) {
  return textResult(JSON.stringify(obj, null, 2));
}

async function httpJson(method, url, body) {
  const opts = { method, headers: { Accept: "application/json" } };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  return { ok: res.ok, status: res.status, data };
}

async function queryWithExternalPayer(service, input) {
  const secret = process.env.LILA_PAYER_SECRET?.trim();
  if (!secret) {
    throw new Error("LILA_PAYER_SECRET not configured");
  }

  const { paidFetch, payerAddress } = await getPayerPaidFetch(secret, NETWORK, RPC_URL);
  const bodyKey = BODY_KEY_MAP[service];
  const price = PRICE_MAP[service];
  const url = `${baseUrl}/api/premium/${service}`;

  const res = await paidFetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ [bodyKey]: input }),
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  if (res.status === 402) {
    return jsonResult({
      error: "Payment required (402)",
      status: res.status,
      body: data,
      hint: "Fund the wallet for LILA_PAYER_SECRET with USDC on this network and retry.",
    });
  }

  if (!res.ok) {
    return jsonResult({ error: "Request failed", status: res.status, body: data });
  }

  let txHash = null;
  try {
    const { decodePaymentResponseHeader } = await import("@x402/fetch");
    const hdr =
      res.headers.get("X-PAYMENT-RESPONSE") ||
      res.headers.get("PAYMENT-RESPONSE") ||
      res.headers.get("x-payment-response");
    if (hdr) {
      const settled = decodePaymentResponseHeader(hdr);
      txHash = settled?.txHash ?? settled?.transaction ?? null;
    }
  } catch {
    /* optional */
  }

  return jsonResult({
    service,
    response: data?.response ?? data,
    cost: data?.cost ?? price,
    network: NETWORK,
    timestamp: new Date().toISOString(),
    payment: {
      paid: true,
      payer: payerAddress,
      payTo: PAY_TO || null,
      txHash,
      explorerUrl: txHash ? EXPLORER_BASE + txHash : null,
      mode: "external_payer",
    },
  });
}

const server = new McpServer(
  {
    name: "lila-neural-terminal",
    version: "4.0.0",
  },
  {
    instructions: [
      "LILA Neural Terminal on Stellar: paid AI (chat, analyze, code, research) via x402.",
      "Set LILA_PAYER_SECRET in the MCP process env so OpenClaw pays from YOUR Stellar wallet (POST /api/premium/*).",
      "If LILA_PAYER_SECRET is unset, lila_query uses POST /api/agent/query (demo or server agent wallet).",
      "Production API: LILA_BASE_URL=https://lilagent.xyz (or http://127.0.0.1:" + PORT + " locally).",
      "Match STELLAR_NETWORK and STELLAR_RPC_URL to the deployment (testnet vs mainnet).",
    ].join(" "),
  },
);

server.registerTool(
  "lila_services",
  {
    description:
      "List LILA services, prices, network, and whether x402 and the server agent wallet are ready.",
  },
  async () => {
    const { ok, status, data } = await httpJson("GET", `${baseUrl}/api/services`);
    if (!ok) {
      return jsonResult({ error: "Request failed", status, body: data });
    }
    return jsonResult(data);
  },
);

server.registerTool(
  "lila_health",
  {
    description: "LILA API liveness and llmReady flag.",
  },
  async () => {
    const { ok, status, data } = await httpJson("GET", `${baseUrl}/api/health`);
    if (!ok) {
      return jsonResult({ error: "Request failed", status, body: data });
    }
    return jsonResult(data);
  },
);

const serviceSchema = z.enum(["chat", "analyze", "code", "research"]);

server.registerTool(
  "lila_query",
  {
    description:
      "Run a paid LILA service. If LILA_PAYER_SECRET is set, pays from that wallet (x402 on /api/premium/*). Otherwise uses /api/agent/query (server agent or demo).",
    inputSchema: {
      service: serviceSchema.describe("LILA service id"),
      input: z.string().min(1).describe("User message, query, prompt, or research topic"),
    },
  },
  async ({ service, input }) => {
    if (process.env.LILA_PAYER_SECRET?.trim()) {
      return queryWithExternalPayer(service, input);
    }

    const { ok, status, data } = await httpJson("POST", `${baseUrl}/api/agent/query`, {
      service,
      input,
    });
    if (!ok) {
      return jsonResult({ error: "Request failed", status, body: data });
    }
    return jsonResult(data);
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[lila-mcp]", err);
  process.exit(1);
});
