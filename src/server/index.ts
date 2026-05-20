import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  countTokens,
  getGlobalStats,
  getRecentTradesGlobal,
  getToken,
  getTrades,
  queryTokens,
  type TokenCategory,
  type TokenRow,
} from "../indexer/db.js";
import {
  apiTradeToRow,
  ensureTokenInDb,
  fetchApiChart,
  fetchApiHolders,
  fetchApiTradesForToken,
  fetchRecentGlobalTrades,
  refreshTokenFromApi,
} from "../indexer/altfun-api.js";
import { setIndexerBroadcast, startLiveIndexer } from "../indexer/sync.js";
import { checkTokenHoneypot } from "../security/honeypot.js";
import { broadcast, createSseResponse } from "./sse.js";
import {
  handlePushForEvent,
  initPushVapid,
  removePushSubscription,
  upsertPushSubscription,
} from "./push.js";
import {
  BOT_RISK_CONSENT_VERSION,
  clientIpFromHeaders,
  getBotRiskConsent,
  hashClientIp,
  recordBotRiskConsent,
} from "./botRiskConsent.js";
import { isAddress } from "viem";

const app = new Hono();
const pushConfig = initPushVapid();

app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

setIndexerBroadcast((event, data) => {
  broadcast(event, data);
  void handlePushForEvent(event, data);
});

function serializeToken(t: TokenRow) {
  return {
    address: t.address,
    name: t.name,
    ticker: t.ticker,
    description: t.description,
    image: t.image,
    urls: [t.url0, t.url1, t.url2].filter(Boolean),
    creator: t.creator,
    ltAddress: t.lt_address,
    pair: t.pair,
    lifecycle: t.lifecycle,
    k: t.k,
    launchedAt: t.launched_at,
    launchedBlock: t.launched_block,
    launchedTx: t.launched_tx,
    graduatedPair: t.graduated_pair,
    reserves: { token: t.reserve_token, lt: t.reserve_lt },
    ltBufferUsdc: t.lt_buffer_usdc,
    exchangeRate: t.exchange_rate,
    canGraduate: t.can_graduate === 1,
    tradeCount: t.trade_count,
    volumeLt: t.volume_lt,
    volumeUsd24h: t.volume_usd_24h,
    volumeUsdTotal: t.volume_usd_total,
    mcapUsd: t.mcap_usd,
    priceUsd: t.price_usd,
    change24h: t.change_24h,
    lastTradeAt: t.last_trade_at,
    curveFilledPct: t.curve_filled_pct ?? 0,
    curveRaisedUsd: t.curve_raised_usd ?? 0,
    updatedAt: t.updated_at,
    altFunUrl: `https://alt.fun/token/${t.address}`,
  };
}

app.get("/api/health", (c) =>
  c.json({ ok: true, service: "lila-agent", chainId: 999 }),
);

const CATEGORIES: TokenCategory[] = [
  "all",
  "new",
  "curve",
  "graduating",
  "graduated",
  "trending",
  "volume",
  "grad_ready",
  "active",
];

app.get("/api/stats", (c) => c.json(getGlobalStats()));

app.get("/api/trades", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 30), 1), 80);

  type TradeDto = {
    id: string;
    token: string;
    ticker: string;
    name: string;
    trader: string;
    isBuy: boolean;
    usdcAmount: string;
    createdAt: number;
    txHash: string;
    source: "altfun" | "chain";
  };

  const mapLocal = (): TradeDto[] =>
    getRecentTradesGlobal(limit).map((tr) => ({
      id: `chain-${tr.id}`,
      token: tr.token_address.toLowerCase(),
      ticker: tr.ticker ?? "???",
      name: tr.name ?? tr.token_address.slice(0, 10),
      trader: tr.trader.toLowerCase(),
      isBuy: tr.is_buy === 1,
      usdcAmount: tr.lt_amount,
      createdAt: tr.created_at,
      txHash: tr.tx_hash,
      source: "chain" as const,
    }));

  try {
    const apiTrades = await fetchRecentGlobalTrades(limit);
    if (apiTrades.length === 0) {
      return c.json({ trades: mapLocal() });
    }

    const trades = await Promise.all(
      apiTrades.map(async (tr) => {
        await ensureTokenInDb(tr.tokenAddress).catch(() => {});
        const token = getToken(tr.tokenAddress);
        const row = apiTradeToRow(tr, tr.tokenAddress);
        return {
          id: tr.id,
          token: tr.tokenAddress.toLowerCase(),
          ticker: token?.ticker ?? "???",
          name: token?.name ?? tr.tokenAddress.slice(0, 10),
          trader: tr.trader.toLowerCase(),
          isBuy: tr.isBuy,
          usdcAmount: tr.usdcAmount,
          createdAt: row.created_at,
          txHash: row.tx_hash,
          source: "altfun" as const,
        };
      }),
    );
    return c.json({ trades });
  } catch {
    return c.json({ trades: mapLocal() });
  }
});

app.get("/api/tokens", (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);
  const search = c.req.query("search")?.trim();
  const rawCategory = c.req.query("category") ?? "all";
  const category = CATEGORIES.includes(rawCategory as TokenCategory)
    ? (rawCategory as TokenCategory)
    : "all";
  const lifecycle = c.req.query("lifecycle") as
    | "curve"
    | "graduating"
    | "graduated"
    | undefined;

  const query = { category, lifecycle, search, limit, offset };
  const tokens = queryTokens(query).map(serializeToken);
  const total = countTokens({ category, lifecycle, search });

  return c.json({
    tokens,
    total,
    offset,
    limit,
    category,
    hasMore: offset + tokens.length < total,
  });
});

app.get("/api/tokens/:address/holders", async (c) => {
  const address = c.req.param("address");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const data = await fetchApiHolders(address, limit);
  if (!data) return c.json({ error: "Holders not available" }, 404);
  return c.json(
    {
      holders: data.holders.map((h) => ({
        wallet: h.wallet.toLowerCase(),
        balance: h.balance,
        percentage: h.percentage,
      })),
      totalHolders: data.totalHolders,
      approximate: data.approximate,
    },
    200,
    { "Cache-Control": "no-store" },
  );
});

app.get("/api/tokens/:address/honeypot", async (c) => {
  const address = c.req.param("address");
  try {
    const honeypot = await checkTokenHoneypot(address);
    return c.json({ honeypot }, 200, {
      "Cache-Control": "public, max-age=120",
    });
  } catch (err) {
    console.error("Honeypot check failed:", (err as Error).message);
    return c.json({ error: "Honeypot check failed" }, 500);
  }
});

app.get("/api/tokens/:address/chart", async (c) => {
  const address = c.req.param("address");
  const resolution = c.req.query("resolution") ?? "1m";
  const chart = await fetchApiChart(address, resolution);
  if (!chart) return c.json({ error: "Chart not available" }, 404);
  return c.json(
    { chart, resolution, fetchedAt: Math.floor(Date.now() / 1000) },
    200,
    { "Cache-Control": "no-store" },
  );
});

app.get("/api/tokens/:address", async (c) => {
  const address = c.req.param("address");
  await ensureTokenInDb(address);
  await refreshTokenFromApi(address).catch(() => {});

  const token = getToken(address);
  if (!token) return c.json({ error: "Token not found" }, 404);

  type TradeDto = {
    id: number;
    trader: string;
    isBuy: boolean;
    usdcAmount: string;
    tokenAmount: string;
    ltAmount: string;
    curveSupply: string;
    ltReserve: string;
    blockNumber: number;
    txHash: string;
    createdAt: number;
    source: "chain" | "altfun";
  };

  let trades: TradeDto[] = getTrades(token.address, 40).map((tr) => ({
    id: tr.id,
    trader: tr.trader,
    isBuy: tr.is_buy === 1,
    usdcAmount: tr.lt_amount,
    tokenAmount: tr.token_amount,
    ltAmount: tr.lt_amount,
    curveSupply: tr.curve_supply,
    ltReserve: tr.lt_reserve,
    blockNumber: tr.block_number,
    txHash: tr.tx_hash,
    createdAt: tr.created_at,
    source: "chain" as const,
  }));

  if (trades.length === 0) {
    try {
      const apiTrades = await fetchApiTradesForToken(token.address, 40);
      trades = apiTrades.map((tr, i) => {
        const row = apiTradeToRow(tr, token.address);
        return {
          id: i + 1,
          trader: row.trader,
          isBuy: row.is_buy === 1,
          usdcAmount: row.lt_amount,
          tokenAmount: row.token_amount,
          ltAmount: row.lt_amount,
          curveSupply: row.curve_supply,
          ltReserve: row.lt_reserve,
          blockNumber: row.block_number,
          txHash: row.tx_hash,
          createdAt: row.created_at,
          source: "altfun" as const,
        };
      });
    } catch {
      // tape optional
    }
  }

  let honeypot = null;
  try {
    honeypot = await Promise.race([
      checkTokenHoneypot(token.address),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]);
  } catch {
    // optional safety check
  }

  return c.json({
    token: serializeToken(token),
    trades,
    honeypot,
  });
});

app.get("/api/stream", () => createSseResponse());

app.get("/api/bot/risk-consent", (c) => {
  const wallet = c.req.query("wallet")?.trim() ?? "";
  const version = c.req.query("version")?.trim() || BOT_RISK_CONSENT_VERSION;
  if (!isAddress(wallet)) {
    return c.json({ ok: false, error: "Invalid wallet address" }, 400);
  }
  const record = getBotRiskConsent(wallet, version);
  return c.json({
    ok: true,
    accepted: record !== null,
    currentVersion: BOT_RISK_CONSENT_VERSION,
    record,
  });
});

app.post("/api/bot/risk-consent", async (c) => {
  const body = await c.req.json<{
    wallet?: string;
    accepted?: boolean;
    consentVersion?: string;
  }>();

  const wallet = body.wallet?.trim() ?? "";
  const version = body.consentVersion?.trim() || BOT_RISK_CONSENT_VERSION;

  if (!isAddress(wallet)) {
    return c.json({ ok: false, error: "Invalid wallet address" }, 400);
  }
  if (body.accepted !== true) {
    return c.json({ ok: false, error: "accepted must be true" }, 400);
  }

  const ip = clientIpFromHeaders(c.req.raw.headers);
  const record = recordBotRiskConsent({
    wallet,
    version,
    userAgent: c.req.header("user-agent") ?? "",
    ipHash: ip ? hashClientIp(ip) : "",
  });

  return c.json({ ok: true, record });
});

app.get("/api/push/config", (c) =>
  c.json({
    enabled: pushConfig.enabled,
    publicKey: pushConfig.publicKey,
  }),
);

app.post("/api/push/subscribe", async (c) => {
  if (!pushConfig.enabled) {
    return c.json({ ok: false, error: "Push not configured on server" }, 503);
  }
  const body = await c.req.json<{
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    wallet?: string;
    watchTokens?: string[];
    prefs?: {
      watchTrades?: boolean;
      gradReady?: boolean;
      priceChangePct?: number | null;
    };
  }>();

  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return c.json({ ok: false, error: "Invalid subscription" }, 400);
  }

  upsertPushSubscription({
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    wallet: body.wallet,
    watchTokens: body.watchTokens ?? [],
    prefs: {
      watchTrades: body.prefs?.watchTrades !== false,
      gradReady: body.prefs?.gradReady !== false,
      priceChangePct: body.prefs?.priceChangePct ?? null,
    },
  });

  return c.json({ ok: true });
});

app.post("/api/push/unsubscribe", async (c) => {
  const body = await c.req.json<{ endpoint?: string }>();
  if (body.endpoint) removePushSubscription(body.endpoint);
  return c.json({ ok: true });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.join(__dirname, "../../web/dist");

app.get("*", async (c, next) => {
  if (c.req.path.startsWith("/api")) return next();
  try {
    const { readFile } = await import("node:fs/promises");
    const reqPath = c.req.path === "/" ? "/index.html" : c.req.path;
    const filePath = path.extname(reqPath) ? reqPath : "/index.html";
    const data = await readFile(path.join(webDist, filePath));
    const type = filePath.endsWith(".js")
      ? "application/javascript"
      : filePath.endsWith(".css")
        ? "text/css"
        : "text/html";
    return c.body(data, 200, { "Content-Type": type });
  } catch {
    return c.notFound();
  }
});

const port = Number(process.env.PORT ?? 3000);

console.log(`API → http://localhost:${port}`);
serve({ fetch: app.fetch, port });

function runIndexer() {
  startLiveIndexer().catch((err) => {
    console.error("Indexer error (will retry in 30s):", (err as Error).message);
    setTimeout(runIndexer, 30_000);
  });
}

runIndexer();
