import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer, getNetworkPassphrase } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

const STELLAR_PRIVATE_KEY = process.env.STELLAR_AGENT_SECRET;
const RESOURCE_SERVER_URL = "http://localhost:3001";
const ENDPOINT_PATH = "/api/premium/chat";
const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";
const STELLAR_RPC_URL =
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";

async function main() {
  const url = new URL(ENDPOINT_PATH, RESOURCE_SERVER_URL).toString();
  const signer = createEd25519Signer(STELLAR_PRIVATE_KEY, NETWORK);
  const rpcConfig = STELLAR_RPC_URL ? { url: STELLAR_RPC_URL } : undefined;
  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer, rpcConfig),
  );
  const httpClient = new x402HTTPClient(client);
  console.log(`Target: ${url}\nClient address: ${signer.address}`);

  // Step 1: Try without payment
  console.log("\n--- Step 1: Initial request ---");
  const firstTry = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "What is Stellar?" }),
  });
  console.log(`Status: ${firstTry.status}`);

  if (firstTry.status !== 402) {
    console.log("Not a 402! Body:", await firstTry.text());
    return;
  }

  // Step 2: Parse payment requirements
  console.log("\n--- Step 2: Parse payment requirements ---");
  const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
    firstTry.headers.get(name),
  );
  console.log("Payment required:", JSON.stringify(paymentRequired, null, 2));

  // Step 3: Create payment payload
  console.log("\n--- Step 3: Create payment payload ---");
  let paymentPayload = await client.createPaymentPayload(paymentRequired);
  console.log("Payload created successfully");

  // Step 4: Adjust fee
  const networkPassphrase = getNetworkPassphrase(NETWORK);
  const tx = new Transaction(
    paymentPayload.payload.transaction,
    networkPassphrase,
  );
  const sorobanData = tx.toEnvelope().v1()?.tx()?.ext()?.sorobanData();
  if (sorobanData) {
    console.log("Adjusting fee for testnet facilitator...");
    paymentPayload = {
      ...paymentPayload,
      payload: {
        ...paymentPayload.payload,
        transaction: TransactionBuilder.cloneFrom(tx, {
          fee: "1",
          sorobanData,
          networkPassphrase,
        })
          .build()
          .toXDR(),
      },
    };
  }

  // Step 5: Send paid request
  console.log("\n--- Step 4: Send paid request ---");
  const paymentHeaders =
    httpClient.encodePaymentSignatureHeader(paymentPayload);
  console.log(
    "Payment headers:",
    Object.keys(paymentHeaders).map((k) => `${k}: ${paymentHeaders[k].substring(0, 50)}...`),
  );

  const paidResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...paymentHeaders,
    },
    body: JSON.stringify({ message: "What is Stellar?" }),
  });

  console.log(`\nPaid response status: ${paidResponse.status}`);

  // Log all response headers
  console.log("Response headers:");
  paidResponse.headers.forEach((v, k) => console.log(`  ${k}: ${v.substring(0, 80)}`));

  const text = await paidResponse.text();
  console.log(`\nBody: ${text.substring(0, 500)}`);

  // Step 6: Settlement
  try {
    const paymentResponse = httpClient.getPaymentSettleResponse((name) =>
      paidResponse.headers.get(name),
    );
    console.log("\nSettlement response:", paymentResponse);
  } catch (e) {
    console.log("\nNo settlement response:", e.message);
  }
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
