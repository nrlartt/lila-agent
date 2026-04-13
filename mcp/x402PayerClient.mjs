/**
 * Lazy x402 client for MCP / OpenClaw: pays from LILA_PAYER_SECRET (operator wallet),
 * not STELLAR_AGENT_SECRET on the API server.
 */
let cache = null;

/**
 * @param {string} secretKey Stellar secret (S...)
 * @param {string} network e.g. stellar:testnet
 * @param {string | undefined} rpcUrl Soroban RPC URL
 */
export async function getPayerPaidFetch(secretKey, network, rpcUrl) {
  if (cache?.secretKey === secretKey) {
    return cache;
  }

  const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
  const { createEd25519Signer } = await import("@x402/stellar");
  const { ExactStellarScheme } = await import("@x402/stellar/exact/client");

  const signer = createEd25519Signer(secretKey, network);
  const rpcConfig = rpcUrl ? { url: rpcUrl } : undefined;
  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer, rpcConfig),
  );
  const paidFetch = wrapFetchWithPayment(globalThis.fetch, client);

  cache = {
    secretKey,
    paidFetch,
    payerAddress: signer.address,
  };
  return cache;
}
