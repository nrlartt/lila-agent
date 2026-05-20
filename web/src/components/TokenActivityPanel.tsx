import { useState } from "react";
import type { Holder, Token, Trade } from "../api";
import {
  formatTokenFromRaw,
  formatUsdcFromRaw,
  shortAddress,
  timeAgo,
} from "../lib/format";
import { HoldersPieChart } from "./HoldersPieChart";

type Tab = "trades" | "holders";

type Props = {
  token: Token;
  trades: Trade[];
  holders: Holder[];
  holdersInitialLoading: boolean;
  holdersRefreshing: boolean;
  highlightTradeKey: string | null;
};

export function TokenActivityPanel({
  token,
  trades,
  holders,
  holdersInitialLoading,
  holdersRefreshing,
  highlightTradeKey,
}: Props) {
  const [tab, setTab] = useState<Tab>("trades");

  const showHoldersSkeleton = holdersInitialLoading && holders.length === 0;
  const showHoldersEmpty = !holdersInitialLoading && holders.length === 0;

  return (
    <section className="glass-panel token-detail-section token-activity">
      <div className="panel-body">
        <div className="token-activity__tabs" role="tablist" aria-label="Activity">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "trades"}
            className={`token-activity__tab ${tab === "trades" ? "token-activity__tab--active" : ""}`}
            onClick={() => setTab("trades")}
          >
            Recent trades
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "holders"}
            className={`token-activity__tab ${tab === "holders" ? "token-activity__tab--active" : ""}`}
            onClick={() => setTab("holders")}
          >
            Top holders
          </button>
        </div>

        <div
          className={`token-activity__panels ${tab === "trades" ? "token-activity__panels--trades" : "token-activity__panels--holders"}`}
        >
          <div
            role="tabpanel"
            className="token-activity__panel token-activity__panel--trades"
            hidden={tab !== "trades"}
          >
            {trades.length === 0 ? (
              <p className="muted token-detail-empty">
                No trades in cache yet.{" "}
                <a href={token.altFunUrl} target="_blank" rel="noreferrer">
                  View on alt.fun
                </a>
              </p>
            ) : (
              <ul className="tape-list">
                {trades.slice(0, 20).map((tr) => {
                  const rowKey = `${tr.txHash}-${tr.id}`;
                  const isNew = highlightTradeKey === rowKey;
                  return (
                    <li
                      key={rowKey}
                      className={[
                        "tape-list__item",
                        tr.isBuy ? "tape-list__item--buy" : "tape-list__item--sell",
                        isNew ? "tape-list__item--new" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span className={`tape-list__side ${tr.isBuy ? "side-buy" : "side-sell"}`}>
                        {tr.isBuy ? "BUY" : "SELL"}
                      </span>
                      <span className="tape-list__amount mono">
                        {formatUsdcFromRaw(tr.usdcAmount ?? tr.ltAmount)}
                      </span>
                      <span className="tape-list__trader muted">
                        {shortAddress(tr.trader)}
                      </span>
                      <span className="tape-list__time muted">{timeAgo(tr.createdAt)}</span>
                      <a
                        className="tape-list__tx"
                        href={`https://hyperevmscan.io/tx/${tr.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Tx ↗
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            role="tabpanel"
            className={`token-activity__panel token-activity__panel--holders${holdersRefreshing ? " token-activity__panel--refreshing" : ""}`}
            hidden={tab !== "holders"}
          >
            {holdersRefreshing && !showHoldersSkeleton && (
              <p className="token-activity__refresh-hint muted">Updating…</p>
            )}

            {showHoldersSkeleton ? (
              <div className="holders-skeleton" aria-busy="true">
                <div className="skeleton holders-skeleton__chart" />
                <div className="holders-skeleton__rows">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="skeleton holders-skeleton__row" />
                  ))}
                </div>
              </div>
            ) : showHoldersEmpty ? (
              <p className="muted token-detail-empty">Holder data not available yet.</p>
            ) : (
              <>
                <HoldersPieChart holders={holders} />
                <div className="holders-table-wrap">
                  <h3 className="holders-table__title">Holder breakdown</h3>
                  <ul className="holders-list holders-list--table">
                    {holders.map((h, i) => (
                      <li key={h.wallet} className="holders-list__item">
                        <span className="holders-list__rank muted">#{i + 1}</span>
                        <a
                          className="holders-list__wallet mono"
                          href={`https://hyperevmscan.io/address/${h.wallet}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortAddress(h.wallet, 6, 4)}
                        </a>
                        <div className="holders-list__bar-wrap">
                          <div
                            className="holders-list__bar"
                            style={{ width: `${Math.min(h.percentage, 100)}%` }}
                          />
                        </div>
                        <span className="holders-list__pct mono">
                          {h.percentage.toFixed(2)}%
                        </span>
                        <span className="holders-list__balance mono muted">
                          {formatTokenFromRaw(h.balance)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
