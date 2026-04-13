/**
 * Shared x402 v2 payment requirement selection (USDC vs native XLM SAC).
 * Used by the browser terminal client and MCP payer client.
 */
import { getUsdcAddress } from "@x402/stellar";
import { Asset, Networks } from "@stellar/stellar-sdk";

/** @param {string} network stellar:testnet | stellar:pubnet */
export function nativeXlmContractId(network) {
  return Asset.native().contractId(
    network === "stellar:pubnet" ? Networks.PUBLIC : Networks.TESTNET,
  );
}

/**
 * Pick USDC or native XLM (second option in server `accepts`) for x402 v2 PaymentRequirements.
 * @param {"USDC"|"XLM"} preferred
 * @param {string} network
 */
export function buildPaymentRequirementsSelector(preferred, network) {
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
