/**
 * Add testnet USDC trustline for the MCP payer wallet (fixes "trustline entry is missing").
 * Prefer MCP env LILA_AUTO_SETUP_TESTNET_PAYER=true for automatic Friendbot + trustline on startup.
 *
 * Usage:
 *   LILA_PAYER_SECRET=S... npm run payer:trustline
 */
import { setupTestnetPayerWallet } from "../mcp/stellarTestnetPayerSetup.mjs";

const secret = process.env.LILA_PAYER_SECRET?.trim();
if (!secret) {
  console.error("Set LILA_PAYER_SECRET to your payer wallet secret (S...).");
  process.exit(1);
}

async function main() {
  await setupTestnetPayerWallet(secret);
}

main().catch((err) => {
  console.error("[payer]", err?.message || err);
  process.exit(1);
});
