import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import {
  STELLAR_TESTNET_CAIP2,
  STELLAR_WILDCARD_CAIP2,
  getNetworkPassphrase,
} from "@x402/stellar";
import { signAuthEntry as freighterSignAuthEntry } from "@stellar/freighter-api";

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
 */
export function createUserPaidFetch(walletAddress, network, rpcUrl) {
  const net = network || STELLAR_TESTNET_CAIP2;
  const signer = createFreighterSigner(walletAddress, net);
  const rpcConfig = rpcUrl ? { url: rpcUrl } : undefined;
  const client = new x402Client().register(
    STELLAR_WILDCARD_CAIP2,
    new ExactStellarScheme(signer, rpcConfig),
  );
  return wrapFetchWithPayment(window.fetch, client);
}
