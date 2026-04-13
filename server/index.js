import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import {
  setupAgentClient,
  getAgentAddress,
  isAgentReady,
  payForService,
} from "./agentClient.js";
import { setupLLM, generateAIResponse, getProvider } from "./llm.js";
import { rateLimitPremium } from "./rateLimit.js";
import { registerMppChargeRoutes } from "./mppChargeRoutes.js";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  override: true,
  quiet: true,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

if (process.env.ENABLE_HSTS === "true") {
  app.use(
    helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    }),
  );
}

const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";
const PAY_TO = process.env.STELLAR_PAY_TO || "";
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://www.x402.org/facilitator";
const AGENT_SECRET = process.env.STELLAR_AGENT_SECRET || "";
const RPC_URL =
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";

const EXPLORER_BASE =
  NETWORK === "stellar:testnet"
    ? "https://stellar.expert/explorer/testnet/tx/"
    : "https://stellar.expert/explorer/public/tx/";

const MPP_ENABLED = process.env.MPP_ENABLED === "true" || process.env.MPP_ENABLED === "1";
const MPP_SECRET_KEY = process.env.MPP_SECRET_KEY || "";

let mppChargeActive = false;

const corsOrigin =
  process.env.NODE_ENV !== "production"
    ? true
    : process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
      : true;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/premium") || req.path.startsWith("/api/mpp")) {
    return rateLimitPremium(req, res, next);
  }
  next();
});

const distDir = path.join(__dirname, "../dist");
const skillMdPath = path.join(distDir, "skill.md");

if (process.env.NODE_ENV === "production") {
  /** Explicit route so /skill.md is never mistaken for SPA; correct Content-Type for agents. */
  app.get("/skill.md", (_req, res, next) => {
    res.type("text/markdown; charset=utf-8");
    res.sendFile(skillMdPath, (err) => {
      if (err) next(err);
    });
  });
  app.use(express.static(distDir));
}

// ──────────────────────────────────────────────
//  x402 MIDDLEWARE (must be registered BEFORE premium routes)
// ──────────────────────────────────────────────

let x402Active = false;
let x402Mw = null;

// Placeholder that delegates to the real middleware once loaded.
// Must be at root level so x402 sees full path for route matching.
app.use((req, res, next) => {
  if (x402Mw && req.path.startsWith("/api/premium")) {
    return x402Mw(req, res, next);
  }
  next();
});

async function setupX402Server() {
  if (!PAY_TO) {
    console.warn("[SERVER] STELLAR_PAY_TO not set; x402 middleware disabled");
    return;
  }
  try {
    const { paymentMiddlewareFromConfig } = await import("@x402/express");
    const { HTTPFacilitatorClient } = await import("@x402/core/server");
    const { ExactStellarScheme } = await import(
      "@x402/stellar/exact/server"
    );

    x402Mw = paymentMiddlewareFromConfig(
      {
        "POST /api/premium/chat": {
          accepts: {
            scheme: "exact",
            price: "$0.001",
            network: NETWORK,
            payTo: PAY_TO,
          },
        },
        "POST /api/premium/analyze": {
          accepts: {
            scheme: "exact",
            price: "$0.01",
            network: NETWORK,
            payTo: PAY_TO,
          },
        },
        "POST /api/premium/code": {
          accepts: {
            scheme: "exact",
            price: "$0.005",
            network: NETWORK,
            payTo: PAY_TO,
          },
        },
        "POST /api/premium/research": {
          accepts: {
            scheme: "exact",
            price: "$0.02",
            network: NETWORK,
            payTo: PAY_TO,
          },
        },
      },
      new HTTPFacilitatorClient({ url: FACILITATOR_URL }),
      [{ network: NETWORK, server: new ExactStellarScheme() }],
    );

    x402Active = true;
    console.log("[SERVER] x402 middleware active; premium endpoints protected");
  } catch (err) {
    console.warn("[SERVER] x402 middleware setup failed:", err.message);
  }
}

// ──────────────────────────────────────────────
//  FREE ENDPOINTS
// ──────────────────────────────────────────────

app.get("/api/services", (_req, res) => {
  const llm = getProvider();
  res.json({
    name: "LILA Neural Terminal",
    version: "4.0",
    network: NETWORK,
    /** Human-readable; no internal provider or model names exposed */
    networkLabel: NETWORK === "stellar:pubnet" ? "Mainnet" : "Testnet",
    rpcUrl: RPC_URL,
    payTo: PAY_TO || null,
    x402Server: x402Active,
    x402Agent: isAgentReady(),
    userPaysWithWallet: x402Active,
    mppCharge: mppChargeActive,
    mppPremiumBase: mppChargeActive ? "/api/mpp/premium" : null,
    /** Helps autonomous agents pick the right HTTP integration (see public/skill.md). */
    integrationHints: {
      websiteTerminal: {
        protocol: "x402",
        description: "Browser + Freighter; user signs each paid call.",
        paths: ["POST /api/premium/chat", "POST /api/premium/analyze", "POST /api/premium/code", "POST /api/premium/research"],
      },
      mcpLilaQuery: {
        protocol: "x402",
        description:
          "MCP lila_query: set LILA_PAYER_SECRET in the MCP env to pay from the operator wallet on POST /api/premium/*; if unset, falls back to POST /api/agent/query (server agent or demo).",
        paths: [
          "POST /api/premium/chat",
          "POST /api/premium/analyze",
          "POST /api/premium/code",
          "POST /api/premium/research",
          "POST /api/agent/query",
        ],
      },
      externalAgentMpp: {
        protocol: "mpp-charge",
        description:
          "For integrations that hold their own Stellar key and pay per request without MCP lila_query. Only when mppCharge is true. Use @stellar/mpp/charge/client, not @x402/fetch.",
        paths: mppChargeActive
          ? [
              "POST /api/mpp/premium/chat",
              "POST /api/mpp/premium/analyze",
              "POST /api/mpp/premium/code",
              "POST /api/mpp/premium/research",
            ]
          : [],
      },
    },
    llmReady: llm !== "static",
    services: [
      { id: "chat", name: "Neural Chat", price: "$0.001", description: "Conversation with LILA" },
      { id: "analyze", name: "Market Analysis", price: "$0.01", description: "Analysis with live crypto quotes when applicable" },
      { id: "code", name: "Code Generation", price: "$0.005", description: "Soroban / Stellar-oriented code" },
      { id: "research", name: "Deep Research", price: "$0.02", description: "Structured research briefs" },
    ],
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "online",
    agent: "LILA",
    version: "4.0",
    uptime: process.uptime(),
    x402Server: x402Active,
    llmReady: getProvider() !== "static",
  });
});

// ──────────────────────────────────────────────
//  AGENT ENDPOINT (routes queries through x402)
// ──────────────────────────────────────────────

const BODY_KEY_MAP = { chat: "message", analyze: "query", code: "prompt", research: "topic" };
const PRICE_MAP = { chat: "$0.001", analyze: "$0.01", code: "$0.005", research: "$0.02" };
/** Base URL for server→server calls to premium routes (Docker / reverse proxy: set explicitly). */
const INTERNAL_BASE = (process.env.LILA_INTERNAL_BASE_URL || `http://127.0.0.1:${PORT}`).replace(
  /\/$/,
  "",
);

app.post("/api/agent/query", async (req, res) => {
  const { service, input } = req.body;

  if (!service || !input) {
    return res.status(400).json({ error: "Missing service or input" });
  }
  if (!["chat", "analyze", "code", "research"].includes(service)) {
    return res.status(400).json({ error: `Unknown service: ${service}` });
  }

  const bodyKey = BODY_KEY_MAP[service];
  const price = PRICE_MAP[service];
  const premiumUrl = `${INTERNAL_BASE}/api/premium/${service}`;

  if (x402Active && isAgentReady()) {
    try {
      console.log(`[AGENT] Paying for ${service} (${price})...`);
      const result = await payForService(premiumUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [bodyKey]: input }),
      });

      console.log(`[AGENT] Result: paid=${result.paid}, status=${result.status}, txHash=${result.txHash || "none"}`);

      return res.json({
        service,
        response: result.data?.response || "No response from service",
        cost: price,
        network: NETWORK,
        timestamp: new Date().toISOString(),
        payment: {
          paid: result.paid,
          txHash: result.txHash,
          explorerUrl: result.txHash ? EXPLORER_BASE + result.txHash : null,
          payer: result.payer,
          payTo: PAY_TO,
          settlement: result.settlement,
        },
      });
    } catch (err) {
      console.error("[AGENT] Payment failed:", err);
      return res.status(500).json({
        error: "Payment failed",
        detail: err.message,
        hint: "Check agent wallet has USDC balance and XLM for fees",
      });
    }
  }

  // Demo mode fallback
  const responseText = generateResponse(service, input);
  res.json({
    service,
    response: responseText,
    cost: price,
    network: NETWORK,
    timestamp: new Date().toISOString(),
    payment: {
      paid: false,
      txHash: null,
      explorerUrl: null,
      payer: getAgentAddress(),
      payTo: PAY_TO || null,
      demo: true,
      reason: !x402Active
        ? "STELLAR_PAY_TO not configured"
        : "STELLAR_AGENT_SECRET not configured",
    },
  });
});

// ──────────────────────────────────────────────
//  PREMIUM ENDPOINTS (behind x402 middleware placeholder above)
// ──────────────────────────────────────────────

app.post("/api/premium/chat", async (req, res) => {
  const input = req.body.message;
  const aiResponse = await generateAIResponse("chat", input).catch(() => null);
  res.json({ service: "chat", response: aiResponse || generateResponse("chat", input), cost: "$0.001", ai: !!aiResponse });
});

app.post("/api/premium/analyze", async (req, res) => {
  const input = req.body.query;
  const aiResponse = await generateAIResponse("analyze", input).catch(() => null);
  res.json({ service: "analyze", response: aiResponse || generateResponse("analyze", input), cost: "$0.01", ai: !!aiResponse });
});

app.post("/api/premium/code", async (req, res) => {
  const input = req.body.prompt;
  const aiResponse = await generateAIResponse("code", input).catch(() => null);
  res.json({ service: "code", response: aiResponse || generateResponse("code", input), cost: "$0.005", ai: !!aiResponse });
});

app.post("/api/premium/research", async (req, res) => {
  const input = req.body.topic;
  const aiResponse = await generateAIResponse("research", input).catch(() => null);
  res.json({ service: "research", response: aiResponse || generateResponse("research", input), cost: "$0.02", ai: !!aiResponse });
});

// ──────────────────────────────────────────────
//  AI RESPONSE GENERATION
// ──────────────────────────────────────────────

function generateResponse(service, input) {
  const q = (input || "").toLowerCase();

  if (service === "chat") {
    if (q.includes("stellar"))
      return `Stellar is a decentralized payment network with fast finality (~5s), ultra-low fees (<$0.01), and native stablecoin support. It's ideal for AI agent micropayments through protocols like x402 and MPP. The network processes thousands of TPS with built-in DEX and Soroban smart contract support.`;
    if (q.includes("x402"))
      return `x402 is a pay-per-request HTTP payment protocol. When a client hits a paywalled endpoint, the server responds with HTTP 402 and payment requirements. The client signs a Soroban auth entry authorizing USDC transfer, retries with payment headers, and the facilitator settles on Stellar. Micropayments as small as $0.001 per call.`;
    if (q.includes("agent"))
      return `AI agents are autonomous software entities that reason, plan, and act. With x402 on Stellar, agents gain economic agency: paying for API calls, purchasing data, hiring other agents, and monetizing services. LILA demonstrates this via paid AI services settled through Stellar micropayments.`;
    if (q.includes("lila") || q.includes("who"))
      return `I am LILA, a Neural Terminal AI Agent on the Stellar network. I provide paid AI services through x402 micropayments: chat, market analysis, code generation, and deep research. Each query costs fractions of a cent in USDC, settled instantly on Stellar.`;
    return `[Neural Core] Processing: "${input}"\n\nI've analyzed your request. As an autonomous AI agent on Stellar, I handle market analysis, code generation, research, and conversation; each is paid via x402 micropayments.\n\nTry: Stellar, x402, AI agents, smart contracts.`;
  }

  if (service === "analyze") {
    return `╔══════════════════════════════════════════╗
║       LILA MARKET ANALYSIS ENGINE        ║
╚══════════════════════════════════════════╝

Query: ${input || "General Market Overview"}

━━━ MARKET SENTIMENT ━━━━━━━━━━━━━━━━━━━━
◆ Overall: Cautiously Bullish
◆ AI/Agent Sector: Strong Momentum
◆ Stellar (XLM): Accumulation Phase

━━━ KEY OBSERVATIONS ━━━━━━━━━━━━━━━━━━━━
1. Agentic payment protocols gaining traction
2. x402 adoption increasing across DeFi
3. Stablecoin volumes on Stellar trending up
4. Machine-to-machine payment infra maturing

━━━ RECOMMENDATION ━━━━━━━━━━━━━━━━━━━━━━
Build for the agentic economy. x402 + Stellar
is well-positioned for micropayment use cases.`;
  }

  if (service === "code") {
    return `╔══════════════════════════════════════════╗
║      LILA CODE GENERATION ENGINE         ║
╚══════════════════════════════════════════╝

Prompt: ${input || "Soroban smart contract"}

#![no_std]
use soroban_sdk::{contract, contractimpl, Env, symbol_short, Address, token};

#[contract]
pub struct PayPerQueryContract;

#[contractimpl]
impl PayPerQueryContract {
    pub fn init(env: Env, provider: Address, price: i128) {
        env.storage().persistent().set(&symbol_short!("prov"), &provider);
        env.storage().persistent().set(&symbol_short!("price"), &price);
    }
    pub fn pay_query(env: Env, caller: Address, usdc: Address) {
        caller.require_auth();
        let prov: Address = env.storage().persistent()
            .get(&symbol_short!("prov")).unwrap();
        let price: i128 = env.storage().persistent()
            .get(&symbol_short!("price")).unwrap();
        token::Client::new(&env, &usdc).transfer(&caller, &prov, &price);
    }
}`;
  }

  return `╔══════════════════════════════════════════╗
║       LILA DEEP RESEARCH ENGINE          ║
╚══════════════════════════════════════════╝

Topic: ${input || "The Agentic Economy"}

━━━ EXECUTIVE SUMMARY ━━━━━━━━━━━━━━━━━━━
The convergence of AI agents and blockchain payment
rails is creating the agentic economy. Stellar's
fast settlement, sub-cent fees, and native stablecoins
make it the ideal platform.

━━━ KEY FINDINGS ━━━━━━━━━━━━━━━━━━━━━━━━
1. AI agent market projected to exceed $50B by 2028
2. x402: Per-request HTTP payments via Soroban auth
3. Emerging use cases: pay-per-query AI, agent
   marketplaces, autonomous research, data markets
4. Stellar: 5s finality, <$0.00001 fees, native USDC

━━━ CONCLUSION ━━━━━━━━━━━━━━━━━━━━━━━━━━
Stellar is uniquely positioned as the payment
backbone of the agentic economy.`;
}

const mppResult = registerMppChargeRoutes(app, {
  enabled: MPP_ENABLED,
  secretKey: MPP_SECRET_KEY,
  recipient: PAY_TO,
  network: NETWORK,
  rpcUrl: RPC_URL,
  generateAIResponse,
  generateResponse,
});
mppChargeActive = mppResult.mppChargeActive;

// ──────────────────────────────────────────────
//  SPA FALLBACK
// ──────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

// ──────────────────────────────────────────────
//  STARTUP
// ──────────────────────────────────────────────

await setupX402Server();
await setupAgentClient(AGENT_SECRET, NETWORK, RPC_URL);
setupLLM({
  openclawUrl: process.env.OPENCLAW_GATEWAY_URL || null,
  openclawToken: process.env.OPENCLAW_GATEWAY_TOKEN || null,
  groqKey: process.env.GROQ_API_KEY || null,
  groqModel: process.env.GROQ_MODEL || null,
  openaiKey: process.env.OPENAI_API_KEY || null,
});

app.listen(Number(PORT), () => {
  console.log(`
  ██╗     ██╗██╗      █████╗ 
  ██║     ██║██║     ██╔══██╗
  ██║     ██║██║     ███████║
  ██║     ██║██║     ██╔══██║
  ███████╗██║███████╗██║  ██║
  ╚══════╝╚═╝╚══════╝╚═╝  ╚═╝
  
  Neural Terminal v4.0
  Server:       http://localhost:${PORT}
  Network:      ${NETWORK}
  x402:         ${x402Active ? "ON" : "OFF"}
  MPP Charge:   ${mppChargeActive ? "ON (/api/mpp/premium/*)" : "OFF"}
  LLM:          ${getProvider() !== "static" ? "ON" : "OFF"}
  Server agent: ${isAgentReady() ? "configured" : "off"}
  `);
});
