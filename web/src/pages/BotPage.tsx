import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount, useConnect } from "wagmi";
import { formatUnits, isAddress } from "viem";
import {
  fetchToken,
  fetchTokens,
  type HoneypotCheck,
  type Token,
} from "../api";
import { BotRiskConsentGate } from "../components/bot/BotRiskConsentGate";
import { BotSetupStrip } from "../components/bot/BotSetupStrip";
import { BotTokenHero } from "../components/bot/BotTokenHero";
import { BotTokenList } from "../components/bot/BotTokenList";
import { WebBotTrade } from "../components/WebBotTrade";
import { AutoBotPanel } from "../components/AutoBotPanel";
import { formatPriceUsd } from "../lib/format";
import {
  getRecentTokens,
  pushRecentToken,
  toggleWatchlist,
  isWatchlisted,
  getWatchlist,
  type StoredTokenRef,
} from "../lib/tokenStorage";
import { useUsdcBalance } from "../hooks/useUsdcBalance";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useAutoTrader } from "../hooks/useAutoTrader";
import { useBotRiskConsent } from "../hooks/useBotRiskConsent";
import { useTradingWallet } from "../hooks/useTradingWallet";
import { AGENT_NAME, BOT_NAME, BOT_TAGLINE } from "../lib/brand";
import { LilaAvatar } from "../components/LilaAvatar";
import { LaunchSniperPanel } from "../components/launch/LaunchSniperPanel";
import { useLaunchSniper } from "../hooks/useLaunchSniper";

type BotTab = "manual" | "auto";
type BotPageMode = "trade" | "launch";

function refsToTokens(refs: StoredTokenRef[]): Token[] {
  return refs.map((r) => ({
    address: r.address,
    name: r.name,
    ticker: r.ticker,
    image: r.image,
    description: "",
    urls: [],
    creator: "",
    ltAddress: "",
    pair: "",
    lifecycle: "curve",
    launchedAt: 0,
    reserves: { token: null, lt: null },
    ltBufferUsdc: null,
    exchangeRate: null,
    canGraduate: false,
    tradeCount: 0,
    volumeLt: "0",
    volumeUsd24h: 0,
    volumeUsdTotal: 0,
    mcapUsd: 0,
    priceUsd: 0,
    change24h: null,
    lastTradeAt: 0,
    curveFilledPct: 0,
    curveRaisedUsd: 0,
    altFunUrl: `https://alt.fun/token/${r.address}`,
  }));
}

export function BotPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isConnected, address } = useAccount();
  const riskConsent = useBotRiskConsent();
  const { connect, connectors, isPending } = useConnect();
  const { balance: usdcBalance } = useUsdcBalance();

  const [tab, setTab] = useState<BotTab>("manual");
  const [pageMode, setPageMode] = useState<BotPageMode>("trade");
  const [tokenInput, setTokenInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [searchHits, setSearchHits] = useState<Token[]>([]);
  const [token, setToken] = useState<Token | null>(null);
  const [honeypot, setHoneypot] = useState<HoneypotCheck | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTokens, setActiveTokens] = useState<Token[]>([]);
  const [trendingTokens, setTrendingTokens] = useState<Token[]>([]);
  const [recentRefs, setRecentRefs] = useState(getRecentTokens);
  const [watchRefs, setWatchRefs] = useState(getWatchlist);
  const [watched, setWatched] = useState(false);

  const tradingWallet = useTradingWallet();
  const autoTrader = useAutoTrader(token, honeypot, tradingWallet.session);
  const launchSniper = useLaunchSniper(tradingWallet.session, address);
  const { stop: stopAutoBot, running: autoBotRunning } = autoTrader;
  const autoBotRunningRef = useRef(autoBotRunning);
  autoBotRunningRef.current = autoBotRunning;

  const initialSide = searchParams.get("side") === "sell" ? "sell" : "buy";
  const initialAmount = searchParams.get("amount") ?? (initialSide === "buy" ? "25" : "50");

  const loadTokenByAddress = useCallback(
    (addr: string) => {
      const normalized = addr.trim();
      if (!isAddress(normalized)) {
        setError("Invalid address");
        return;
      }
      if (autoBotRunningRef.current) stopAutoBot();
      setTokenInput(normalized);
      setSearchQuery("");
      setSearchHits([]);
      setSearchParams({ token: normalized }, { replace: true });
      setError("");
      setTokenLoading(true);
      fetchToken(normalized)
        .then((data) => {
          setToken(data.token);
          setHoneypot(data.honeypot);
          pushRecentToken(data.token);
          setRecentRefs(getRecentTokens());
          setWatched(isWatchlisted(data.token.address));
        })
        .catch(() => {
          setError("Token not found");
          setToken(null);
          setHoneypot(null);
        })
        .finally(() => setTokenLoading(false));
    },
    [setSearchParams, stopAutoBot],
  );

  useEffect(() => {
    Promise.all([
      fetchTokens({ category: "active", limit: 8 }),
      fetchTokens({ category: "trending", limit: 8 }),
    ])
      .then(([a, t]) => {
        setActiveTokens(a.tokens);
        const set = new Set(a.tokens.map((x) => x.address.toLowerCase()));
        setTrendingTokens(t.tokens.filter((x) => !set.has(x.address.toLowerCase())));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = searchParams.get("token");
    if (q && isAddress(q)) loadTokenByAddress(q);
  }, [searchParams, loadTokenByAddress]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    fetchTokens({ search: q, limit: 8 })
      .then((r) => setSearchHits(r.tokens))
      .catch(() => setSearchHits([]));
  }, [debouncedSearch]);

  const recentTokens = useMemo(() => refsToTokens(recentRefs), [recentRefs]);
  const watchTokens = useMemo(() => refsToTokens(watchRefs), [watchRefs]);

  const mainUsdc = isConnected
    ? Number(formatUnits(usdcBalance, 6)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })
    : null;

  const pickFromSearch = (t: Token) => {
    loadTokenByAddress(t.address);
  };

  return (
    <div className="bot-page bot-page--pro">
      <header className="bot-hero">
        <div className="bot-hero__lead">
          <LilaAvatar size="lg" pulse={autoTrader.running || launchSniper.running} />
          <div className="bot-hero__copy">
            <p className="bot-hero__eyebrow">alt.fun · HyperEVM</p>
            <h1>{BOT_NAME}</h1>
            <p className="bot-hero__sub muted">{BOT_TAGLINE}</p>
            {autoTrader.running && (
              <p className="bot-agent-note">
                <LilaAvatar size="sm" pulse />
                {AGENT_NAME} is monitoring and executing your rules
              </p>
            )}
          </div>
        </div>
        <div className="bot-hero__stats">
          {mainUsdc != null && (
            <div className="bot-pill">
              <span className="bot-pill__label">Main wallet</span>
              <span className="bot-pill__value mono">{mainUsdc} USDC</span>
            </div>
          )}
          {tradingWallet.sessionActive && (
            <div className="bot-pill bot-pill--accent">
              <span className="bot-pill__label">Trading wallet</span>
              <span className="bot-pill__value mono">{tradingWallet.usdcLabel} USDC</span>
            </div>
          )}
          {launchSniper.running && (
            <div className="bot-pill bot-pill--live">
              <span className="bot-pill__dot" />
              <span className="bot-pill__value">Launch sniper</span>
            </div>
          )}
          {autoTrader.running && (
            <div className="bot-pill bot-pill--live">
              <span className="bot-pill__dot" />
              <span className="bot-pill__value">{AGENT_NAME} live</span>
            </div>
          )}
          {!isConnected && (
            <button
              type="button"
              className="btn btn--primary btn--xs"
              disabled={isPending}
              onClick={() => connect({ connector: connectors[0] })}
            >
              {isPending ? "…" : "Connect"}
            </button>
          )}
        </div>
      </header>

      {!riskConsent.accepted && (!isConnected || riskConsent.checked) && (
        <BotRiskConsentGate consent={riskConsent} />
      )}

      {!riskConsent.accepted && isConnected && !riskConsent.checked && (
        <div className="bot-risk-gate-loading muted">Checking risk acceptance…</div>
      )}

      {riskConsent.accepted && (
      <>
      <nav className="bot-page-tabs" aria-label="Bot mode">
        <button
          type="button"
          className={pageMode === "trade" ? "active" : ""}
          onClick={() => setPageMode("trade")}
        >
          Token trading
        </button>
        <button
          type="button"
          className={pageMode === "launch" ? "active" : ""}
          onClick={() => setPageMode("launch")}
        >
          New launches
          {launchSniper.running && <span className="bot-tabs__dot" />}
        </button>
      </nav>

      {pageMode === "launch" ? (
        <LaunchSniperPanel sniper={launchSniper} tradingWallet={tradingWallet} />
      ) : (
      <div className="bot-grid">
        <aside className="bot-panel bot-panel--picker">
          <div className="bot-panel__head">
            <h2>Markets</h2>
          </div>

          <label className="bot-search">
            <span className="bot-search__icon" aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              placeholder="Search name or ticker…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
          </label>

          {searchHits.length > 0 && (
            <ul className="bot-search-results">
              {searchHits.map((t) => (
                <li key={t.address}>
                  <button type="button" onClick={() => pickFromSearch(t)}>
                    <span className="bot-search-results__name">
                      ${t.ticker}
                      <span className="muted"> · {t.name}</span>
                    </span>
                    <span className="mono muted">{formatPriceUsd(t.priceUsd)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="bot-address-form"
            onSubmit={(e) => {
              e.preventDefault();
              loadTokenByAddress(tokenInput);
            }}
          >
            <input
              className="mono"
              placeholder="Paste contract 0x…"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button type="submit" className="btn btn--ghost btn--xs" disabled={tokenLoading}>
              {tokenLoading ? "…" : "Go"}
            </button>
          </form>

          {error && <p className="bot-field-error">{error}</p>}

          <BotTokenList
            recent={recentTokens}
            watch={watchTokens}
            active={activeTokens}
            trending={trendingTokens}
            selectedAddress={token?.address}
            onPick={loadTokenByAddress}
          />
        </aside>

        <section
          className={`bot-panel bot-panel--workspace ${tokenLoading ? "bot-panel--workspace-loading" : ""}`}
        >
          {!token && !tokenLoading && (
            <div className="bot-workspace-empty">
              <div className="bot-workspace-empty__icon">
                <LilaAvatar size="lg" />
              </div>
              <h2>Pick a token for {AGENT_NAME}</h2>
              <p className="muted">
                Search markets, paste a contract, or choose from Active / Hot — then Lila handles the rest.
              </p>
              <div className="bot-workspace-empty__chips">
                {activeTokens.slice(0, 4).map((t) => (
                  <button
                    key={t.address}
                    type="button"
                    className="btn btn--ghost btn--xs"
                    onClick={() => loadTokenByAddress(t.address)}
                  >
                    ${t.ticker}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tokenLoading && !token && (
            <div className="bot-workspace-loading">
              <div className="bot-skeleton bot-skeleton--hero" />
              <div className="bot-skeleton bot-skeleton--block" />
            </div>
          )}

          {token && (
            <div className="bot-workspace-content">
              {tokenLoading && (
                <div className="bot-workspace-overlay" aria-busy="true">
                  <span className="bot-workspace-overlay__spinner" />
                  <span>Loading token…</span>
                </div>
              )}
              <BotTokenHero
                token={token}
                honeypot={honeypot}
                watched={watched}
                loading={tokenLoading}
                onToggleWatch={() => {
                  const on = toggleWatchlist(token);
                  setWatched(on);
                  setWatchRefs(getWatchlist());
                }}
              />

              <div className="bot-workspace-tabs">
                <button
                  type="button"
                  className={tab === "manual" ? "active" : ""}
                  onClick={() => setTab("manual")}
                >
                  <span className="bot-workspace-tabs__title">Manual</span>
                  <span className="muted">You approve each swap</span>
                </button>
                <button
                  type="button"
                  className={tab === "auto" ? "active" : ""}
                  onClick={() => setTab("auto")}
                >
                  <span className="bot-workspace-tabs__title">
                    {BOT_NAME}
                    {autoTrader.running && <span className="bot-tabs__dot" />}
                  </span>
                  <span className="muted">Lila executes · no popups</span>
                </button>
              </div>

              <BotSetupStrip
                wallet={tradingWallet}
                botRunning={autoTrader.running}
                tab={tab}
              />

              <div className="bot-workspace-body">
              {tab === "manual" && (
                <div className="bot-trade-panel">
                <WebBotTrade
                    key={token.address}
                    token={token}
                    honeypot={honeypot}
                    initialSide={initialSide}
                  initialAmount={initialAmount}
                />
                </div>
              )}

              {tab === "auto" && (
                  <AutoBotPanel
                    token={token}
                    honeypot={honeypot}
                    trader={autoTrader}
                    tradingWallet={tradingWallet}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      )}
      </>
      )}
    </div>
  );
}
