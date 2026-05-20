import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useConnect } from "wagmi";
import { fetchToken } from "../api";
import { BOT_NAME } from "../lib/brand";
import { TokenAvatar } from "../components/ui/TokenAvatar";
import { PushSettings } from "../components/PushSettings";
import { formatPercent, formatTokenFromRaw, formatUsd } from "../lib/format";
import {
  avgCostPerToken,
  costBasisUsd,
  getPortfolio,
  positionValueUsd,
  realizedPnlTotal,
  type PortfolioPosition,
  unrealizedPnlPct,
  unrealizedPnlUsd,
} from "../lib/portfolio";

type Enriched = PortfolioPosition & {
  priceUsd: number;
  valueUsd: number;
  unrealized: number;
  unrealizedPct: number | null;
  realized: number;
  allocPct: number;
};

type SortKey = "value" | "pnl" | "name";

function sortRows(rows: Enriched[], key: SortKey): Enriched[] {
  const copy = [...rows];
  if (key === "value") copy.sort((a, b) => b.valueUsd - a.valueUsd);
  else if (key === "pnl") copy.sort((a, b) => b.unrealized - a.unrealized);
  else copy.sort((a, b) => a.ticker.localeCompare(b.ticker));
  return copy;
}

export function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const [rows, setRows] = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>("value");
  const [flashTotals, setFlashTotals] = useState(false);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!address) {
        setRows([]);
        return;
      }
      const background = opts?.background ?? false;
      if (!background) setLoading(true);
      else setRefreshing(true);

      const positions = getPortfolio(address).filter((p) => BigInt(p.tokenQty) > 0n);
      const enriched: Enriched[] = [];

      await Promise.all(
        positions.map(async (p) => {
          let priceUsd = 0;
          try {
            const data = await fetchToken(p.token);
            priceUsd = data.token.priceUsd;
          } catch {
            /* skip */
          }
          enriched.push({
            ...p,
            priceUsd,
            valueUsd: positionValueUsd(p, priceUsd),
            unrealized: unrealizedPnlUsd(p, priceUsd),
            unrealizedPct: unrealizedPnlPct(p, priceUsd),
            realized: realizedPnlTotal(p),
            allocPct: 0,
          });
        }),
      );

      const totalVal = enriched.reduce((s, r) => s + r.valueUsd, 0);
      for (const r of enriched) {
        r.allocPct = totalVal > 0 ? (r.valueUsd / totalVal) * 100 : 0;
      }

      setRows(enriched);
      if (!background) setLoading(false);
      else setRefreshing(false);
      setFlashTotals(true);
      window.setTimeout(() => setFlashTotals(false), 600);
    },
    [address],
  );

  useEffect(() => {
    void load();
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("alt_portfolio_")) void load({ background: true });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  const totalCost = rows.reduce((s, r) => s + costBasisUsd(r), 0);
  const totalValue = rows.reduce((s, r) => s + r.valueUsd, 0);
  const totalUnrealized = rows.reduce((s, r) => s + r.unrealized, 0);
  const totalRealized = rows.reduce((s, r) => s + r.realized, 0);
  const totalPnl = totalUnrealized + totalRealized;
  const returnPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : null;
  const winners = rows.filter((r) => r.unrealized > 0).length;
  const losers = rows.filter((r) => r.unrealized < 0).length;

  return (
    <div className="portfolio-page">
      <header className="portfolio-page__head">
        <div className="portfolio-page__head-row">
          <div>
            <h1>Portfolio</h1>
            <p className="muted">Weighted-average cost · trades via this terminal</p>
          </div>
          {isConnected && (
            <button
              type="button"
              className={`btn btn--ghost portfolio-refresh ${refreshing ? "portfolio-refresh--spin" : ""}`}
              onClick={() => load({ background: true })}
              disabled={refreshing || loading}
              aria-label="Refresh prices"
            >
              ↻ Refresh
            </button>
          )}
        </div>
      </header>

      {!isConnected && (
        <div className="portfolio-empty glass-panel">
          <span className="portfolio-empty__icon" aria-hidden>
            ◈
          </span>
          <h2>Connect wallet</h2>
          <p className="muted">Track cost basis and PnL for swaps made here.</p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={isPending}
            onClick={() => connect({ connector: connectors[0] })}
          >
            {isPending ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <section
            className={[
              "portfolio-hero glass-panel",
              flashTotals ? "portfolio-hero--flash" : "",
              totalPnl >= 0 ? "portfolio-hero--up" : "portfolio-hero--down",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="portfolio-hero__primary">
              <span className="portfolio-hero__label">Total value</span>
              <span className="portfolio-hero__equity mono">
                {loading ? "…" : formatUsd(totalValue)}
              </span>
              <span
                className={[
                  "portfolio-hero__pnl mono",
                  totalPnl >= 0 ? "up" : "down",
                ].join(" ")}
              >
                {loading ? "…" : formatUsd(totalPnl)}
                {returnPct != null && !loading && (
                  <small> ({formatPercent(returnPct)})</small>
                )}
              </span>
            </div>
            <div className="portfolio-hero__grid">
              <HeroStat label="Cost basis" value={formatUsd(totalCost)} loading={loading} />
              <HeroStat
                label="Unrealized"
                value={formatUsd(totalUnrealized)}
                loading={loading}
                tone={totalUnrealized >= 0 ? "up" : "down"}
              />
              <HeroStat
                label="Realized"
                value={formatUsd(totalRealized)}
                loading={loading}
                tone={totalRealized >= 0 ? "up" : "down"}
              />
              <HeroStat
                label="Positions"
                value={loading ? "…" : `${rows.length} · ${winners}↑ ${losers}↓`}
                loading={loading}
              />
            </div>
          </section>

          {rows.length > 0 && (
            <div className="portfolio-toolbar">
              <span className="portfolio-toolbar__hint muted">
                {rows.length} holding{rows.length !== 1 ? "s" : ""}
              </span>
              <div className="portfolio-sort">
                {(
                  [
                    ["value", "Value"],
                    ["pnl", "PnL"],
                    ["name", "Name"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={sort === key ? "active" : ""}
                    onClick={() => setSort(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <ul className="portfolio-list portfolio-list--skeleton" aria-busy>
              {[1, 2, 3].map((i) => (
                <li key={i} className="portfolio-row portfolio-row--skeleton" />
              ))}
            </ul>
          )}

          {!loading && rows.length === 0 && (
            <div className="portfolio-empty glass-panel">
              <span className="portfolio-empty__icon" aria-hidden>
                ◎
              </span>
              <h2>No positions yet</h2>
              <p className="muted">Buy tokens in {BOT_NAME} or Market — cost basis tracks automatically.</p>
              <div className="portfolio-empty__actions">
                <Link to="/bot" className="btn btn--primary">
                  Open Bot
                </Link>
                <Link to="/" className="btn btn--ghost">
                  Browse feed
                </Link>
              </div>
            </div>
          )}

          {!loading && sorted.length > 0 && (
            <ul className="portfolio-list">
              {sorted.map((r, i) => (
                <li
                  key={r.token}
                  className="portfolio-row glass-panel"
                  style={{ "--stagger": i } as React.CSSProperties}
                >
                  <Link to={`/token/${r.token}`} className="portfolio-row__main">
                    <TokenAvatar image={r.image} ticker={r.ticker} size="md" />
                    <div className="portfolio-row__identity">
                      <div className="portfolio-row__title">
                        <strong>{r.name}</strong>
                        <span className="muted">${r.ticker}</span>
                      </div>
                      <p className="portfolio-row__meta mono">
                        {formatTokenFromRaw(r.tokenQty, 18)} · avg{" "}
                        {formatUsd(avgCostPerToken(r))} · now {formatUsd(r.priceUsd)}
                      </p>
                      <div className="portfolio-row__alloc" aria-hidden>
                        <span
                          className={`portfolio-row__alloc-fill ${r.unrealized >= 0 ? "up" : "down"}`}
                          style={{ width: `${Math.min(r.allocPct, 100)}%` }}
                        />
                      </div>
                      <span className="portfolio-row__alloc-label muted">
                        {r.allocPct.toFixed(1)}% of portfolio
                      </span>
                    </div>
                  </Link>

                  <div className="portfolio-row__metrics">
                    <div className="portfolio-row__metric">
                      <span className="label">Value</span>
                      <span className="mono">{formatUsd(r.valueUsd)}</span>
                    </div>
                    <div className="portfolio-row__metric">
                      <span className="label">Unrealized</span>
                      <span className={`mono ${r.unrealized >= 0 ? "up" : "down"}`}>
                        {formatUsd(r.unrealized)}
                        {r.unrealizedPct != null && (
                          <small> {formatPercent(r.unrealizedPct)}</small>
                        )}
                      </span>
                    </div>
                    <div className="portfolio-row__metric portfolio-row__metric--sm">
                      <span className="label">Realized</span>
                      <span className={`mono ${r.realized >= 0 ? "up" : "down"}`}>
                        {formatUsd(r.realized)}
                      </span>
                    </div>
                  </div>

                  <div className="portfolio-row__actions">
                    <Link to={`/bot?token=${r.token}`} className="btn btn--primary btn--xs">
                      Trade
                    </Link>
                    <Link to={`/token/${r.token}`} className="btn btn--ghost btn--xs">
                      Chart
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <section className="glass-panel portfolio-alerts">
        <h2 className="portfolio-alerts__title">Alerts</h2>
        <PushSettings />
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: string;
  loading: boolean;
  tone?: "up" | "down";
}) {
  return (
    <div className="portfolio-hero__stat">
      <span className="label">{label}</span>
      <span className={["value mono", tone, loading ? "portfolio-hero__stat--loading" : ""].filter(Boolean).join(" ")}>
        {value}
      </span>
    </div>
  );
}
