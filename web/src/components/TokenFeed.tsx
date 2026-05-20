import { useCallback, useEffect, useRef, useState } from "react";

import {

  fetchStats,

  fetchToken,

  fetchTokens,

  subscribeEvents,

  type GlobalStats,

  type Token,

  type TokenCategory,

  type TradeEvent,

  type TokenLaunchedEvent,

  type TokenUpdatedEvent,

} from "../api";

import { TokenCard } from "./TokenCard";
import { FeedHoneypotProvider } from "../context/FeedHoneypotContext";



const CATEGORIES: { id: TokenCategory; label: string; icon?: string }[] = [
  { id: "all", label: "All", icon: "◈" },
  { id: "trending", label: "Trending", icon: "⚡" },
  { id: "new", label: "New 24h", icon: "✦" },
  { id: "curve", label: "Bonding", icon: "◎" },
  { id: "graduated", label: "Graduated", icon: "◇" },
];



const PAGE_SIZE = 36;

const ALL_POLL_MS = 5_000;

const TRADE_REFRESH_MS = 600;



function bumpTokenToTop(list: Token[], address: string, at: number): Token[] {

  const addr = address.toLowerCase();

  const idx = list.findIndex((t) => t.address === addr);

  if (idx === 0) {

    const [top] = list;

    return [{ ...top, lastTradeAt: Math.max(top.lastTradeAt, at) }, ...list.slice(1)];

  }

  if (idx > 0) {

    const next = [...list];

    const [item] = next.splice(idx, 1);

    return [{ ...item, lastTradeAt: at }, ...next];

  }

  return list;

}



export function TokenFeed() {

  const [tokens, setTokens] = useState<Token[]>([]);

  const [category, setCategory] = useState<TokenCategory>("all");

  const [search, setSearch] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [loadingMore, setLoadingMore] = useState(false);

  const [hasMore, setHasMore] = useState(false);

  const [total, setTotal] = useState(0);

  const [stats, setStats] = useState<GlobalStats | null>(null);

  const offsetRef = useRef(0);

  const categoryRef = useRef(category);

  const searchRef = useRef(debouncedSearch);



  categoryRef.current = category;

  searchRef.current = debouncedSearch;



  const loadStats = useCallback(async () => {

    try {

      setStats(await fetchStats());

    } catch {

      // optional

    }

  }, []);



  const loadPage = useCallback(

    async (reset: boolean, opts?: { silent?: boolean }) => {

      const offset = reset ? 0 : offsetRef.current;

      if (reset && !opts?.silent) setLoading(true);

      else if (!reset) setLoadingMore(true);



      try {

        const res = await fetchTokens({

          category: categoryRef.current,

          search: searchRef.current || undefined,

          limit: PAGE_SIZE,

          offset,

        });



        setTotal(res.total);

        setHasMore(res.hasMore);

        offsetRef.current = offset + res.tokens.length;

        setTokens((prev) => (reset ? res.tokens : [...prev, ...res.tokens]));

      } finally {

        setLoading(false);

        setLoadingMore(false);

      }

    },

    [],

  );



  useEffect(() => {

    const t = setTimeout(() => setDebouncedSearch(search), 300);

    return () => clearTimeout(t);

  }, [search]);



  useEffect(() => {

    offsetRef.current = 0;

    loadPage(true);

  }, [category, debouncedSearch, loadPage]);



  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);



  const scheduleRefresh = useCallback(() => {

    if (refreshTimer.current) clearTimeout(refreshTimer.current);

    refreshTimer.current = setTimeout(() => {

      loadPage(true, { silent: true });

      loadStats();

    }, TRADE_REFRESH_MS);

  }, [loadPage, loadStats]);



  useEffect(() => {

    loadStats();

    const statsTimer = setInterval(loadStats, 30_000);



    const unsub = subscribeEvents((type, data) => {

      if (type === "token_launched") {

        const d = data as TokenLaunchedEvent;

        if (d.address && categoryRef.current === "all" && !searchRef.current) {

          const addr = d.address.toLowerCase();

          fetchToken(addr)

            .then(({ token }) => {

              setTokens((prev) => {

                const isNew = !prev.some((t) => t.address === token.address);

                if (isNew) setTotal((n) => n + 1);

                const rest = prev.filter((t) => t.address !== token.address);

                return [token, ...rest];

              });

            })

            .catch(() => loadPage(true, { silent: true }));

        } else {

          loadPage(true, { silent: true });

        }

        loadStats();

        return;

      }



      if (type === "token_graduating" || type === "token_graduated") {

        loadPage(true, { silent: true });

        loadStats();

        return;

      }



      if (type === "trade") {

        const d = data as TradeEvent;

        if (!d.token) return;



        const at = d.at ?? Math.floor(Date.now() / 1000);



        if (categoryRef.current === "all" && !searchRef.current) {

          setTokens((prev) => bumpTokenToTop(prev, d.token, at));

        }



        scheduleRefresh();

        loadStats();

        return;

      }



      if (type === "token_updated") {

        const d = data as TokenUpdatedEvent;

        if (!d.address) return;



        fetchToken(d.address)

          .then(({ token }) => {

            setTokens((prev) => {

              const idx = prev.findIndex((t) => t.address === token.address);

              if (idx < 0) return prev;

              const next = [...prev];

              next[idx] = token;

              if (categoryRef.current === "all" && !searchRef.current) {

                const [item] = next.splice(idx, 1);

                return [item, ...next];

              }

              return next;

            });

          })

          .catch(() => scheduleRefresh());

      }

    });



    return () => {

      clearInterval(statsTimer);

      if (refreshTimer.current) clearTimeout(refreshTimer.current);

      unsub();

    };

  }, [loadPage, loadStats, scheduleRefresh]);



  useEffect(() => {

    if (category !== "all" || debouncedSearch) return;



    const poll = setInterval(() => {

      loadPage(true, { silent: true });

    }, ALL_POLL_MS);



    return () => clearInterval(poll);

  }, [category, debouncedSearch, loadPage]);



  const indexing = stats != null && !stats.launchBackfillComplete;

  const categoryMeta = CATEGORIES.find((c) => c.id === category);



  return (

    <div className="terminal">

      <section className="terminal-hero">

        <div className="terminal-hero__top">

          <p className="terminal-hero__eyebrow">

            <span className="terminal-hero__prompt">›</span>

            Lila Agent · alt.fun · HyperEVM

            <span className="live-pill live-pill--inline">

              <span className="live-pill__dot" />

              live

            </span>

          </p>

          <h1 className="terminal-hero__title">

            Trade & monitor

            <span> every launch</span>

          </h1>

          <p className="terminal-hero__desc">

            Full token catalog with volume-ranked feeds, lifecycle filters, and

            non-custodial swaps through the official Zap contract.

          </p>

        </div>



        <div className="terminal-hero__stats">

          <StatTile label="Tokens" value={stats?.total ?? total} accent />

          <StatTile label="24h volume leaders" value={stats?.active ?? 0} />

          <StatTile label="On curve" value={stats?.curve ?? 0} />

          <StatTile label="Graduated" value={stats?.graduated ?? 0} />

        </div>



      </section>



      <section className="terminal-workspace glass-panel">

        <div className="terminal-workspace__toolbar">

          <div className="terminal-search">

            <span className="terminal-search__icon" aria-hidden>

              ⌕

            </span>

            <input

              className="terminal-search__input"

              placeholder="Search name, ticker, or address…"

              value={search}

              onChange={(e) => setSearch(e.target.value)}

            />

            {search && (

              <button

                type="button"

                className="terminal-search__clear"

                onClick={() => setSearch("")}

                aria-label="Clear search"

              >

                ×

              </button>

            )}

          </div>



          <div className="terminal-workspace__meta">

            <h2>

              {categoryMeta?.icon} {categoryMeta?.label ?? "Tokens"}

            </h2>

            <span className="terminal-workspace__count">{total.toLocaleString()}</span>

          </div>

        </div>



        <div className="category-rail">

          <div className="category-rail__scroll">

            {CATEGORIES.map(({ id, label, icon }) => (

              <button

                key={id}

                type="button"

                className={`category-pill ${category === id ? "active" : ""}`}

                onClick={() => setCategory(id)}

              >

                {icon && <span className="category-pill__icon">{icon}</span>}

                {label}

              </button>

            ))}

          </div>

        </div>



        <div className="terminal-workspace__body">

          {loading && (

            <div className="token-cards-grid">

              {Array.from({ length: 9 }).map((_, i) => (

                <div key={i} className="token-card-skeleton" />

              ))}

            </div>

          )}



          {!loading && tokens.length === 0 && (

            <EmptyState indexing={indexing} />

          )}



          {!loading && tokens.length > 0 && (

            <FeedHoneypotProvider addresses={tokens.map((t) => t.address)}>
              <div className="token-cards-grid">
                {tokens.map((t, i) => (
                  <TokenCard
                    key={t.address}
                    token={t}
                    rank={category === "volume" && !debouncedSearch ? i + 1 : undefined}
                  />
                ))}
              </div>
            </FeedHoneypotProvider>

          )}



          {!loading && hasMore && (

            <div className="terminal-load-more">

              <button

                type="button"

                className="btn btn--outline"

                disabled={loadingMore}

                onClick={() => loadPage(false)}

              >

                {loadingMore

                  ? "Loading…"

                  : `Load more · ${tokens.length} of ${total.toLocaleString()}`}

              </button>

            </div>

          )}

        </div>

      </section>

    </div>

  );

}



function StatTile({

  label,

  value,

  accent,

}: {

  label: string;

  value: number;

  accent?: boolean;

}) {

  return (

    <div className={`stat-tile ${accent ? "stat-tile--accent" : ""}`}>

      <span className="stat-tile__label">{label}</span>

      <span className="stat-tile__value">{value.toLocaleString()}</span>

    </div>

  );

}



function EmptyState({ indexing }: { indexing: boolean }) {

  return (

    <div className="terminal-empty">

      <div className="terminal-empty__icon">◎</div>

      <h3>No tokens found</h3>

      <p>

        {indexing

          ? "Catalog is still syncing. Try again in a minute or switch category."

          : "Try a different filter or search term."}

      </p>

    </div>

  );

}


