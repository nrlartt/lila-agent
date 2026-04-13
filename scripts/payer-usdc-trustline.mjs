/**
 * Add testnet USDC trustline for the MCP payer wallet (fixes "trustline entry is missing").
 *
 * Usage (from repo root, after npm install):
 *   set LILA_PAYER_SECRET=S...   (PowerShell: $env:LILA_PAYER_SECRET="S...")
 *   node scripts/payer-usdc-trustline.mjs
 *
 * Prerequisites: account exists and has enough XLM for fees (~2+ XLM recommended).
 */
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Horizon,
} from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC = new Asset("USDC", USDC_ISSUER);

const secret = process.env.LILA_PAYER_SECRET?.trim();
if (!secret) {
  console.error("Set LILA_PAYER_SECRET to your payer wallet secret (S...).");
  process.exit(1);
}

const server = new Horizon.Server(HORIZON_URL);
const keypair = Keypair.fromSecret(secret);

try {
  const account = await server.loadAccount(keypair.publicKey());
  const hasTrustline = account.balances.some(
    (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER,
  );
  if (hasTrustline) {
    console.log(`[payer] ${keypair.publicKey()} already has USDC trustline.`);
    process.exit(0);
  }

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  await server.submitTransaction(tx);
  console.log(`[payer] USDC trustline created for ${keypair.publicKey()}`);
  console.log(
    "Fund USDC: https://faucet.circle.com (Stellar Testnet) — paste this address:",
  );
  console.log(keypair.publicKey());
} catch (err) {
  console.error(
    "[payer] failed:",
    err?.response?.data?.extras?.result_codes || err.message || err,
  );
  process.exit(1);
}
