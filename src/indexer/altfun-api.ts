import {
  type Lifecycle,
  getToken,
  upsertLaunch,
  upsertTokenEnrichment,
  upsertTokenMarketStats,
} from "./db.js";

export const ALTFUN_API_BASE =
  process.env.ALTFUN_API_URL?.trim() || "https://api.alt.fun";

export type ApiToken = {
  address: string;
  name: string;
  ticker: string;
  description?: string;
  imageUrl?: string;
  ltPair: string;
  bondingPair?: string;
  status?: string;
  graduated?: boolean;
  pendingGraduation?: boolean;
  poolAddress?: string | null;
  hyperswapPair?: string | null;
  creator: string;
  createdAt: string;
  curveSupply?: string;
  ltReserve?: string;
  curveFilled?: number | null;
  curveFilledOrganic?: number | null;
  curveRaisedUsd?: number | null;
  twitterUrl?: string;
  telegramUrl?: string;
  websiteUrl?: string;
  volume24hUsd?: number;
  totalVolumeUsd?: number;
  mcapUsd?: number;
  priceUsd?: number;
  change24h?: number | null;
  lastTradeAt?: string | null;
  isHidden?: boolean;
};

export type ApiTrade = {
  id: string;
  tokenAddress: string;
  trader: string;
  isBuy: boolean;
  usdcAmount: string;
  tokenAmount: string;
  blockNumber: string;
  timestamp: string;
};

function mapLifecycle(t: ApiToken): Lifecycle {
  if (t.graduated || t.status === "graduated") return "graduated";
  if (t.pendingGraduation || t.status === "graduating") return "graduating";
  return "curve";
}

function parseLastTradeAt(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor(new Date(iso).getTime() / 1000);
}

/** Import or refresh one token row from alt.fun API payload. */
export function importApiToken(t: ApiToken) {
  if (!t.address || !t.name || !t.ticker) return;
  if (t.isHidden) return;

  const address = t.address.toLowerCase();
  const launchedAt = Math.floor(new Date(t.createdAt).getTime() / 1000);
  const lifecycle = mapLifecycle(t);
  const pair =
    lifecycle === "graduated"
      ? (t.hyperswapPair ?? t.poolAddress ?? t.bondingPair ?? "").toLowerCase()
      : (t.bondingPair ?? "").toLowerCase();

  upsertLaunch({
    address,
    creator: t.creator.toLowerCase(),
    lt_address: t.ltPair.toLowerCase(),
    pair,
    name: t.name,
    ticker: t.ticker,
    description: t.description ?? "",
    image: t.imageUrl ?? "",
    url0: t.twitterUrl ?? "",
    url1: t.telegramUrl ?? "",
    url2: t.websiteUrl ?? "",
    lifecycle,
    k: "0",
    launched_block: 0,
    launched_tx: "",
    launched_at: launchedAt,
    graduated_pair: t.hyperswapPair?.toLowerCase() ?? t.poolAddress?.toLowerCase() ?? null,
    reserve_token: t.curveSupply ?? null,
    reserve_lt: t.ltReserve ?? null,
  });

  upsertTokenEnrichment({
    address,
    description: t.description ?? "",
    image: t.imageUrl ?? "",
    url0: t.twitterUrl ?? "",
    url1: t.telegramUrl ?? "",
    url2: t.websiteUrl ?? "",
    pair,
    lifecycle,
    graduated_pair: t.hyperswapPair?.toLowerCase() ?? t.poolAddress?.toLowerCase() ?? null,
    reserve_token: t.curveSupply ?? null,
    reserve_lt: t.ltReserve ?? null,
  });

  const curveFilled =
    t.curveFilled != null && !Number.isNaN(t.curveFilled) ? Number(t.curveFilled) : 0;

  upsertTokenMarketStats({
    address,
    volume_usd_24h: t.volume24hUsd ?? 0,
    volume_usd_total: t.totalVolumeUsd ?? 0,
    mcap_usd: t.mcapUsd ?? 0,
    price_usd: t.priceUsd ?? 0,
    change_24h: t.change24h ?? null,
    last_trade_at: parseLastTradeAt(t.lastTradeAt),
    curve_filled_pct: curveFilled,
    curve_raised_usd: t.curveRaisedUsd ?? 0,
  });
}

export async function fetchApiToken(address: string): Promise<ApiToken | null> {
  const res = await fetch(`${ALTFUN_API_BASE}/api/v1/tokens/${address}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { status: string; data: ApiToken };
  if (json.status !== "success" || !json.data) return null;
  return json.data;
}

export async function refreshTokenFromApi(address: string): Promise<boolean> {
  const t = await fetchApiToken(address);
  if (!t) return false;
  importApiToken(t);
  return true;
}

/** Latest trades across all tokens (Zap + bonding via alt.fun). */
export async function fetchRecentGlobalTrades(limit = 40): Promise<ApiTrade[]> {
  const pageSize = Math.min(Math.max(limit, 1), 100);
  const url = `${ALTFUN_API_BASE}/api/v1/trades?limit=${pageSize}&offset=0`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return [];

  const json = (await res.json()) as { status: string; data: ApiTrade[] };
  if (json.status !== "success" || !Array.isArray(json.data)) return [];
  return json.data;
}

/** Recent trades for a token (Zap tape via alt.fun API). */
export async function fetchApiTradesForToken(
  tokenAddress: string,
  limit = 40,
  opts?: { maxPages?: number },
): Promise<ApiTrade[]> {
  const want = tokenAddress.toLowerCase();
  const out: ApiTrade[] = [];
  let offset = 0;
  const pageSize = 100;
  const maxPages = opts?.maxPages ?? 8;

  for (let page = 0; page < maxPages && out.length < limit; page++) {
    const url = `${ALTFUN_API_BASE}/api/v1/trades?tokenAddress=${tokenAddress}&limit=${pageSize}&offset=${offset}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      break;
    }
    if (!res.ok) break;

    const json = (await res.json()) as { status: string; data: ApiTrade[] };
    if (json.status !== "success" || !Array.isArray(json.data) || json.data.length === 0) {
      break;
    }

    for (const tr of json.data) {
      if (tr.tokenAddress?.toLowerCase() === want) out.push(tr);
    }

    offset += json.data.length;
    if (json.data.length < pageSize) break;
  }

  return out.slice(0, limit);
}

export function apiTradeToRow(tr: ApiTrade, tokenAddress: string) {
  const ts = Number(tr.timestamp);
  const txHash = tr.id.includes("-") ? tr.id.split("-")[0]! : tr.id;
  return {
    token_address: tokenAddress.toLowerCase(),
    trader: tr.trader.toLowerCase(),
    is_buy: tr.isBuy ? 1 : 0,
    lt_amount: tr.usdcAmount,
    token_amount: tr.tokenAmount,
    curve_supply: "0",
    lt_reserve: "0",
    block_number: Number(tr.blockNumber),
    tx_hash: txHash,
    created_at: ts > 1e12 ? Math.floor(ts / 1000) : ts,
  };
}

export async function ensureTokenInDb(address: string): Promise<boolean> {
  if (getToken(address)) return true;
  return refreshTokenFromApi(address);
}

export type ApiCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ApiChart = {
  candles: ApiCandle[];
  currentRatio?: number;
  currentExchangeRate?: number;
};

export type ApiHolder = {
  wallet: string;
  balance: string;
  percentage: number;
};

export type ApiHoldersPayload = {
  holders: ApiHolder[];
  totalHolders: number;
  approximate: boolean;
};

export type ApiSecurity = {
  lpLocked: boolean;
  lpAmount: string | null;
  creatorHoldingPct: number;
  contractVerified: boolean;
  graduated: boolean;
  poolAddress: string | null;
};

export async function fetchApiSecurity(address: string): Promise<ApiSecurity | null> {
  const res = await fetch(`${ALTFUN_API_BASE}/api/v1/security/${address}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { status: string; data: ApiSecurity };
  if (json.status !== "success" || !json.data) return null;
  return json.data;
}

export async function fetchApiHolders(
  address: string,
  limit = 50,
): Promise<ApiHoldersPayload | null> {
  const capped = Math.min(Math.max(limit, 1), 100);
  const res = await fetch(
    `${ALTFUN_API_BASE}/api/v1/holders/${address}?limit=${capped}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { status: string; data: ApiHoldersPayload };
  if (json.status !== "success" || !json.data?.holders) return null;
  return json.data;
}

export async function fetchApiChart(
  address: string,
  resolution = "1m",
): Promise<ApiChart | null> {
  const res = await fetch(
    `${ALTFUN_API_BASE}/api/v1/chart/${address}?resolution=${encodeURIComponent(resolution)}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { status: string; data: ApiChart };
  if (json.status !== "success" || !json.data?.candles) return null;
  return json.data;
}
