import type { HoneypotCheck, Token } from "../api";
import type { useAutoTrader } from "../hooks/useAutoTrader";
import type { useTradingWallet } from "../hooks/useTradingWallet";
import { BotActivityFeed } from "./bot/BotActivityFeed";
import { StrategyConfigurator } from "./bot/StrategyConfigurator";
import { HoneypotBadge } from "./HoneypotBadge";
import { TradingWalletSetup } from "./TradingWalletSetup";
import { AGENT_NAME, BOT_NAME } from "../lib/brand";
import { LilaAvatar } from "./LilaAvatar";

type Trader = ReturnType<typeof useAutoTrader>;

type Props = {
  token: Token;
  honeypot: HoneypotCheck | null;
  trader: Trader;
  tradingWallet: ReturnType<typeof useTradingWallet>;
};

export function AutoBotPanel({ token, honeypot, trader, tradingWallet }: Props) {
  const { running, busy, config, setConfig, runtime, logs, start, stop, clearLogs } =
    trader;

  const walletReady = tradingWallet.sessionActive && tradingWallet.zapApproved;
  const honeypotBlocked = honeypot?.status === "risk";
  const canStart =
    walletReady && !honeypotBlocked && token.lifecycle !== "graduating" && !running;

  return (
    <div className="auto-bot auto-bot--pro">
      <details
        className="auto-bot__wallet-fold"
        open={!tradingWallet.sessionActive || !tradingWallet.zapApproved}
      >
        <summary>
          <span>Trading wallet</span>
          {tradingWallet.sessionActive && (
            <span className="auto-bot__wallet-summary mono muted">
              {tradingWallet.usdcLabel} USDC
              {tradingWallet.zapApproved ? " · ready" : " · approve Zap"}
            </span>
          )}
        </summary>
        <TradingWalletSetup wallet={tradingWallet} disabled={running} compact />
      </details>

      <div className="auto-bot__grid auto-bot__grid--strategy">
        <div className="auto-bot__main">
          {honeypot && honeypot.status !== "clear" && (
            <HoneypotBadge honeypot={honeypot} showDetail />
          )}

          <StrategyConfigurator
            config={config}
            setConfig={setConfig}
            disabled={running}
            currentPrice={token.priceUsd}
            baselinePrice={runtime?.baselinePrice}
          />

          <div className="auto-bot__actions auto-bot__actions--bar">
            {!running ? (
              <button
                type="button"
                className="btn btn--primary auto-bot__start"
                disabled={!canStart || busy}
                onClick={start}
              >
                Start {BOT_NAME}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--sell auto-bot__stop"
                disabled={busy}
                onClick={stop}
              >
                {busy ? `${AGENT_NAME} is executing…` : `Stop ${BOT_NAME}`}
              </button>
            )}
            {!walletReady && !running && (
              <p className="auto-bot__hint muted">Complete wallet setup to enable start.</p>
            )}
          </div>
        </div>

        <BotActivityFeed
          logs={logs}
          runtime={runtime}
          running={running}
          onClear={clearLogs}
        />
      </div>
    </div>
  );
}
