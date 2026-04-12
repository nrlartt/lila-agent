/**
 * MCP server (stdio). Exposes LILA to OpenClaw, Cursor, Claude Code, and other MCP clients.
 * Calls POST /api/agent/query on the LILA backend (x402 paid when STELLAR_AGENT_SECRET is set).
 *
 * Do not write to stdout except MCP JSON-RPC (use console.error for debug).
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

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

const server = new McpServer(
  {
    name: "lila-neural-terminal",
    version: "4.0.0",
  },
  {
    instructions: [
      "LILA Neural Terminal on Stellar: paid AI (chat, analyze, code, research) via x402.",
      "Prerequisites: LILA HTTP server running; for real USDC payments set STELLAR_PAY_TO and STELLAR_AGENT_SECRET on the server.",
      "Production API: set LILA_BASE_URL=https://lilagent.xyz (or http://127.0.0.1:" +
        PORT +
        " locally).",
      "Primary tool: lila_query(service, input). Routes through /api/agent/query.",
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
      "Run a paid LILA service. Uses server-side x402 when STELLAR_AGENT_SECRET is configured; otherwise returns demo/static responses.",
    inputSchema: {
      service: serviceSchema.describe("LILA service id"),
      input: z.string().min(1).describe("User message, query, prompt, or research topic"),
    },
  },
  async ({ service, input }) => {
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
