import { useMemo, useState } from "react";
import type { AutoBotRuntime, BotLogEntry, BotLogLevel } from "../../lib/autoBotTypes";
import { AGENT_NAME } from "../../lib/brand";
import { formatPriceUsd } from "../../lib/format";
import { LilaAvatar } from "../LilaAvatar";

type Filter = "all" | "trades" | "signals" | "system";

type Props = {
  logs: BotLogEntry[];
  runtime: AutoBotRuntime | null;
  running: boolean;
  onClear: () => void;
};

const LEVEL_ICON: Record<BotLogLevel, string> = {
  info: "○",
  signal: "◎",
  trade: "⚡",
  warn: "△",
  error: "✕",
};

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(ts * 1000).toLocaleTimeString();
}

function matchesFilter(log: BotLogEntry, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "trades") return log.level === "trade";
  if (filter === "signals") return log.level === "signal";
  return log.level === "info" || log.level === "warn" || log.level === "error";
}

export function BotActivityFeed({ logs, runtime, running, onClear }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const stats = useMemo(() => {
    let trades = 0;
    let signals = 0;
    let errors = 0;
    for (const l of logs) {
      if (l.level === "trade") trades++;
      if (l.level === "signal") signals++;
      if (l.level === "error") errors++;
    }
    return { trades, signals, errors };
  }, [logs]);

  const filtered = useMemo(
    () => logs.filter((l) => matchesFilter(l, filter)),
    [logs, filter],
  );

  const copyLog = () => {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.at * 1000).toISOString()}] ${l.level.toUpperCase()} ${l.title ?? ""} ${l.message}`,
      )
      .join("\n");
    void navigator.clipboard.writeText(text);
  };

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "All", count: logs.length },
    { id: "trades", label: "Trades", count: stats.trades },
    { id: "signals", label: "Signals", count: stats.signals },
    { id: "system", label: "System" },
  ];

  return (
    <aside className="activity-feed">
      <div className="activity-feed__head">
        <div className="activity-feed__agent">
          <LilaAvatar size="sm" pulse={running} />
          <strong>{AGENT_NAME} activity</strong>
          {running && (
            <span className="activity-feed__live">
              <span className="auto-bot__live-dot" />
              Live
            </span>
          )}
        </div>
        <div className="activity-feed__actions">
          {logs.length > 0 && (
            <>
              <button type="button" className="btn btn--ghost btn--xs" onClick={copyLog}>
                Copy
              </button>
              <button type="button" className="btn btn--ghost btn--xs" onClick={onClear}>
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <div className="activity-feed__stats">
        <div className="activity-stat">
          <span className="activity-stat__n">{stats.trades}</span>
          <span className="activity-stat__l">Trades</span>
        </div>
        <div className="activity-stat">
          <span className="activity-stat__n">{stats.signals}</span>
          <span className="activity-stat__l">Signals</span>
        </div>
        <div className="activity-stat activity-stat--err">
          <span className="activity-stat__n">{stats.errors}</span>
          <span className="activity-stat__l">Errors</span>
        </div>
      </div>

      {runtime && (
        <div className="activity-feed__runtime mono">
          <span>Base {formatPriceUsd(runtime.baselinePrice)}</span>
          <span>Peak {formatPriceUsd(runtime.peakPrice)}</span>
          <span>
            {runtime.buyCount}B / {runtime.sellCount}S
          </span>
        </div>
      )}

      <div className="activity-feed__filters">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? "active" : ""}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {f.count != null && f.count > 0 && (
              <span className="activity-feed__filter-count">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      <ul className="activity-feed__list">
        {filtered.length === 0 && (
          <li className="activity-feed__empty">
            {logs.length === 0
              ? "Start the bot to stream signals and trades here."
              : "No entries for this filter."}
          </li>
        )}
        {filtered.map((l) => (
          <li
            key={l.id}
            className={`activity-item activity-item--${l.level} ${
              l.action ? `activity-item--${l.action}` : ""
            }`}
          >
            <span className="activity-item__icon" aria-hidden>
              {LEVEL_ICON[l.level]}
            </span>
            <div className="activity-item__body">
              <div className="activity-item__meta">
                <time title={new Date(l.at * 1000).toLocaleString()}>
                  {relativeTime(l.at)}
                </time>
                {l.action && (
                  <span className={`activity-item__tag activity-item__tag--${l.action}`}>
                    {l.action}
                  </span>
                )}
                <span className="activity-item__level">{l.level}</span>
              </div>
              {l.title && <strong className="activity-item__title">{l.title}</strong>}
              <p className="activity-item__msg">{l.message}</p>
            </div>
            {l.txHash && (
              <a
                className="activity-item__tx"
                href={`https://hyperevmscan.io/tx/${l.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                Explorer ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
