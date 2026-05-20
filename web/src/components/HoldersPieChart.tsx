import { memo, useMemo } from "react";
import type { Holder } from "../api";
import { shortAddress } from "../lib/format";

const SLICE_COLORS = [
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fbbf24",
  "#fb923c",
  "#2dd4bf",
  "#818cf8",
];

const SIZE = 200;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 72;
const STROKE = 22;
const CIRC = 2 * Math.PI * R;
const GAP = 1.8;

type Slice = {
  key: string;
  label: string;
  percentage: number;
  color: string;
};

function buildSlices(holders: Holder[]): Slice[] {
  const top = holders.slice(0, 8);
  const slices: Slice[] = top.map((h, i) => ({
    key: h.wallet,
    label: shortAddress(h.wallet, 6, 4),
    percentage: h.percentage,
    color: SLICE_COLORS[i % SLICE_COLORS.length]!,
  }));

  const accounted = slices.reduce((s, x) => s + x.percentage, 0);
  const rest = Math.max(0, 100 - accounted);
  if (rest >= 0.05) {
    slices.push({
      key: "others",
      label: "Others",
      percentage: rest,
      color: "rgba(148, 163, 184, 0.45)",
    });
  }
  return slices;
}

function DonutRing({ slices }: { slices: Slice[] }) {
  let offset = 0;
  return (
    <svg
      className="holders-donut__svg"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-hidden
    >
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="var(--border)"
        strokeWidth={STROKE}
        opacity={0.35}
      />
      {slices.map((s) => {
        const len = Math.max(0, (s.percentage / 100) * CIRC - GAP);
        const dash = `${len} ${CIRC - len}`;
        const el = (
          <circle
            key={s.key}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={STROKE}
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
            className="holders-donut__segment"
          />
        );
        offset += (s.percentage / 100) * CIRC;
        return el;
      })}
    </svg>
  );
}

export const HoldersPieChart = memo(function HoldersPieChart({
  holders,
}: {
  holders: Holder[];
}) {
  const slices = useMemo(() => buildSlices(holders), [holders]);
  const top10Share = useMemo(
    () => holders.slice(0, 10).reduce((s, h) => s + h.percentage, 0),
    [holders],
  );

  if (slices.length === 0) return null;

  const topWalletPct = holders[0]?.percentage ?? 0;
  const maxPct = slices[0]?.percentage || 1;

  return (
    <div className="holders-donut">
      <div className="holders-donut__visual">
        <div className="holders-donut__chart-wrap">
          <DonutRing slices={slices} />
          <div className="holders-donut__center">
            <span className="holders-donut__center-value">{top10Share.toFixed(1)}%</span>
            <span className="holders-donut__center-label">top 10</span>
          </div>
        </div>
        <div className="holders-donut__stats">
          <div className="holders-donut__stat">
            <span className="holders-donut__stat-label">Top 10 share</span>
            <span className="holders-donut__stat-value mono">{top10Share.toFixed(1)}%</span>
          </div>
          <div className="holders-donut__stat">
            <span className="holders-donut__stat-label">Largest wallet</span>
            <span className="holders-donut__stat-value mono">{topWalletPct.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      <ul className="holders-donut__legend">
        {slices.map((s, i) => (
          <li key={s.key} className="holders-donut__legend-item">
            <span className="holders-donut__rank muted">#{i + 1}</span>
            <span className="holders-donut__dot" style={{ background: s.color }} />
            <span className="holders-donut__legend-label" title={s.label}>
              {s.label}
            </span>
            <span className="holders-donut__legend-bar-wrap">
              <span
                className="holders-donut__legend-bar"
                style={{
                  width: `${Math.min(100, (s.percentage / maxPct) * 100)}%`,
                  background: s.color,
                }}
              />
            </span>
            <span className="holders-donut__legend-pct mono">{s.percentage.toFixed(2)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
