import {
  ensureTokenInDb,
  fetchRecentGlobalTrades,
  refreshTokenFromApi,
  type ApiTrade,
} from "./altfun-api.js";
import { touchTokenTrade } from "./db.js";

const POLL_MS = Number(process.env.ACTIVITY_POLL_MS ?? 4_000);
const TRADE_LIMIT = Number(process.env.ACTIVITY_TRADE_LIMIT ?? 50);
const REFRESH_DEBOUNCE_MS = Number(process.env.ACTIVITY_REFRESH_MS ?? 2_000);

type BroadcastFn = (event: string, data: unknown) => void;

let broadcast: BroadcastFn = () => {};

const seenTradeIds = new Set<string>();
const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setActivityBroadcast(fn: BroadcastFn) {
  broadcast = fn;
}

function tradeTimestamp(tr: ApiTrade): number {
  const ts = Number(tr.timestamp);
  return ts > 1e12 ? Math.floor(ts / 1000) : ts;
}

function rememberTradeId(id: string) {
  seenTradeIds.add(id);
  if (seenTradeIds.size > 1_000) {
    const drop = [...seenTradeIds].slice(0, 200);
    for (const key of drop) seenTradeIds.delete(key);
  }
}

function scheduleMarketRefresh(address: string) {
  const addr = address.toLowerCase();
  const existing = refreshTimers.get(addr);
  if (existing) clearTimeout(existing);

  refreshTimers.set(
    addr,
    setTimeout(async () => {
      refreshTimers.delete(addr);
      try {
        const ok = await refreshTokenFromApi(addr);
        if (ok) broadcast("token_updated", { address: addr });
      } catch {
        // skip single token
      }
    }, REFRESH_DEBOUNCE_MS),
  );
}

export async function pollGlobalActivity(): Promise<number> {
  const trades = await fetchRecentGlobalTrades(TRADE_LIMIT);
  if (trades.length === 0) return 0;

  let newCount = 0;

  for (const tr of trades) {
    if (!tr.id || !tr.tokenAddress) continue;
    if (seenTradeIds.has(tr.id)) continue;

    rememberTradeId(tr.id);
    newCount++;

    const addr = tr.tokenAddress.toLowerCase();
    const at = tradeTimestamp(tr);

    if (!(await ensureTokenInDb(addr))) continue;

    touchTokenTrade(addr, tr.isBuy, at);
    broadcast("trade", { token: addr, isBuy: tr.isBuy, at });

    scheduleMarketRefresh(addr);
  }

  return newCount;
}

export function startActivityPoller() {
  const tick = () => pollGlobalActivity().catch(() => {});

  tick();
  setInterval(tick, POLL_MS);
  console.log(`Activity poller: alt.fun trades every ${POLL_MS}ms`);
}
