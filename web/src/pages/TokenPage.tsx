import { useCallback, useEffect, useRef, useState } from "react";

import { Link, useParams } from "react-router-dom";

import {

  fetchToken,

  fetchTokenHolders,

  subscribeEvents,

  type Holder,

  type HoneypotCheck,

  type Token,

  type Trade,

} from "../api";

import { useLaunchFlash, useTradeFlash } from "../context/TradeFlashContext";

import {

  formatPercent,

  formatPriceUsd,

  formatUsd,

  shortAddress,

  timeAgo,

} from "../lib/format";

import { BondingCurveBar } from "../components/BondingCurveBar";

import { TokenActivityPanel } from "../components/TokenActivityPanel";

import { TradePanel } from "../components/TradePanel";

import { TokenPriceChart } from "../components/TokenPriceChart";

import { showsBondingCurve } from "../lib/curve";

import { LifecycleBadge } from "../components/ui/LifecycleBadge";

import { TokenAvatar } from "../components/ui/TokenAvatar";

import { CopyButton } from "../components/ui/CopyButton";
import { HoneypotBadge } from "../components/HoneypotBadge";



export function TokenPage() {

  const { address } = useParams<{ address: string }>();

  const [token, setToken] = useState<Token | null>(null);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [honeypot, setHoneypot] = useState<HoneypotCheck | null>(null);

  const [holders, setHolders] = useState<Holder[]>([]);

  const [holdersMeta, setHoldersMeta] = useState<{

    total: number;

    approximate: boolean;

  } | null>(null);

  const [holdersInitialLoading, setHoldersInitialLoading] = useState(true);
  const [holdersRefreshing, setHoldersRefreshing] = useState(false);

  const [highlightTradeKey, setHighlightTradeKey] = useState<string | null>(null);

  const prevTopTrade = useRef<string | null>(null);
  const holdersReadyRef = useRef(false);
  const holdersRefreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tradeFlash = useTradeFlash(address ?? "");

  const launchFlash = useLaunchFlash(address ?? "");



  const load = () => {

    if (!address) return;

    fetchToken(address).then((data) => {
      setToken(data.token);
      setTrades(data.trades);
      setHoneypot(data.honeypot);
    });

  };



  const loadHolders = useCallback(
    (options?: { background?: boolean }) => {
      if (!address) return;

      const background = options?.background ?? holdersReadyRef.current;
      if (!background) setHoldersInitialLoading(true);
      else setHoldersRefreshing(true);

      fetchTokenHolders(address, 50)
        .then((data) => {
          setHolders(data.holders);
          setHoldersMeta({
            total: data.totalHolders,
            approximate: data.approximate,
          });
          holdersReadyRef.current = true;
        })
        .catch(() => {
          if (!background) {
            setHolders([]);
            setHoldersMeta(null);
          }
        })
        .finally(() => {
          setHoldersInitialLoading(false);
          setHoldersRefreshing(false);
        });
    },
    [address],
  );

  const scheduleHoldersRefresh = useCallback(() => {
    clearTimeout(holdersRefreshTimer.current);
    holdersRefreshTimer.current = setTimeout(() => {
      loadHolders({ background: true });
    }, 60_000);
  }, [loadHolders]);

  useEffect(() => {
    holdersReadyRef.current = false;
    setHolders([]);
    setHoldersMeta(null);
    setHoldersInitialLoading(true);
    loadHolders({ background: false });
    return () => clearTimeout(holdersRefreshTimer.current);
  }, [address, loadHolders]);

  useEffect(() => {
    load();
    return subscribeEvents((type, data) => {
      const d = data as { token?: string; address?: string };
      const addr = (d.token ?? d.address)?.toLowerCase();
      const mine = address?.toLowerCase();
      if (!mine || addr !== mine) return;

      if (type === "trade") {
        load();
        scheduleHoldersRefresh();
        return;
      }

      if (type === "token_updated") {
        load();
        scheduleHoldersRefresh();
      }
    });
  }, [address, scheduleHoldersRefresh]);



  useEffect(() => {

    const top = trades[0];

    if (!top) return;

    const key = `${top.txHash}-${top.id}`;

    if (prevTopTrade.current && prevTopTrade.current !== key) {

      setHighlightTradeKey(key);

      prevTopTrade.current = key;

      const t = setTimeout(() => setHighlightTradeKey(null), 2_000);

      return () => clearTimeout(t);

    }

    prevTopTrade.current = key;

  }, [trades]);



  if (!token || !address) {

    return (

      <div className="token-detail token-detail--loading">

        <div className="skeleton" style={{ height: 88, marginBottom: "1rem" }} />

        <div className="skeleton chart-skeleton" />

      </div>

    );

  }



  const change24h = token.change24h;

  const changeUp = change24h != null && change24h >= 0;

  const liveTag = launchFlash

    ? { label: "NEW", className: "token-detail__live-tag--launch" }

    : tradeFlash

      ? {

          label: tradeFlash.side === "buy" ? "BUY" : "SELL",

          className: `token-detail__live-tag--${tradeFlash.side}`,

        }

      : null;



  const externalLinks = [

    { href: token.altFunUrl, label: "alt.fun" },

    ...token.urls.filter(Boolean).map((u) => ({

      href: u.startsWith("http") ? u : `https://${u}`,

      label: "Link",

    })),

  ];



  return (

    <>

      <Link to="/" className="back-link">

        ← Back to feed

      </Link>



      <div className="token-detail">

        <header className="token-detail-hero glass-panel">

          <div className="token-detail-hero__top">

            <TokenAvatar image={token.image} ticker={token.ticker} size="lg" />

            <div className="token-detail-hero__identity">

              <div className="token-detail-hero__title">

                <h1>{token.name}</h1>

                <span className="token-detail-hero__ticker">${token.ticker}</span>

                <LifecycleBadge lifecycle={token.lifecycle} />
                <HoneypotBadge honeypot={honeypot} compact />

                {liveTag && (

                  <span className={`token-detail__live-tag ${liveTag.className}`}>

                    {liveTag.label}

                  </span>

                )}

              </div>

              {token.description && (

                <p className="token-detail-hero__desc">{token.description}</p>

              )}

              <div className="token-detail-hero__meta">

                <code className="token-detail-hero__address">{shortAddress(token.address, 8, 6)}</code>

                <CopyButton text={token.address} />

                <Link
                  to={`/bot?token=${token.address}`}
                  className="token-detail-hero__link token-detail-hero__link--bot"
                >
                  Bot ⚡
                </Link>

                {externalLinks.map((link) => (

                  <a

                    key={link.href}

                    href={link.href}

                    target="_blank"

                    rel="noreferrer"

                    className="token-detail-hero__link"

                  >

                    {link.label} ↗

                  </a>

                ))}

              </div>

            </div>

            <div className="token-detail-hero__price-block">

              <span className="token-detail-hero__price">{formatPriceUsd(token.priceUsd)}</span>

              {change24h != null && (

                <span className={`token-detail-hero__change ${changeUp ? "up" : "down"}`}>

                  {formatPercent(change24h)} 24h

                </span>

              )}

            </div>

          </div>



          <div className="token-detail-hero__stats token-detail-hero__stats--4">

            <Stat label="Market cap" value={formatUsd(token.mcapUsd)} />

            <Stat label="Vol 24h" value={formatUsd(token.volumeUsd24h)} highlight />

            <Stat

              label="Holders"

              value={

                holdersInitialLoading

                  ? "…"

                  : holdersMeta

                    ? holdersMeta.total.toLocaleString()

                    : "—"

              }

            />

            <Stat label="Last trade" value={token.lastTradeAt ? timeAgo(token.lastTradeAt) : "—"} />

          </div>

        </header>



        <div className="detail-grid">

          <div className="token-detail__main">

            <TokenPriceChart address={address} ticker={token.ticker} />



            {showsBondingCurve(token.lifecycle) && (

              <section className="glass-panel token-detail-section">

                <div className="panel-body">

                  <BondingCurveBar token={token} variant="detail" />

                </div>

              </section>

            )}



            <TokenActivityPanel

              token={token}

              trades={trades}

              holders={holders}

              holdersInitialLoading={holdersInitialLoading}
              holdersRefreshing={holdersRefreshing}

              highlightTradeKey={highlightTradeKey}

            />



            <details className="token-detail-advanced glass-panel">

              <summary>Contract & on-chain details</summary>

              <div className="panel-body">

                <div className="detail-facts">

                  <Fact label="Token" value={shortAddress(token.address)} full={token.address} />

                  <Fact label="Creator" value={shortAddress(token.creator)} full={token.creator} />

                  <Fact label="LT" value={shortAddress(token.ltAddress)} full={token.ltAddress} />

                  <Fact

                    label="Pair"

                    value={token.pair ? shortAddress(token.pair) : "—"}

                    full={token.pair}

                  />

                  <Fact label="Launched" value={timeAgo(token.launchedAt)} />

                  {token.lifecycle === "curve" && (

                    <Fact label="Grad ready" value={token.canGraduate ? "Yes" : "No"} />

                  )}

                </div>

              </div>

            </details>

          </div>



          <TradePanel key={token.address} token={token} honeypot={honeypot} />

        </div>

      </div>

    </>

  );

}



function Stat({

  label,

  value,

  highlight,

}: {

  label: string;

  value: string;

  highlight?: boolean;

}) {

  return (

    <div className={`token-detail-stat ${highlight ? "token-detail-stat--hi" : ""}`}>

      <span className="token-detail-stat__label">{label}</span>

      <span className="token-detail-stat__value">{value}</span>

    </div>

  );

}



function Fact({ label, value, full }: { label: string; value: string; full?: string }) {

  return (

    <div className="detail-fact">

      <span className="detail-fact__label">{label}</span>

      <span className="detail-fact__value" title={full}>

        {value}

      </span>

    </div>

  );

}

