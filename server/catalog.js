/**
 * Machine-readable API catalog for agents and integrations (distinct from xlm402.com shape).
 */
import {
  ALLOWED_SERVICES,
  BODY_KEY_MAP,
  PRICE_MAP,
  priceUsdFromDisplay,
} from "./serviceRegistry.js";

const SERVICE_LINES = {
  chat: {
    name: "Neural Chat",
    tier: "core",
    tagline: "Fast dialogue and short reasoning for operators and agents.",
    description:
      "General-purpose conversational AI with Stellar/x402 context. Intended for terminal sessions and MCP-backed workflows.",
    audience: "Terminal users, OpenClaw agents, HTTP clients with x402 or MPP",
    highlights: [
      "Per-request settlement on Stellar (USDC default; optional native XLM via SAC)",
      "Same JSON contract for x402 and MPP variants when enabled",
    ],
  },
  analyze: {
    name: "Market Analysis",
    tier: "core",
    tagline: "Macro and crypto-oriented analysis with grounded tone.",
    description:
      "Structured market-style commentary; live public quotes may appear when symbols are present in the request.",
    audience: "Traders, researchers, dashboards",
    highlights: ["Quote-aware when applicable", "Clear limitation framing in responses"],
  },
  code: {
    name: "Code Generation",
    tier: "core",
    tagline: "Soroban- and Stellar-oriented implementation help.",
    description: "Snippets and patterns aligned with Stellar smart contracts and agent integrations.",
    audience: "Developers building on Stellar / Soroban",
    highlights: ["Contract and integration-oriented defaults", "Paid per prompt"],
  },
  research: {
    name: "Deep Research",
    tier: "core",
    tagline: "Longer structured briefs with explicit limits.",
    description: "Multi-section research-style output suitable for follow-up tooling or human review.",
    audience: "Analysts, agents, automation pipelines",
    highlights: ["Structured sections", "Higher per-call price tier than chat"],
  },
  strategy: {
    name: "Strategic Advisory",
    tier: "premium",
    tagline: "Executive-style options, trade-offs, and recommendations.",
    description: "Premium tier for positioning, roadmap, and decision framing linked to your brief.",
    audience: "Product and strategy operators",
    highlights: ["Premium tier pricing", "Brief-driven output"],
  },
  blueprint: {
    name: "Technical Blueprint",
    tier: "premium",
    tagline: "Architecture and integration design for Stellar-facing systems.",
    description: "Technical outlines: APIs, flows, and Soroban/Stellar touchpoints from your spec.",
    audience: "Engineering leads and integration architects",
    highlights: ["Premium tier pricing", "Spec-driven structure"],
  },
};

/**
 * @param {import("express").Request} req
 * @param {object} ctx
 */
export function buildCatalog(req, ctx) {
  const {
    network,
    networkLabel,
    rpcUrl,
    payTo,
    x402Active,
    mppChargeActive,
    llmReady,
    version,
    port,
    paymentAssets = ["USDC"],
    xlmUsdRate = 0.35,
  } = ctx;

  const envBase =
    (process.env.LILA_PUBLIC_URL || process.env.LILA_BASE_URL || "").trim().replace(/\/$/, "") || "";
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host") || `127.0.0.1:${port}`;
  const publicBaseUrl = envBase || `${proto}://${host}`;

  const services = ALLOWED_SERVICES.map((id) => {
    const line = SERVICE_LINES[id];
    return {
      id,
      name: line.name,
      tier: line.tier,
      tagline: line.tagline,
      description: line.description,
      audience: line.audience,
      highlights: line.highlights,
      live: llmReady,
    };
  });

  const endpoints = [];
  for (const id of ALLOWED_SERVICES) {
    const bodyKey = BODY_KEY_MAP[id];
    const price = PRICE_MAP[id];
    endpoints.push({
      id: `x402-premium-${id}`,
      service: id,
      tier: SERVICE_LINES[id].tier,
      method: "POST",
      path: `/api/premium/${id}`,
      payment: "x402",
      price_display: price,
      price_usd: priceUsdFromDisplay(price),
      payment_assets: paymentAssets,
      default_settlement_asset: "USDC",
      xlm_usd_rate: paymentAssets.includes("XLM") ? xlmUsdRate : undefined,
      stellar_network: network,
      body: { [bodyKey]: "string" },
      response_type: "application/json",
      description: `${SERVICE_LINES[id].name} — paid via x402 when the server is configured.`,
    });
  }

  const mppEndpoints = [];
  if (mppChargeActive) {
    for (const id of ALLOWED_SERVICES) {
      const bodyKey = BODY_KEY_MAP[id];
      const price = PRICE_MAP[id];
      mppEndpoints.push({
        id: `mpp-premium-${id}`,
        service: id,
        tier: SERVICE_LINES[id].tier,
        method: "POST",
        path: `/api/mpp/premium/${id}`,
        payment: "mpp-charge",
        price_display: price,
        price_usd: priceUsdFromDisplay(price),
        settlement_asset: "USDC",
        stellar_network: network,
        body: { [bodyKey]: "string" },
        response_type: "application/json",
        description: `Same behavior as /api/premium/${id} with MPP Charge settlement (Soroban SAC).`,
      });
    }
  }

  return {
    catalog: "lila-neural-terminal",
    title: "LILA API catalog",
    version,
    public_base_url: publicBaseUrl,
    docs_url: `${publicBaseUrl}/docs`,
    agent_protocol_url: `${publicBaseUrl}/skill.md`,
    stellar: {
      network,
      network_label: networkLabel,
      rpc_url: rpcUrl,
      pay_to: payTo,
      payment_assets: paymentAssets,
      default_settlement_asset: "USDC",
      xlm_usd_rate: paymentAssets.includes("XLM") ? xlmUsdRate : undefined,
      x402_enabled: x402Active,
      mpp_charge_enabled: mppChargeActive,
    },
    services,
    endpoints,
    ...(mppEndpoints.length ? { mpp_parallel_endpoints: mppEndpoints } : {}),
    free_endpoints: [
      {
        method: "GET",
        path: "/api/services",
        response_type: "application/json",
        description: "Public metadata: prices, flags, integration hints, service list.",
      },
      {
        method: "GET",
        path: "/api/catalog",
        response_type: "application/json",
        description: "This catalog (machine-readable route index).",
      },
      {
        method: "GET",
        path: "/api/health",
        response_type: "application/json",
        description: "Liveness and llmReady.",
      },
    ],
  };
}
