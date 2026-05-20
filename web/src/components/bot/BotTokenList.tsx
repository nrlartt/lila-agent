import { useState } from "react";
import type { Token } from "../../api";
import { formatPercent, formatPriceUsd } from "../../lib/format";
import { TokenAvatar } from "../ui/TokenAvatar";

export type BotListTab = "recent" | "watch" | "active" | "trending";

type Props = {
  recent: Token[];
  watch: Token[];
  active: Token[];
  trending: Token[];
  selectedAddress?: string;
  onPick: (address: string) => void;
};

const TABS: { id: BotListTab; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "watch", label: "Watch" },
  { id: "active", label: "Active" },
  { id: "trending", label: "Hot" },
];

export function BotTokenList({
  recent,
  watch,
  active,
  trending,
  selectedAddress,
  onPick,
}: Props) {
  const [tab, setTab] = useState<BotListTab>("active");

  const lists: Record<BotListTab, Token[]> = {
    recent,
    watch,
    active,
    trending,
  };

  const tokens = lists[tab];
  const firstNonEmpty =
    recent.length > 0
      ? "recent"
      : watch.length > 0
        ? "watch"
        : active.length > 0
          ? "active"
          : "trending";

  const effectiveTab = tokens.length > 0 ? tab : firstNonEmpty;
  const display = lists[effectiveTab];

  return (
    <div className="bot-token-list">
      <div className="bot-token-list__tabs">
        {TABS.map((t) => {
          const count = lists[t.id].length;
          if (count === 0 && t.id !== "active" && t.id !== "trending") return null;
          return (
            <button
              key={t.id}
              type="button"
              className={effectiveTab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {count > 0 && <span className="bot-token-list__count">{count}</span>}
            </button>
          );
        })}
      </div>

      <ul className="bot-token-list__rows">
        {display.length === 0 && (
          <li className="bot-token-list__empty muted">No tokens in this list</li>
        )}
        {display.map((t) => {
          const selected =
            selectedAddress?.toLowerCase() === t.address.toLowerCase();
          const ch = t.change24h;
          const up = ch != null && ch >= 0;
          return (
            <li key={t.address}>
              <button
                type="button"
                className={`bot-token-row ${selected ? "bot-token-row--selected" : ""}`}
                onClick={() => onPick(t.address)}
              >
                <TokenAvatar image={t.image} ticker={t.ticker} size="sm" />
                <span className="bot-token-row__main">
                  <span className="bot-token-row__name">${t.ticker}</span>
                  <span className="bot-token-row__sub muted">{t.name}</span>
                </span>
                <span className="bot-token-row__meta mono">
                  <span>{formatPriceUsd(t.priceUsd)}</span>
                  {ch != null && (
                    <span className={up ? "bot-token-row__up" : "bot-token-row__down"}>
                      {formatPercent(ch)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
