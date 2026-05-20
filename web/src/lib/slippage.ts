const STORAGE_KEY = "alt_slippage_bps";

export const SLIPPAGE_PRESETS = [
  { label: "1%", bps: 100 },
  { label: "3%", bps: 300 },
  { label: "5%", bps: 500 },
] as const;

export function getSlippageBps(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : 300;
    return Number.isFinite(n) && n >= 50 && n <= 2000 ? n : 300;
  } catch {
    return 300;
  }
}

export function setSlippageBps(bps: number): void {
  localStorage.setItem(STORAGE_KEY, String(bps));
}

export function applySlippageMin(amount: bigint, slippageBps: number): bigint {
  const num = 10_000n - BigInt(Math.min(Math.max(slippageBps, 0), 5000));
  return (amount * num) / 10_000n;
}
