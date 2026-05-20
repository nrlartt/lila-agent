import type { Token } from "../api";

/** Whether bonding curve UI applies to this token lifecycle. */
export function showsBondingCurve(lifecycle: Token["lifecycle"]): boolean {
  return lifecycle === "curve" || lifecycle === "graduating";
}

/**
 * alt.fun curveFilled: percent toward graduation (e.g. 1.74 = 1.74%), 100 when done.
 */
export function curveFillPercent(token: Pick<Token, "lifecycle" | "curveFilledPct">): number {
  if (token.lifecycle === "graduating") return 100;
  const raw = token.curveFilledPct ?? 0;
  if (raw >= 100) return 100;
  return Math.min(100, Math.max(0, raw));
}
