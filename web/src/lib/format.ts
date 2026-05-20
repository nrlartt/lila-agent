export function shortAddress(addr: string, head = 6, tail = 4): string {
  if (addr.length < head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function formatPriceUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n) || n === 0) return "—";
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function formatTokenFromRaw(raw: string | null, decimals = 18): string {
  if (!raw) return "—";
  try {
    const v = BigInt(raw);
    const scale = 10n ** BigInt(decimals);
    const whole = v / scale;
    const frac = v % scale;
    const num = Number(whole) + Number(frac) / Number(scale);
    if (!Number.isFinite(num) || num === 0) return "0";
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    if (num >= 1) {
      return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return num.toFixed(4);
  } catch {
    return "—";
  }
}

export function formatUsdcFromRaw(raw: string | null, decimals = 6): string {
  if (!raw) return "—";
  const n = Number(raw) / 10 ** decimals;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function timeAgo(ts: number): string {
  const sec = Math.floor(Date.now() / 1000 - ts);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const MEDIA_BASE =
  (import.meta.env.VITE_MEDIA_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://api.alt.fun";

/** Resolve on-chain metadata image paths to alt.fun CDN URLs. */
export function resolveTokenImage(image: string): string | null {
  const trimmed = image?.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("ipfs://")) {
    const cid = trimmed.slice(7);
    return `https://ipfs.io/ipfs/${cid}`;
  }

  if (trimmed.startsWith("/")) {
    return `${MEDIA_BASE}${trimmed}`;
  }

  return `${MEDIA_BASE}/${trimmed}`;
}