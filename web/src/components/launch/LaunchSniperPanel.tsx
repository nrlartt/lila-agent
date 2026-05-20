import { Link } from "react-router-dom";
import type { useLaunchSniper } from "../../hooks/useLaunchSniper";
import type { useTradingWallet } from "../../hooks/useTradingWallet";
import { AGENT_NAME, BOT_NAME } from "../../lib/brand";
import { formatPriceUsd } from "../../lib/format";
import { BotActivityFeed } from "../bot/BotActivityFeed";
import { LilaAvatar } from "../LilaAvatar";
import { TradingWalletSetup } from "../TradingWalletSetup";
import { LaunchSniperConfigForm } from "./LaunchSniperConfigForm";

type Sniper = ReturnType<typeof useLaunchSniper>;

type Props = {
  sniper: Sniper;
  tradingWallet: ReturnType<typeof useTradingWallet>;
};

export function LaunchSniperPanel({ sniper, tradingWallet }: Props) {
  const { running, busy, config, setConfig, runtime, positions, logs, start, stop, clearLogs, clearClosedPositions } =
    sniper;

  const walletReady = tradingWallet.sessionActive && tradingWallet.zapApproved;
  const openCount = positions.filter((p) => !p.closed).length;
  const canStart = walletReady && !running;

  return (
    <div className="launch-sniper">
      <header className="launch-sniper__hero glass-panel">
        <div className="launch-sniper__hero-copy">
          <LilaAvatar size="lg" pulse={running} />
          <div>
            <p className="bot-hero__eyebrow">New launches · {BOT_NAME}</p>
            <h2>Lila launch sniper</h2>
            <p className="muted">
              {AGENT_NAME} watches fresh alt.fun launches live, buys when your rules match, and
              exits when your sell rules hit — no wallet popup per trade.
            </p>
          </div>
        </div>
        <div className="launch-sniper__stats">
          {running && (
            <span className="bot-pill bot-pill--live">
              <span className="bot-pill__dot" />
              <span className="bot-pill__value">Watching launches</span>
            </span>
          )}
          <span className="bot-pill">
            <span className="bot-pill__label">Open</span>
            <span className="bot-pill__value">{openCount}</span>
          </span>
          {runtime && (
            <span className="bot-pill">
              <span className="bot-pill__label">Sniped</span>
              <span className="bot-pill__value">{runtime.sessionBuys}</span>
            </span>
          )}
        </div>
      </header>

      <details
        className="auto-bot__wallet-fold"
        open={!tradingWallet.sessionActive || !tradingWallet.zapApproved}
      >
        <summary>
          <span>Trading wallet</span>
          {tradingWallet.sessionActive && (
            <span className="auto-bot__wallet-summary mono muted">
              {tradingWallet.usdcLabel} USDC
              {tradingWallet.zapApproved ? " · ready" : " · approve USDC"}
            </span>
          )}
        </summary>
        <TradingWalletSetup wallet={tradingWallet} disabled={running} compact />
      </details>

      <LaunchSniperConfigForm config={config} setConfig={setConfig} disabled={running} />

      <div className="launch-sniper__actions">
        {!running ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canStart || busy}
            onClick={start}
          >
            Start launch sniper
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--sell"
            disabled={busy}
            onClick={stop}
          >
            {busy ? `${AGENT_NAME} is executing…` : "Stop new snipes"}
          </button>
        )}
        {!walletReady && !running && (
          <p className="muted">Complete trading wallet setup to start.</p>
        )}
      </div>

      <div className="launch-sniper__grid">
        <section className="launch-positions glass-panel">
          <div className="launch-positions__head">
            <h3>Sniped positions</h3>
            {positions.some((p) => p.closed) && (
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={clearClosedPositions}
              >
                Clear closed
              </button>
            )}
          </div>
          {positions.length === 0 ? (
            <p className="muted launch-positions__empty">
              No snipes yet. When {AGENT_NAME} buys a new launch it appears here with live exit
              tracking.
            </p>
          ) : (
            <ul className="launch-positions__list">
              {positions.map((p) => (
                <li
                  key={p.address}
                  className={`launch-positions__row ${p.closed ? "launch-positions__row--closed" : ""}`}
                >
                  <div>
                    <strong>${p.ticker}</strong>
                    <span className="muted"> · {p.name}</span>
                  </div>
                  <div className="mono muted launch-positions__meta">
                    Entry {formatPriceUsd(p.entryPrice)}
                    {p.closed ? " · closed" : " · open"}
                  </div>
                  <Link to={`/bot?token=${p.address}`} className="btn btn--ghost btn--xs">
                    Open in bot
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <BotActivityFeed
          logs={logs}
          runtime={
            runtime
              ? {
                  startedAt: runtime.startedAt,
                  baselinePrice: 0,
                  peakPrice: 0,
                  troughPrice: 0,
                  lastTradeAt: runtime.lastSnipeAt,
                  lastTradePrice: 0,
                  tradeCount: runtime.sessionBuys,
                  buyCount: runtime.sessionBuys,
                  sellCount: 0,
                  lastPrice: 0,
                  gridAnchor: 0,
                }
              : null
          }
          running={running}
          onClear={clearLogs}
        />
      </div>
    </div>
  );
}
