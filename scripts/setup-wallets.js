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

async function addUsdcTrustline(secretKey, label) {
  const server = new Horizon.Server(HORIZON_URL);
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const hasTrustline = account.balances.some(
    (b) => b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER,
  );

  if (hasTrustline) {
    console.log(`[${label}] USDC trustline already exists`);
    return;
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
  console.log(`[${label}] USDC trustline created ✓`);
}

const PAY_TO_SECRET = "SAHMU6F32WF2HJLIVOFW3DYHFYHUAF76BVCVCSTWBJVM5IKXPCEPKRJ4";
const AGENT_SECRET = "SD5YBNREGUTP3RV76CWO5XMOJZ256NPTR4QUMSJUOZTPSKTUSO3LRGLV";

try {
  await addUsdcTrustline(PAY_TO_SECRET, "PAY_TO");
  await addUsdcTrustline(AGENT_SECRET, "AGENT");
  console.log("\nDone! Now get testnet USDC from https://faucet.circle.com");
  console.log("Select 'Stellar Testnet' and paste the AGENT wallet address:");
  console.log("GDYBFD5XN2LDSRKE4LBFIQS6PKIZ6E7E7KBNQPQ4NYJ4FGLLCRKTOGUF");
} catch (err) {
  console.error("Error:", err.message);
}
