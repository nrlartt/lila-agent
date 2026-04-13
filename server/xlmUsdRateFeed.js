/**
 * XLM/USD notional rate for USD → XLM stroop conversion (not an on-chain oracle).
 * - If `LILA_XLM_USD_RATE` is set: fixed value, no HTTP.
 * - Else if `LILA_XLM_USD_RATE_FETCH=false`: static `DEFAULT_LILA_XLM_USD_RATE`.
 * - Else: poll CoinGecko, fallback Binance; refresh on an interval and optional callback.
 */
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
const BINANCE_URL = "https://api.binance.com/api/v3/ticker/price?symbol=XLMUSDT";

/** Fallback when feed is disabled or HTTP fails before any successful fetch. */
export const DEFAULT_LILA_XLM_USD_RATE = 0.17;

/** @type {{ rate: number, source: string, updatedAt: string | null, lastError: string | null }} */
let cached = {
  rate: DEFAULT_LILA_XLM_USD_RATE,
  source: "default",
  updatedAt: null,
  lastError: null,
};

function clampRate(r) {
  if (!Number.isFinite(r) || r <= 0) return DEFAULT_LILA_XLM_USD_RATE;
  return Math.min(Math.max(r, 0.01), 100);
}

async function fetchCoinGecko() {
  const res = await fetch(COINGECKO_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  const v = data?.stellar?.usd;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    throw new Error("CoinGecko: invalid stellar.usd");
  }
  return v;
}

async function fetchBinance() {
  const res = await fetch(BINANCE_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const data = await res.json();
  const v = parseFloat(data?.price);
  if (!Number.isFinite(v) || v <= 0) throw new Error("Binance: invalid price");
  return v;
}

/**
 * One refresh attempt (no-op if fixed env rate).
 * @returns {Promise<{ changed: boolean, skipped?: boolean }>}
 */
export async function refreshXlmUsdRateOnce() {
  if (process.env.LILA_XLM_USD_RATE?.trim()) {
    return { changed: false, skipped: true };
  }
  if (isFetchDisabled()) {
    return { changed: false, skipped: true };
  }

  const prev = cached.rate;
  try {
    let rate;
    let source;
    try {
      rate = await fetchCoinGecko();
      source = "coingecko";
    } catch (e1) {
      console.warn("[xlmUsdRate] CoinGecko failed, trying Binance:", e1?.message || e1);
      rate = await fetchBinance();
      source = "binance";
    }
    rate = clampRate(rate);
    cached = {
      rate,
      source,
      updatedAt: new Date().toISOString(),
      lastError: null,
    };
    const changed = Math.abs(prev - rate) > 1e-8;
    return { changed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    cached = {
      ...cached,
      lastError: msg,
    };
    console.warn("[xlmUsdRate] refresh failed, keeping previous rate:", msg);
    return { changed: false };
  }
}

function isFetchDisabled() {
  const v = String(process.env.LILA_XLM_USD_RATE_FETCH || "").toLowerCase();
  return v === "0" || v === "false" || v === "off" || v === "disabled";
}

/** USD per 1 XLM for API and x402 `accepts` (sync). */
export function getXlmUsdRateForApi() {
  const fixed = process.env.LILA_XLM_USD_RATE?.trim();
  if (fixed) {
    const r = parseFloat(fixed);
    if (Number.isFinite(r) && r > 0) return r;
  }
  return cached.rate;
}

/** Extra fields for `/api/services` (no secrets). */
export function getXlmUsdRateMeta() {
  const fixed = process.env.LILA_XLM_USD_RATE?.trim();
  if (fixed) {
    return {
      mode: "fixed",
      source: "env",
      updatedAt: null,
      lastError: null,
    };
  }
  if (isFetchDisabled()) {
    return {
      mode: "static_default",
      source: "default",
      updatedAt: null,
      lastError: null,
    };
  }
  return {
    mode: "auto",
    source: cached.source,
    updatedAt: cached.updatedAt,
    lastError: cached.lastError,
  };
}

/** Call once before `setupX402Server()` so the first x402 config uses a live rate when possible. */
export async function initXlmUsdRateFeed() {
  if (process.env.LILA_XLM_USD_RATE?.trim()) {
    const r = parseFloat(process.env.LILA_XLM_USD_RATE);
    if (Number.isFinite(r) && r > 0) {
      cached = { rate: r, source: "env", updatedAt: null, lastError: null };
    }
    console.log("[xlmUsdRate] Fixed rate from LILA_XLM_USD_RATE (no auto-fetch)");
    return;
  }
  if (isFetchDisabled()) {
    cached = {
      rate: DEFAULT_LILA_XLM_USD_RATE,
      source: "default",
      updatedAt: null,
      lastError: null,
    };
    console.log("[xlmUsdRate] LILA_XLM_USD_RATE_FETCH disabled; using default", DEFAULT_LILA_XLM_USD_RATE);
    return;
  }
  await refreshXlmUsdRateOnce();
  console.log(
    `[xlmUsdRate] Initial ${cached.source} rate=${cached.rate} USD/XLM (refresh every ${parseInt(process.env.LILA_XLM_USD_RATE_REFRESH_MS || "300000", 10) / 1000}s)`,
  );
}

/**
 * Periodic refresh; invokes `onRateChange` when the numeric rate changes (e.g. rebuild x402 middleware).
 * No-op when rate is fixed via env or fetch is disabled.
 * @param {() => void | Promise<void>} onRateChange
 */
export function subscribeXlmUsdRateUpdates(onRateChange) {
  if (process.env.LILA_XLM_USD_RATE?.trim()) return;
  if (isFetchDisabled()) return;

  const ms = parseInt(process.env.LILA_XLM_USD_RATE_REFRESH_MS || "300000", 10);
  const intervalMs = Math.max(60_000, ms);

  setInterval(async () => {
    const result = await refreshXlmUsdRateOnce();
    if (result.changed && typeof onRateChange === "function") {
      try {
        await onRateChange();
      } catch (e) {
        console.error("[xlmUsdRate] onRateChange failed:", e);
      }
    }
  }, intervalMs);
}
