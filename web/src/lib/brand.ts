export const SITE_NAME = "Lila Agent";
export const BOT_NAME = "Lila Bot";
export const AGENT_NAME = "Lila";
export const SITE_DOMAIN = "lilagent.xyz";
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ||
  `https://${SITE_DOMAIN}`;
export const SITE_TAGLINE = "Autonomous trading on HyperEVM";
export const BOT_TAGLINE =
  "Lila executes swaps and rules on a dedicated wallet — no popup per trade.";
