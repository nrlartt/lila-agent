import { formatUnits, parseUnits } from "viem";
import { TOKEN_DECIMALS, USDC_DECIMALS } from "./constants.js";

export function parseUsdcInput(amount: string): bigint {
  const trimmed = amount.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("USDC amount must be a positive number");
  }
  return parseUnits(trimmed, USDC_DECIMALS);
}

export function parseTokenInput(amount: string, decimals = TOKEN_DECIMALS): bigint {
  const trimmed = amount.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Token amount must be a positive number");
  }
  return parseUnits(trimmed, decimals);
}

export function formatUsdc(amount: bigint): string {
  return formatUnits(amount, USDC_DECIMALS);
}

export function formatTokens(amount: bigint): string {
  return formatUnits(amount, TOKEN_DECIMALS);
}

export function applySlippageMin(expected: bigint, slippageBps: number): bigint {
  return (expected * BigInt(10_000 - slippageBps)) / 10_000n;
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
