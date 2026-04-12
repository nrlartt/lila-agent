/**
 * Live crypto quotes (CoinGecko public API, no key).
 * Used so /analyze does not hallucinate prices and volumes.
 */

const COINGECKO_SIMPLE = "https://api.coingecko.com/api/v3/simple/price";

/** Order matters: first match wins */
const COIN_PATTERNS = [
  [/\b(btc|bitcoin)\b/i, "bitcoin"],
  [/\b(eth|ethereum)\b/i, "ethereum"],
  [/\b(xlm|stellar|lumens?)\b/i, "stellar"],
  [/\b(sol|solana)\b/i, "solana"],
  [/\b(xrp|ripple)\b/i, "ripple"],
  [/\b(doge|dogecoin)\b/i, "dogecoin"],
  [/\b(ada|cardano)\b/i, "cardano"],
  [/\b(dot|polkadot)\b/i, "polkadot"],
  [/\b(avax|avalanche)\b/i, "avalanche-2"],
  [/\b(matic|polygon)\b/i, "matic-network"],
];

/**
 * @param {string} userInput
 * @returns {string | null} CoinGecko coin id
 */
export function detectCoinId(userInput) {
  const s = String(userInput || "");
  for (const [re, id] of COIN_PATTERNS) {
    if (re.test(s)) return id;
  }
  return null;
}

function formatUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number(n) < 1 ? 4 : 2,
  }).format(Number(n));
}

function formatUsdCompact(n) {
  if (n == null || Number.isNaN(Number(n))) return "n/a";
  const x = Number(n);
  if (x >= 1e12) return `$${(x / 1e12).toFixed(2)}T`;
  if (x >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (x >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  if (x >= 1e3) return `$${(x / 1e3).toFixed(2)}K`;
  return formatUsd(x);
}

/**
 * @param {string} coinId - e.g. "bitcoin"
 * @returns {Promise<object | null>}
 */
export async function fetchCoinGeckoSnapshot(coinId) {
  const url = new URL(COINGECKO_SIMPLE);
  url.searchParams.set("ids", coinId);
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("include_24hr_vol", "true");
  url.searchParams.set("include_24hr_change", "true");
  url.searchParams.set("include_market_cap", "true");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    console.warn(`[marketData] CoinGecko HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  const row = data[coinId];
  if (!row || row.usd == null) return null;

  return {
    coinId,
    displayName: coinId.replace(/-/g, " "),
    priceUsd: row.usd,
    marketCapUsd: row.usd_market_cap,
    vol24hUsd: row.usd_24h_vol,
    change24hPct: row.usd_24h_change,
  };
}

/**
 * Text block injected into the LLM prompt for /analyze.
 */
export async function buildAnalyzeMarketContext(userInput) {
  const coinId = detectCoinId(userInput);
  const iso = new Date().toISOString();

  if (!coinId) {
    return `
[LIVE DATA]
No specific asset matched for live pricing (try naming BTC, ETH, SOL, XLM, etc.).

[STRICT RULES]
- Do NOT invent prices, RSI, MACD, moving averages, volumes, or trade targets.
- Give thematic / educational commentary only, or ask which symbol to analyze.
`;
  }

  const snap = await fetchCoinGeckoSnapshot(coinId).catch((e) => {
    console.warn("[marketData] fetch failed:", e.message);
    return null;
  });

  if (!snap) {
    return `
[LIVE DATA]
Could not fetch live data for "${coinId}" right now.

[STRICT RULES]
- Do NOT invent prices, RSI, MACD, moving averages, volumes, or trade targets.
- Explain that live figures are unavailable and give non-numeric risk/education only.
`;
  }

  const ch =
    snap.change24hPct != null && !Number.isNaN(snap.change24hPct)
      ? `${Number(snap.change24hPct).toFixed(2)}%`
      : "n/a";

  return `
[LIVE DATA — CoinGecko — ONLY use these numbers for price / mcap / volume / 24h change]
- Asset (CoinGecko id): ${snap.coinId}
- Spot price (USD): ${formatUsd(snap.priceUsd)}
- 24h change: ${ch}
- 24h volume (USD, raw): ${formatUsdCompact(snap.vol24hUsd)}
- Market cap (USD, raw): ${formatUsdCompact(snap.marketCapUsd)}
- Fetched at (UTC): ${iso}

[STRICT RULES]
- Base ALL numeric claims about price, mcap, volume, and 24h change ONLY on the block above.
- Do NOT invent RSI, MACD, moving averages, support/resistance, or "target/stop" prices. Say "Not available from live feed" for technical indicators unless you have a separate real data source (you do not).
- Frame any narrative as informational, not financial advice.
`;
}
