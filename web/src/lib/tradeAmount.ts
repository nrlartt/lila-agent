import { formatUnits } from "viem";

export const SELL_PERCENT_PRESETS = [25, 50, 75, 100] as const;

/** Token amount for a sell preset (% of wallet balance). */
export function sellAmountFromBalance(balance: bigint, percent: number): bigint {
  if (balance <= 0n) return 0n;
  if (percent >= 100) return balance;
  return (balance * BigInt(percent)) / 100n;
}

/** Human-readable amount for the trade input (18 decimals). */
export function formatTokenAmountInput(amount: bigint): string {
  if (amount <= 0n) return "0";
  const raw = formatUnits(amount, 18);
  if (!raw.includes(".")) return raw;
  const trimmed = raw.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  return trimmed || "0";
}
