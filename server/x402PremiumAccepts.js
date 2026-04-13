/**
 * x402 "exact" payment options for LILA premium routes.
 * - USDC (default client choice: first in `accepts`) via dollar-denominated `price`.
 * - Native XLM via Soroban Stellar Asset Contract (SEP-41), same as on xlm402-style catalogs.
 *
 * USD→XLM conversion uses LILA_XLM_USD_RATE (operator-maintained notional rate, not an on-chain oracle).
 */
import { Asset, Networks } from "@stellar/stellar-sdk";

const PASSPHRASE = {
  "stellar:testnet": Networks.TESTNET,
  "stellar:pubnet": Networks.PUBLIC,
};

function nativeXlmContract(network) {
  const n = PASSPHRASE[network];
  if (!n) throw new Error(`Unsupported Stellar network for XLM SAC: ${network}`);
  return Asset.native().contractId(n);
}

/** Same semantics as @x402/stellar convertToTokenAmount (7 decimals for XLM stroops). */
function decimalToAtomicString(decimalAmount, decimals = 7) {
  const amount = parseFloat(decimalAmount);
  if (isNaN(amount) || amount < 0) {
    throw new Error(`Invalid amount: ${decimalAmount}`);
  }
  const normalizedDecimal = /[eE]/.test(String(decimalAmount))
    ? amount.toFixed(Math.max(decimals, 20))
    : String(decimalAmount);
  const [intPart, decPart = ""] = normalizedDecimal.split(".");
  const paddedDec = decPart.padEnd(decimals, "0").slice(0, decimals);
  let s = (intPart + paddedDec).replace(/^0+/, "") || "0";
  if (amount > 0) {
    try {
      if (BigInt(s) === 0n) s = "1";
    } catch {
      /* ignore */
    }
  }
  return s;
}

function parseUsdFromPriceString(price) {
  const n = parseFloat(String(price).replace(/^\$/, "").trim());
  if (isNaN(n) || n < 0) throw new Error(`Invalid USD price: ${price}`);
  return n;
}

/**
 * @param {string} network stellar:testnet | stellar:pubnet
 * @param {string} payTo G-address
 * @param {string} usdPriceString e.g. "$0.001"
 * @param {{ enableXlm?: boolean, xlmUsdRate?: number }} [opts]
 * @returns {{ accepts: import('@x402/core/types').PaymentOption | import('@x402/core/types').PaymentOption[] }}
 */
export function buildPremiumAccepts(network, payTo, usdPriceString, opts = {}) {
  const enableXlm =
    opts.enableXlm !== undefined
      ? opts.enableXlm
      : !["0", "false", "no"].includes(String(process.env.LILA_X402_ENABLE_XLM || "true").toLowerCase());
  const rateRaw = opts.xlmUsdRate ?? parseFloat(process.env.LILA_XLM_USD_RATE || "0.35");
  const xlmUsdRate = Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : 0.35;

  const usdc = {
    scheme: "exact",
    price: usdPriceString,
    network,
    payTo,
  };

  if (!enableXlm) {
    return { accepts: usdc };
  }

  const usd = parseUsdFromPriceString(usdPriceString);
  const xlmFloat = usd / xlmUsdRate;
  const amount = decimalToAtomicString(xlmFloat.toFixed(7), 7);

  const xlm = {
    scheme: "exact",
    price: {
      amount,
      asset: nativeXlmContract(network),
      extra: {},
    },
    network,
    payTo,
  };

  return { accepts: [usdc, xlm] };
}

export function getXlmUsdRateForApi() {
  const r = parseFloat(process.env.LILA_XLM_USD_RATE || "0.35");
  return Number.isFinite(r) && r > 0 ? r : 0.35;
}

export function isXlmPaymentOptionEnabled() {
  return !["0", "false", "no"].includes(String(process.env.LILA_X402_ENABLE_XLM || "true").toLowerCase());
}
