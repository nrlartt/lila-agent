import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api";

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

export async function isFreighterInstalled() {
  try {
    const result = await isConnected();
    return result.isConnected === true;
  } catch {
    return false;
  }
}

export async function connectFreighter() {
  const connResult = await isConnected();
  if (!connResult.isConnected) {
    throw new Error(
      "Freighter wallet not detected. Install it from https://freighter.app",
    );
  }

  const accessResult = await requestAccess();
  if (accessResult.error) {
    throw new Error(accessResult.error);
  }
  return accessResult.address;
}

export async function getPublicKey() {
  try {
    const result = await getAddress();
    if (result.error) return null;
    return result.address;
  } catch {
    return null;
  }
}

export async function getBalance(publicKey) {
  if (!publicKey) return { xlm: "0", usdc: "0" };
  try {
    const res = await fetch(`${HORIZON_TESTNET}/accounts/${publicKey}`);
    if (!res.ok) return { xlm: "0", usdc: "0" };
    const data = await res.json();

    let xlm = "0";
    let usdc = "0";

    for (const bal of data.balances) {
      if (bal.asset_type === "native") {
        xlm = parseFloat(bal.balance).toFixed(2);
      }
      if (
        bal.asset_code === "USDC" &&
        bal.asset_issuer ===
          "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      ) {
        usdc = parseFloat(bal.balance).toFixed(4);
      }
    }

    return { xlm, usdc };
  } catch {
    return { xlm: "0", usdc: "0" };
  }
}

export async function signStellarTransaction(xdr, network) {
  const networkPassphrase =
    network === "stellar:testnet"
      ? "Test SDF Network ; September 2015"
      : "Public Global Stellar Network ; September 2015";

  const result = await freighterSignTransaction(xdr, {
    networkPassphrase,
  });

  if (result.error) {
    throw new Error(result.error);
  }
  return result.signedTxXdr;
}

export function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
