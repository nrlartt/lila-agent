/**
 * Browser-side x402 payment flow.
 * Handles 402 responses, parses payment requirements, and manages payment headers.
 */

export async function fetchWithX402(url, options = {}, signFn = null) {
  const response = await fetch(url, options);

  if (response.status !== 402) {
    return response;
  }

  const paymentHeader = response.headers.get("x-payment");
  if (!paymentHeader) {
    throw new Error("402 received but no X-Payment header found");
  }

  let paymentRequirements;
  try {
    paymentRequirements = JSON.parse(
      atob(paymentHeader.split(".")[0] || paymentHeader),
    );
  } catch {
    paymentRequirements = JSON.parse(paymentHeader);
  }

  if (!signFn) {
    return {
      status: 402,
      paymentRequired: true,
      requirements: paymentRequirements,
      originalResponse: response,
    };
  }

  const signedPayload = await signFn(paymentRequirements);

  const paidResponse = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "X-PAYMENT": signedPayload,
    },
  });

  return paidResponse;
}

export function parsePaymentRequirements(response) {
  const header = response.headers?.get("x-payment");
  if (!header) return null;

  try {
    return JSON.parse(atob(header));
  } catch {
    try {
      return JSON.parse(header);
    } catch {
      return null;
    }
  }
}

export function formatCost(price) {
  if (!price) return "FREE";
  const num = parseFloat(price.replace("$", ""));
  if (num < 0.01) return `${(num * 1000).toFixed(1)}m USDC`;
  return `${num.toFixed(4)} USDC`;
}
