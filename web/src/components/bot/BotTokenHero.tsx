import { Link } from "react-router-dom";
import type { HoneypotCheck, Token } from "../../api";
import { formatPercent, formatPriceUsd, formatUsd, shortAddress } from "../../lib/format";
import { HoneypotBadge } from "../HoneypotBadge";
import { TokenSparkline } from "../TokenSparkline";
import { TokenAvatar } from "../ui/TokenAvatar";
import { LifecycleBadge } from "../ui/LifecycleBadge";

type Props = {
  token: Token;
  honeypot: HoneypotCheck | null;
  watched: boolean;
  loading?: boolean;
  onToggleWatch: () => void;
};

export function BotTokenHero({
  token,
  honeypot,
  watched,
  loading,
  onToggleWatch,
}: Props) {
  const ch = token.change24h;
  const up = ch != null && ch >= 0;

  return (
    <div className={`bot-token-hero ${loading ? "bot-token-hero--loading" : ""}`}>
      <div className="bot-token-hero__top">
        <TokenAvatar image={token.image} ticker={token.ticker} size="lg" />
        <div className="bot-token-hero__identity">
          <h2>
            {token.name}
            <span className="muted"> ${token.ticker}</span>
          </h2>
          <span className="bot-token-hero__addr mono muted">
            {shortAddress(token.address)}
          </span>
        </div>
        <div className="bot-token-hero__actions">
          <button
            type="button"
            className={`bot-icon-btn ${watched ? "active" : ""}`}
            title={watched ? "Remove from watchlist" : "Add to watchlist"}
            onClick={onToggleWatch}
          >
            {watched ? "★" : "☆"}
          </button>
          <Link to={`/token/${token.address}`} className="btn btn--ghost btn--xs">
            Chart
          </Link>
        </div>
      </div>

      <div className="bot-token-hero__stats">
        <div className="bot-stat">
          <span className="bot-stat__label">Price</span>
          <span className="bot-stat__value mono">{formatPriceUsd(token.priceUsd)}</span>
        </div>
        <div className="bot-stat">
          <span className="bot-stat__label">24h</span>
          <span
            className={`bot-stat__value mono ${ch == null ? "" : up ? "bot-stat__up" : "bot-stat__down"}`}
          >
            {formatPercent(ch)}
          </span>
        </div>
        <div className="bot-stat">
          <span className="bot-stat__label">Mcap</span>
          <span className="bot-stat__value mono">{formatUsd(token.mcapUsd)}</span>
        </div>
        <div className="bot-stat bot-stat--badges">
          <LifecycleBadge lifecycle={token.lifecycle} />
          <HoneypotBadge honeypot={honeypot} compact />
        </div>
      </div>

      <TokenSparkline address={token.address} />
    </div>
  );
}
