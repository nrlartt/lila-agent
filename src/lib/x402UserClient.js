import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import {
  STELLAR_TESTNET_CAIP2,
  STELLAR_WILDCARD_CAIP2,
  getNetworkPassphrase,
  getUsdcAddress,
} from "@x402/stellar";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { signAuthEntry as freighterSignAuthEntry } from "@stellar/freighter-api";

/** @param {string} network stellar:testnet | stellar:pubnet */
function nativeXlmContractId(network) {
  return Asset.native().contractId(
    network === "stellar:pubnet" ? Networks.PUBLIC : Networks.TESTNET,
  );
}

/**
 * Pick USDC or native XLM (second option in server `accepts`) for x402 v2 PaymentRequirements.
 * @param {"USDC"|"XLM"} preferred
 * @param {string} network
 */
function buildPaymentRequirementsSelector(preferred, network) {
  const usdc = getUsdcAddress(network);
  const xlm = nativeXlmContractId(network);
  return (x402Version, reqs) => {
    void x402Version;
    if (!reqs?.length) {
      throw new Error("No payment requirements in 402 response");
    }
    if (preferred === "XLM") {
      const xlmReq = reqs.find((r) => r.asset === xlm);
      if (xlmReq) return xlmReq;
      if (reqs.length >= 2) return reqs[1];
    }
    const usdcReq = reqs.find((r) => r.asset === usdc);
    if (usdcReq) return usdcReq;
    return reqs[0];
  };
}

/**
 * Freighter-backed signer compatible with @x402/stellar ExactStellarScheme
 * (same shape as createEd25519Signer from basicNodeSigner).
 */
export function createFreighterSigner(walletAddress, network = STELLAR_TESTNET_CAIP2) {
  const networkPassphrase = getNetworkPassphrase(network);
  return {
    address: walletAddress,
    async signAuthEntry(entryXdr) {
      const result = await freighterSignAuthEntry(entryXdr, {
        networkPassphrase,
        address: walletAddress,
      });
      if (result.error) {
        throw new Error(String(result.error));
      }
      if (!result.signedAuthEntry) {
        throw new Error("Freighter did not return a signed auth entry");
      }
      // @stellar/stellar-sdk 14+ AssembledTransaction.signAuthEntries expects the
      // same shape as basicNodeSigner: { signedAuthEntry, signerAddress }, not a raw string.
      return {
        signedAuthEntry: result.signedAuthEntry,
        signerAddress: result.signerAddress || walletAddress,
      };
    },
  };
}

/**
 * fetch wrapped with x402 payment handling (402 → sign in Freighter → retry).
 * @param {"USDC"|"XLM"} [preferredSettlement] default USDC; XLM selects the native SAC option when the server offers it
 */
export function createUserPaidFetch(walletAddress, network, rpcUrl, preferredSettlement = "USDC") {
  const net = network || STELLAR_TESTNET_CAIP2;
  const pref = preferredSettlement === "XLM" ? "XLM" : "USDC";
  const signer = createFreighterSigner(walletAddress, net);
  const rpcConfig = rpcUrl ? { url: rpcUrl } : undefined;
  const selector = buildPaymentRequirementsSelector(pref, net);
  const client = new x402Client(selector).register(
    STELLAR_WILDCARD_CAIP2,
    new ExactStellarScheme(signer, rpcConfig),
  );
  return wrapFetchWithPayment(window.fetch, client);
}
