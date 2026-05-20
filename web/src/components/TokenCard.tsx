import { Link } from "react-router-dom";
import type { Token } from "../api";
import { useLaunchFlash, useTradeFlash } from "../context/TradeFlashContext";
import {
  formatPercent,
  formatPriceUsd,
  formatUsd,
  shortAddress,
  timeAgo,
} from "../lib/format";
import { BondingCurveBar } from "./BondingCurveBar";
import { LifecycleBadge } from "./ui/LifecycleBadge";
import { TokenAvatar } from "./ui/TokenAvatar";
import { showsBondingCurve } from "../lib/curve";
import { useFeedHoneypotStatus } from "../context/FeedHoneypotContext";

type Props = {
  token: Token;
  rank?: number;
};

export function TokenCard({ token: t, rank }: Props) {
  const hpStatus = useFeedHoneypotStatus(t.address);
  const tradeFlash = useTradeFlash(t.address);
  const launchFlash = useLaunchFlash(t.address);
  const changeUp = t.change24h != null && t.change24h >= 0;
  const hasChange = t.change24h != null && !Number.isNaN(t.change24h);

  const showLaunch = launchFlash != null;
  const showTrade = tradeFlash != null && !showLaunch;
  const isBuy = tradeFlash?.side === "buy";

  const cardClass = [
    "token-card",
    showLaunch ? "token-card--flash-launch" : "",
    showTrade ? `token-card--flash-${tradeFlash.side}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const ariaLabel = showLaunch
    ? `${t.name}: new token just launched`
    : showTrade
      ? `${t.name}: live ${isBuy ? "buy" : "sell"} trade just now`
      : `${t.name} token`;

  return (
    <div
      className={cardClass}
      data-trade-pulse={tradeFlash?.pulse}
      data-launch-pulse={launchFlash?.pulse}
    >
      <Link
        to={`/token/${t.address}`}
        className="token-card__stretch-link"
        aria-label={ariaLabel}
      />
      <div className="token-card__shine" aria-hidden />
      <article className="token-card__body">
        {showLaunch && (
          <div
            className="token-card__trade-alert token-card__trade-alert--launch"
            key={`launch-${launchFlash.pulse}`}
            role="status"
            aria-live="polite"
          >
            <span className="token-card__trade-alert-icon" aria-hidden>
              ✦
            </span>
            <span className="token-card__trade-alert-label">NEW TOKEN</span>
            <span className="token-card__trade-alert-hint">Just launched</span>
          </div>
        )}

        {showTrade && (
          <div
            className={`token-card__trade-alert token-card__trade-alert--${tradeFlash.side}`}
            key={`trade-${tradeFlash.pulse}`}
            role="status"
            aria-live="polite"
          >
            <span className="token-card__trade-alert-icon" aria-hidden>
              {isBuy ? "↑" : "↓"}
            </span>
            <span className="token-card__trade-alert-label">
              {isBuy ? "LIVE BUY" : "LIVE SELL"}
            </span>
            <span className="token-card__trade-alert-hint">
              {isBuy ? "Someone bought" : "Someone sold"}
            </span>
          </div>
        )}

        <header className="token-card__head">
          <div className="token-card__identity">
            <TokenAvatar image={t.image} ticker={t.ticker} size="md" />
            <div className="token-card__titles">
              {rank != null && rank <= 3 && (
                <span className={`token-card__rank token-card__rank--${rank}`}>#{rank}</span>
              )}
              <h3 className="token-card__name">{t.name}</h3>
              <p className="token-card__ticker">${t.ticker}</p>
            </div>
          </div>
          <div className="token-card__badges">
            {hpStatus && hpStatus !== "clear" && (
              <span className={`token-card__hp token-card__hp--${hpStatus}`} title="Honeypot scan">
                {hpStatus === "risk" ? "⛔" : "⚠"}
              </span>
            )}
            <LifecycleBadge lifecycle={t.lifecycle} />
          </div>
        </header>

        <div className="token-card__price-row">
          <span
            className={[
              "token-card__price",
              showLaunch ? "token-card__price--flash-launch" : "",
              showTrade ? `token-card__price--flash-${tradeFlash.side}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {formatPriceUsd(t.priceUsd)}
          </span>
          {hasChange && (
            <span className={`token-card__change ${changeUp ? "up" : "down"}`}>
              {formatPercent(t.change24h)}
            </span>
          )}
        </div>

        {showsBondingCurve(t.lifecycle) && (
          <BondingCurveBar token={t} variant="compact" />
        )}

        {!showsBondingCurve(t.lifecycle) &&
          (t.description ? (
            <p className="token-card__desc">{t.description}</p>
          ) : (
            <p className="token-card__desc token-card__desc--muted">{shortAddress(t.address)}</p>
          ))}

        {showsBondingCurve(t.lifecycle) && t.description && (
          <p className="token-card__desc token-card__desc--short">{t.description}</p>
        )}

        <footer className="token-card__metrics">
          <Metric label="Market cap" value={formatUsd(t.mcapUsd)} />
          <Metric label="Vol 24h" value={formatUsd(t.volumeUsd24h)} highlight />
          <Metric label="Launched" value={timeAgo(t.launchedAt)} />
        </footer>

        <div className="token-card__footer">
          {t.canGraduate && <span className="token-card__pill">Grad ready</span>}
          <div className="token-card__actions">
            <span className="token-card__cta">Agent →</span>
            <Link
              to={`/bot?token=${t.address}`}
              className="token-card__cta token-card__cta--bot"
            >
              Bot ⚡
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`token-card__metric ${highlight ? "token-card__metric--hi" : ""}`}>
      <span className="token-card__metric-label">{label}</span>
      <span className="token-card__metric-value">{value}</span>
    </div>
  );
}
