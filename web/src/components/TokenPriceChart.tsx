import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { fetchTokenChart, subscribeEvents, type ChartCandle, type ChartResolution } from "../api";

const RESOLUTIONS: { id: ChartResolution; label: string }[] = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1h" },
  { id: "4h", label: "4h" },
  { id: "1d", label: "1D" },
];

const POLL_MS = 15_000;

type Props = {
  address: string;
  ticker: string;
};

function normalizeCandles(raw: ChartCandle[]): ChartCandle[] {
  return raw
    .map((c) => ({
      time: Math.floor(Number(c.time)),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }))
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        c.time > 0 &&
        Number.isFinite(c.open) &&
        c.open > 0 &&
        c.high > 0 &&
        c.low > 0 &&
        c.close > 0,
    )
    .sort((a, b) => a.time - b.time);
}

function toSeriesData(candles: ChartCandle[]) {
  return candles.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

export function TokenPriceChart({ address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [resolution, setResolution] = useState<ChartResolution>("1m");
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadChart = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await fetchTokenChart(address, resolution);
        const normalized = normalizeCandles(data.chart.candles);
        if (normalized.length === 0) {
          setError("No valid price data for this token");
          setCandles([]);
        } else {
          setCandles(normalized);
          setError(null);
          setLastUpdated(Math.floor(Date.now() / 1000));
        }
      } catch {
        if (!silent) setError("Could not load chart data");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [address, resolution],
  );

  useEffect(() => {
    loadChart(false);
    const poll = setInterval(() => loadChart(true), POLL_MS);
    return () => clearInterval(poll);
  }, [loadChart]);

  useEffect(() => {
    return subscribeEvents((type) => {
      if (type === "trade" || type === "token_launched") loadChart(true);
    });
  }, [loadChart]);

  // Init chart once per resolution / address
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(el, {
      width: el.clientWidth || 600,
      height: 320,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.06)" },
        horzLines: { color: "rgba(148, 163, 184, 0.06)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.12)",
        timeVisible: true,
        secondsVisible: resolution === "1m",
        rightOffset: 4,
      },
      crosshair: {
        vertLine: { color: "rgba(52, 211, 153, 0.35)", labelBackgroundColor: "#141a28" },
        horzLine: { color: "rgba(52, 211, 153, 0.35)", labelBackgroundColor: "#141a28" },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80",
      downColor: "#fb923c",
      borderUpColor: "#4ade80",
      borderDownColor: "#fb923c",
      wickUpColor: "#4ade80",
      wickDownColor: "#fb923c",
      priceFormat: {
        type: "price",
        precision: 8,
        minMove: 0.00000001,
      },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? { width: 0 };
      if (width > 0) chart.applyOptions({ width, height: 320 });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [address, resolution]);

  // Push candle data + scroll to latest
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || candles.length === 0) return;

    series.setData(toSeriesData(candles));
    chart.timeScale().fitContent();
    chart.timeScale().scrollToPosition(0, false);
  }, [candles]);

  return (
    <section className="chart-panel">
      <div className="chart-panel__head chart-panel__head--compact">
        <div>
          <h3 className="chart-panel__title">Chart</h3>
          {lastUpdated != null && (
            <p className="muted chart-panel__sub">
              Live · refreshes every {POLL_MS / 1000}s
            </p>
          )}
        </div>
        <div className="chart-resolutions">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`chip ${resolution === r.id ? "active" : ""}`}
              onClick={() => setResolution(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-panel__body">
        {loading && candles.length === 0 && <div className="chart-skeleton" />}
        {error && !loading && candles.length === 0 && (
          <p className="chart-error">{error}</p>
        )}
        <div ref={containerRef} className="chart-canvas" aria-hidden={loading && candles.length === 0} />
      </div>
    </section>
  );
}

