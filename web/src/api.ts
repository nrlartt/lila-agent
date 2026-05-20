export type Token = {
  address: string;
  name: string;
  ticker: string;
  description: string;
  image: string;
  urls: string[];
  creator: string;
  ltAddress: string;
  pair: string;
  lifecycle: "curve" | "graduating" | "graduated";
  launchedAt: number;
  reserves: { token: string | null; lt: string | null };
  ltBufferUsdc: string | null;
  exchangeRate: string | null;
  canGraduate: boolean;
  tradeCount: number;
  volumeLt: string;
  volumeUsd24h: number;
  volumeUsdTotal: number;
  mcapUsd: number;
  priceUsd: number;
  change24h: number | null;
  lastTradeAt: number;
  curveFilledPct: number;
  curveRaisedUsd: number;
  altFunUrl: string;
};

export type ChartResolution = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type ChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type TokenChart = {
  candles: ChartCandle[];
  currentRatio?: number;
  currentExchangeRate?: number;
};

export type Holder = {
  wallet: string;
  balance: string;
  percentage: number;
};

export type HoldersResponse = {
  holders: Holder[];
  totalHolders: number;
  approximate: boolean;
};

export type HoneypotStatus = "clear" | "caution" | "risk" | "unknown";

export type HoneypotCheck = {
  status: HoneypotStatus;
  isHoneypot: boolean;
  canSell: boolean | null;
  buyFeeBps: number;
  sellFeeBps: number;
  creatorHoldingPct: number | null;
  contractVerified: boolean | null;
  lpLocked: boolean | null;
  recentSellCount: number;
  flags: string[];
  summary: string;
  checkedAt: number;
};

export type GlobalTrade = {
  id: string;
  token: string;
  ticker: string;
  name: string;
  trader: string;
  isBuy: boolean;
  usdcAmount: string;
  createdAt: number;
  txHash?: string;
};

export type TradesResponse = {
  trades: GlobalTrade[];
};

export type Trade = {
  id: number;
  trader: string;
  isBuy: boolean;
  usdcAmount?: string;
  ltAmount: string;
  tokenAmount: string;
  txHash: string;
  createdAt: number;
  source?: "chain" | "altfun";
};

export type TokenCategory =
  | "all"
  | "new"
  | "curve"
  | "graduating"
  | "graduated"
  | "trending"
  | "volume"
  | "grad_ready"
  | "active";

export type GlobalStats = {
  total: number;
  curve: number;
  graduating: number;
  graduated: number;
  new24h: number;
  gradReady: number;
  active: number;
  trades24h: number;
  launchBackfillComplete: boolean;
  launchScanBlock?: string;
  eventsBlock?: string;
  catalogSyncAt?: string;
  catalogSyncCount?: number;
};

export type TokensResponse = {
  tokens: Token[];
  total: number;
  offset: number;
  limit: number;
  category: TokenCategory;
  hasMore: boolean;
};

const API = import.meta.env.VITE_API_URL || "";

export async function fetchRecentTrades(limit = 30): Promise<TradesResponse> {
  const res = await fetch(`${API}/api/trades?limit=${limit}`);
  if (!res.ok) return { trades: [] };
  return res.json();
}

export async function fetchStats(): Promise<GlobalStats> {
  const res = await fetch(`${API}/api/stats`);
  return res.json();
}

export async function fetchTokens(opts: {
  category?: TokenCategory;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<TokensResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(opts.limit ?? 50));
  params.set("offset", String(opts.offset ?? 0));
  if (opts.category && opts.category !== "all") {
    params.set("category", opts.category);
  }
  if (opts.search?.trim()) params.set("search", opts.search.trim());

  const res = await fetch(`${API}/api/tokens?${params}`);
  return res.json();
}

export async function fetchToken(address: string): Promise<{
  token: Token;
  trades: Trade[];
  honeypot: HoneypotCheck | null;
}> {
  const res = await fetch(`${API}/api/tokens/${address}`);
  if (!res.ok) throw new Error("Token not found");
  return res.json();
}

export async function fetchTokenHoneypot(address: string): Promise<HoneypotCheck> {
  const res = await fetch(`${API}/api/tokens/${address}/honeypot`);
  if (!res.ok) throw new Error("Honeypot check failed");
  const json = (await res.json()) as { honeypot: HoneypotCheck };
  return json.honeypot;
}

export async function fetchTokenHolders(
  address: string,
  limit = 50,
): Promise<HoldersResponse> {
  const res = await fetch(
    `${API}/api/tokens/${address}/holders?limit=${encodeURIComponent(String(limit))}`,
  );
  if (!res.ok) throw new Error("Holders not available");
  return res.json();
}

export async function fetchTokenChart(
  address: string,
  resolution: ChartResolution = "1m",
): Promise<{ chart: TokenChart; resolution: string }> {
  const res = await fetch(
    `${API}/api/tokens/${address}/chart?resolution=${encodeURIComponent(resolution)}`,
  );
  if (!res.ok) throw new Error("Chart not available");
  return res.json();
}

export type TradeEvent = {
  token: string;
  isBuy: boolean;
  at?: number;
};

export type TokenUpdatedEvent = {
  address: string;
};

export type TokenLaunchedEvent = {
  address: string;
};

export type BotRiskConsentRecord = {
  wallet: string;
  acceptedAt: number;
  consentVersion: string;
};

export async function fetchBotRiskConsent(
  wallet: string,
  version?: string,
): Promise<{
  ok: boolean;
  accepted: boolean;
  currentVersion: string;
  record: BotRiskConsentRecord | null;
}> {
  const params = new URLSearchParams({ wallet });
  if (version) params.set("version", version);
  const res = await fetch(`${API}/api/bot/risk-consent?${params}`);
  if (!res.ok) throw new Error("Failed to check risk consent");
  return res.json();
}

export async function submitBotRiskConsent(opts: {
  wallet: string;
  consentVersion: string;
}): Promise<{ ok: boolean; record: BotRiskConsentRecord }> {
  const res = await fetch(`${API}/api/bot/risk-consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: opts.wallet,
      accepted: true,
      consentVersion: opts.consentVersion,
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to record consent");
  }
  return res.json();
}

export function subscribeEvents(onEvent: (type: string, data: unknown) => void) {
  const es = new EventSource(`${API}/api/stream`);
  es.addEventListener("token_launched", (e) => onEvent("token_launched", JSON.parse(e.data)));
  es.addEventListener("trade", (e) => onEvent("trade", JSON.parse(e.data)));
  es.addEventListener("token_updated", (e) => onEvent("token_updated", JSON.parse(e.data)));
  es.addEventListener("token_graduating", (e) => onEvent("token_graduating", JSON.parse(e.data)));
  es.addEventListener("token_graduated", (e) => onEvent("token_graduated", JSON.parse(e.data)));
  return () => es.close();
}
