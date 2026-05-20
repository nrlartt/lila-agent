import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTokens, type Token } from "../api";
import { formatPercent, formatPriceUsd } from "../lib/format";

const TICKER_POLL_MS = 45_000;

export function PriceTickerBar() {
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetchTokens({ category: "volume", limit: 24 });
        if (!cancelled) setTokens(res.tokens);
      } catch {
        if (!cancelled) setTokens([]);
      }
    };

    void load();
    const poll = setInterval(() => void load(), TICKER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  if (tokens.length === 0) return null;

  const items = [...tokens, ...tokens];

  return (
    <div className="price-ticker" aria-label="Top volume tokens">
      <div className="price-ticker__track">
        {items.map((t, i) => (
          <Link
            key={`${t.address}-${i}`}
            to={`/token/${t.address}`}
            className="price-ticker__item"
          >
            <span className="price-ticker__ticker">${t.ticker}</span>
            <span className="price-ticker__price mono">{formatPriceUsd(t.priceUsd)}</span>
            {t.change24h != null && !Number.isNaN(t.change24h) && (
              <span className={`price-ticker__change ${t.change24h >= 0 ? "up" : "down"}`}>
                {formatPercent(t.change24h)}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
