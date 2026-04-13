/**
 * Single source for premium service IDs, JSON body keys, and display prices.
 * Keep in sync with x402 / MPP gate amounts in server/index.js and mppChargeRoutes.js.
 */
export const BODY_KEY_MAP = {
  chat: "message",
  analyze: "query",
  code: "prompt",
  research: "topic",
  strategy: "brief",
  blueprint: "spec",
};

export const PRICE_MAP = {
  chat: "$0.001",
  analyze: "$0.01",
  code: "$0.005",
  research: "$0.02",
  strategy: "$0.012",
  blueprint: "$0.008",
};

export const ALLOWED_SERVICES = Object.keys(BODY_KEY_MAP);

/** @param {string} display e.g. "$0.001" */
export function priceUsdFromDisplay(display) {
  const n = Number(String(display).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? String(n) : display;
}
