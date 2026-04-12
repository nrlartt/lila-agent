let agentClient = null;
let agentAddress = null;

export async function setupAgentClient(secretKey, network, rpcUrl) {
  if (!secretKey) {
    console.warn("[AGENT] No STELLAR_AGENT_SECRET; agent payments disabled");
    return false;
  }

  try {
    const { x402Client, x402HTTPClient } = await import("@x402/fetch");
    const { createEd25519Signer } = await import("@x402/stellar");
    const { ExactStellarScheme } = await import(
      "@x402/stellar/exact/client"
    );

    const signer = createEd25519Signer(secretKey, network);
    agentAddress = signer.address;

    const rpcConfig = rpcUrl ? { url: rpcUrl } : undefined;
    const client = new x402Client().register(
      "stellar:*",
      new ExactStellarScheme(signer, rpcConfig),
    );
    const httpClient = new x402HTTPClient(client);

    agentClient = { client, httpClient };
    console.log(`[AGENT] Wallet ready: ${agentAddress}`);
    return true;
  } catch (err) {
    console.error("[AGENT] Setup failed:", err.message);
    return false;
  }
}

export function getAgentAddress() {
  return agentAddress;
}

export function isAgentReady() {
  return !!agentClient;
}

/**
 * Make an x402-paid request to a protected endpoint.
 * Full flow: request → 402 → sign payment → retry → receive content.
 */
export async function payForService(url, options = {}) {
  if (!agentClient) {
    throw new Error("Agent wallet not configured");
  }

  const { client, httpClient } = agentClient;

  // Step 1: Hit the protected endpoint
  const firstTry = await fetch(url, options);

  if (firstTry.status !== 402) {
    const body = await firstTry.text();
    let data = null;
    try { data = JSON.parse(body); } catch { /* not JSON */ }
    return { paid: false, status: firstTry.status, data, txHash: null };
  }

  console.log("[AGENT] Received 402; creating payment...");

  // Step 2: Parse payment requirements from 402 response
  const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
    firstTry.headers.get(name),
  );

  // Step 3: Create signed payment payload (simulates the transaction)
  const paymentPayload = await client.createPaymentPayload(paymentRequired);
  console.log("[AGENT] Payment payload created and signed");

  // Step 4: Send the paid request with payment headers
  const paymentHeaders =
    httpClient.encodePaymentSignatureHeader(paymentPayload);

  const retryHeaders = {
    ...(options.headers || {}),
    ...paymentHeaders,
  };

  const paidResponse = await fetch(url, {
    method: options.method || "GET",
    headers: retryHeaders,
    body: options.body,
  });

  console.log(`[AGENT] Paid response status: ${paidResponse.status}`);

  // Step 6: Check if the paid request actually succeeded
  if (paidResponse.status === 402) {
    throw new Error(
      "Payment was rejected by the facilitator. Check agent USDC balance.",
    );
  }

  if (!paidResponse.ok) {
    const errBody = await paidResponse.text();
    throw new Error(`Paid request failed (${paidResponse.status}): ${errBody}`);
  }

  // Step 7: Extract settlement info
  let settlement = null;
  let txHash = null;
  try {
    settlement = httpClient.getPaymentSettleResponse((name) =>
      paidResponse.headers.get(name),
    );
    txHash = settlement?.txHash || settlement?.transaction || null;
    console.log(`[AGENT] Settlement TX: ${txHash || "no hash in response"}`);
  } catch (e) {
    console.log(`[AGENT] No settlement header: ${e.message}`);
  }

  // Step 8: Parse response body
  const bodyText = await paidResponse.text();
  let data = null;
  try {
    data = JSON.parse(bodyText);
  } catch {
    data = { response: bodyText };
  }

  return {
    paid: true,
    status: paidResponse.status,
    data,
    settlement,
    txHash,
    payer: agentAddress,
  };
}
