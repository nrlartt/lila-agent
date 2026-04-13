/**
 * Lazy x402 client for MCP / OpenClaw: pays from LILA_PAYER_SECRET (operator wallet),
 * not STELLAR_AGENT_SECRET on the API server.
 */
import { buildPaymentRequirementsSelector } from "../src/lib/x402SettlementSelector.js";

let cache = null;

/**
 * @param {string} secretKey Stellar secret (S...)
 * @param {string} network e.g. stellar:testnet
 * @param {string | undefined} rpcUrl Soroban RPC URL
 * @param {"USDC"|"XLM"} [preferredSettlement] default USDC; XLM uses native SAC when server offers it
 */
export async function getPayerPaidFetch(secretKey, network, rpcUrl, preferredSettlement = "USDC") {
  const pref = preferredSettlement === "XLM" ? "XLM" : "USDC";
  const cacheKey = `${secretKey}|${network}|${rpcUrl ?? ""}|${pref}`;
  if (cache?.cacheKey === cacheKey) {
    return cache;
  }

  const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
  const { createEd25519Signer } = await import("@x402/stellar");
  const { ExactStellarScheme } = await import("@x402/stellar/exact/client");

  const signer = createEd25519Signer(secretKey, network);
  const rpcConfig = rpcUrl ? { url: rpcUrl } : undefined;
  const selector = buildPaymentRequirementsSelector(pref, network);
  const client = new x402Client(selector).register(
    "stellar:*",
    new ExactStellarScheme(signer, rpcConfig),
  );
  const paidFetch = wrapFetchWithPayment(globalThis.fetch, client);

  cache = {
    cacheKey,
    secretKey,
    paidFetch,
    payerAddress: signer.address,
  };
  return cache;
}
