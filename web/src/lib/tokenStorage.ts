import type { Token } from "../api";

const RECENT_KEY = "alt_recent_tokens";
const WATCH_KEY = "alt_watchlist";
const TX_KEY = "alt_tx_history";
const MAX_RECENT = 8;
const MAX_TX = 20;

export type StoredTokenRef = {
  address: string;
  name: string;
  ticker: string;
  image: string;
};

export type StoredTx = {
  hash: string;
  token: string;
  ticker: string;
  side: "buy" | "sell";
  amount: string;
  at: number;
  usdcRaw?: string;
  tokenRaw?: string;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function tokenToRef(t: Token): StoredTokenRef {
  return {
    address: t.address.toLowerCase(),
    name: t.name,
    ticker: t.ticker,
    image: t.image,
  };
}

export function getRecentTokens(): StoredTokenRef[] {
  return readJson<StoredTokenRef[]>(RECENT_KEY, []);
}

export function pushRecentToken(t: Token): void {
  const ref = tokenToRef(t);
  const list = getRecentTokens().filter((x) => x.address !== ref.address);
  writeJson(RECENT_KEY, [ref, ...list].slice(0, MAX_RECENT));
}

export function getWatchlist(): StoredTokenRef[] {
  return readJson<StoredTokenRef[]>(WATCH_KEY, []);
}

export function toggleWatchlist(t: Token): boolean {
  const ref = tokenToRef(t);
  const list = getWatchlist();
  const idx = list.findIndex((x) => x.address === ref.address);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeJson(WATCH_KEY, list);
    return false;
  }
  writeJson(WATCH_KEY, [ref, ...list].slice(0, 30));
  return true;
}

export function isWatchlisted(address: string): boolean {
  const a = address.toLowerCase();
  return getWatchlist().some((x) => x.address === a);
}

export function getTxHistory(): StoredTx[] {
  return readJson<StoredTx[]>(TX_KEY, []);
}

export function recordTx(tx: StoredTx): void {
  const list = getTxHistory().filter((x) => x.hash !== tx.hash);
  writeJson(TX_KEY, [tx, ...list].slice(0, MAX_TX));
}
