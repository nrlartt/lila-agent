import { useId } from "react";
import type { Token } from "../api";
import { formatUsd } from "../lib/format";
import { curveFillPercent, showsBondingCurve } from "../lib/curve";

type Props = {
  token: Pick<
    Token,
    "lifecycle" | "curveFilledPct" | "curveRaisedUsd" | "canGraduate"
  >;
  variant?: "compact" | "detail";
};

export function BondingCurveBar({ token, variant = "compact" }: Props) {
  const gradId = useId();

  if (!showsBondingCurve(token.lifecycle)) return null;

  const pct = curveFillPercent(token);
  const isGraduating = token.lifecycle === "graduating";
  const nearGrad = pct >= 85 || token.canGraduate;

  return (
    <div
      className={`bonding-curve bonding-curve--${variant}`}
      aria-label={`Bonding curve ${pct.toFixed(1)}% filled`}
    >
      <div className="bonding-curve__head">
        <span className="bonding-curve__label">
          {isGraduating ? "Graduating" : "Bonding curve"}
        </span>
        <span className="bonding-curve__pct">{pct.toFixed(1)}%</span>
      </div>

      <div className="bonding-curve__track">
        <div
          className={`bonding-curve__fill ${nearGrad ? "bonding-curve__fill--hot" : ""} ${isGraduating ? "bonding-curve__fill--pulse" : ""}`}
          style={{ width: `${pct}%` }}
        />
        {variant === "detail" && (
          <div
            className="bonding-curve__marker"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        )}
      </div>

      <div className="bonding-curve__foot">
        {token.curveRaisedUsd > 0 && (
          <span className="bonding-curve__raised">{formatUsd(token.curveRaisedUsd)} raised</span>
        )}
        {token.canGraduate && !isGraduating && (
          <span className="bonding-curve__tag">Grad ready</span>
        )}
        {isGraduating && (
          <span className="bonding-curve__tag bonding-curve__tag--warn">Seeding LP…</span>
        )}
      </div>

      {variant === "detail" && (
        <svg
          className="bonding-curve__viz"
          viewBox="0 0 200 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(52, 211, 153, 0.15)" />
              <stop offset={`${Math.max(0, pct)}%`} stopColor="rgba(52, 211, 153, 0.55)" />
              <stop offset={`${Math.max(0, pct)}%`} stopColor="rgba(52, 211, 153, 0.08)" />
              <stop offset="100%" stopColor="rgba(52, 211, 153, 0.05)" />
            </linearGradient>
          </defs>
          <path
            d="M 0 44 Q 50 40 100 28 T 200 8"
            fill="none"
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth="1.5"
          />
          <path
            d="M 0 44 Q 50 40 100 28 T 200 8 L 200 48 L 0 48 Z"
            fill={`url(#${gradId})`}
            opacity="0.9"
          />
          <circle
            cx={(200 * pct) / 100}
            cy={Math.max(8, 44 - (36 * pct) / 100)}
            r="3.5"
            fill="#34d399"
          />
        </svg>
      )}
    </div>
  );
}
