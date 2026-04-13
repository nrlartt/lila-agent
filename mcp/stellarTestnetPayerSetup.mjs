/**
 * Testnet only: fund new account via Friendbot (if needed) + USDC trustline for x402.
 * USDC balance must still be added manually (e.g. Circle testnet faucet).
 */
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

function isNotFound(err) {
  const s = err?.response?.status ?? err?.constructor?.name;
  if (s === 404) return true;
  const msg = String(err?.message || err);
  return msg.includes("404") || msg.includes("Not Found");
}

/**
 * @param {string} secretKey Stellar S...
 */
export async function setupTestnetPayerWallet(secretKey) {
  const {
    Keypair,
    Horizon,
    Networks,
    TransactionBuilder,
    Operation,
    Asset,
  } = await import("@stellar/stellar-sdk");

  const kp = Keypair.fromSecret(secretKey);
  const pk = kp.publicKey();
  const server = new Horizon.Server(HORIZON_URL);
  const USDC = new Asset("USDC", USDC_ISSUER);

  let account;
  try {
    account = await server.loadAccount(pk);
  } catch (err) {
    if (!isNotFound(err)) throw err;
    const res = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(pk)}`);
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Friendbot failed ${res.status}: ${body}`);
    }
    console.error(`[lila-mcp] testnet: Friendbot sent XLM to ${pk}`);
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        account = await server.loadAccount(pk);
        break;
      } catch (e) {
        if (!isNotFound(e) && i > 5) throw e;
      }
    }
    if (!account) throw new Error("Account not visible on Horizon after Friendbot");
  }

  const hasTrustline = account.balances.some(
    (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER,
  );
  if (hasTrustline) {
    console.error(`[lila-mcp] testnet: USDC trustline already set for ${pk}`);
    return;
  }

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(30)
    .build();

  tx.sign(kp);
  await server.submitTransaction(tx);
  console.error(
    `[lila-mcp] testnet: USDC trustline added for ${pk}. Add USDC balance: https://faucet.circle.com (Stellar Testnet) → paste G address above.`,
  );
}
