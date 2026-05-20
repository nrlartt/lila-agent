import { useEffect, useState } from "react";
import { fetchTokenChart } from "../api";

type Props = { address: string };

export function TokenSparkline({ address }: Props) {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchTokenChart(address, "1h")
      .then((r) => {
        if (cancelled) return;
        const closes = r.chart.candles.slice(-24).map((c) => c.close);
        setPoints(closes.filter((n) => n > 0));
      })
      .catch(() => setPoints([]));
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (points.length < 2) {
    return <div className="token-sparkline token-sparkline--empty" aria-hidden />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  const up = points[points.length - 1] >= points[0];

  return (
    <svg
      className={`token-sparkline ${up ? "token-sparkline--up" : "token-sparkline--down"}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline points={coords} fill="none" strokeWidth="1.5" />
    </svg>
  );
}
