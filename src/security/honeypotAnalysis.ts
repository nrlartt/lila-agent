import type { Address } from "viem";
import type { ApiHolder, ApiHoldersPayload, ApiSecurity } from "../indexer/altfun-api.js";
import type { TokenRow } from "../indexer/db.js";

export type SignalStatus = "pass" | "warn" | "fail" | "unknown";

export type AnalysisSignal = {
  id: string;
  label: string;
  status: SignalStatus;
  detail: string;
};

export type AnalysisLayer = {
  score: number;
  signals: AnalysisSignal[];
  summary: string;
};

export type SocialLinks = {
  twitter: string | null;
  telegram: string | null;
  website: string | null;
};

export type CreatorOnChain = {
  txCount: number | null;
  launchCount: number | null;
};

const SIGNAL_WEIGHT: Record<SignalStatus, number> = {
  pass: 100,
  warn: 55,
  fail: 10,
  unknown: 45,
};

export function scoreFromSignals(signals: AnalysisSignal[]): number {
  if (signals.length === 0) return 0;
  const total = signals.reduce((sum, s) => sum + SIGNAL_WEIGHT[s.status], 0);
  return Math.round(total / signals.length);
}

function signal(
  id: string,
  label: string,
  status: SignalStatus,
  detail: string,
): AnalysisSignal {
  return { id, label, status, detail };
}

function layerSummary(signals: AnalysisSignal[], fallback: string): string {
  const fails = signals.filter((s) => s.status === "fail");
  if (fails.length > 0) return fails[0]!.detail;
  const warns = signals.filter((s) => s.status === "warn");
  if (warns.length > 0) return warns[0]!.detail;
  const passes = signals.filter((s) => s.status === "pass");
  if (passes.length > 0) return passes[0]!.detail;
  return fallback;
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(t\.me|telegram\.me|twitter\.com|x\.com)\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  if (trimmed.startsWith("@")) {
    return `https://x.com/${trimmed.slice(1)}`;
  }
  return `https://${trimmed}`;
}

function classifyUrl(raw: string): keyof SocialLinks | null {
  const lower = raw.toLowerCase();
  if (
    lower.includes("twitter.com") ||
    lower.includes("x.com") ||
    raw.trim().startsWith("@")
  ) {
    return "twitter";
  }
  if (lower.includes("t.me") || lower.includes("telegram")) return "telegram";
  return "website";
}

export function extractSocialLinks(token: TokenRow | null | undefined): SocialLinks {
  const links: SocialLinks = { twitter: null, telegram: null, website: null };
  if (!token) return links;

  for (const raw of [token.url0, token.url1, token.url2]) {
    if (!raw?.trim()) continue;
    const normalized = normalizeUrl(raw);
    if (!normalized) continue;
    const kind = classifyUrl(normalized);
    if (kind && !links[kind]) links[kind] = normalized;
  }
  return links;
}

export function buildTokenCaAnalysis(input: {
  security: ApiSecurity | null;
  holders: ApiHoldersPayload | null;
  canSell: boolean | null;
  recentSellCount: number;
  buyFeeBps: number;
  sellFeeBps: number;
  lifecycle: string;
  tokenRow: TokenRow | null;
}): AnalysisLayer {
  const signals: AnalysisSignal[] = [];
  const { security, holders, canSell, recentSellCount, buyFeeBps, sellFeeBps, lifecycle, tokenRow } =
    input;

  if (security?.contractVerified) {
    signals.push(signal("contract", "Contract verified", "pass", "Source verified on alt.fun"));
  } else if (security) {
    signals.push(
      signal("contract", "Contract verified", "warn", "Bytecode not verified on alt.fun"),
    );
  } else {
    signals.push(signal("contract", "Contract verified", "unknown", "Verification data unavailable"));
  }

  if (lifecycle === "graduated") {
    if (security?.lpLocked) {
      signals.push(signal("lp", "LP locked", "pass", "Liquidity pool is locked"));
    } else if (security) {
      signals.push(signal("lp", "LP locked", "fail", "Graduated token — LP not locked"));
    } else {
      signals.push(signal("lp", "LP locked", "unknown", "LP lock status unavailable"));
    }
  } else {
    signals.push(
      signal("lp", "Bonding curve", "pass", "Pre-graduation — curve liquidity via alt.fun"),
    );
  }

  if (canSell === false) {
    signals.push(signal("sell", "Sell path", "fail", "Sell simulation reverted"));
  } else if (recentSellCount > 0) {
    signals.push(
      signal("sell", "Sell path", "pass", `${recentSellCount} recent sell(s) on tape`),
    );
  } else if (canSell === true) {
    signals.push(signal("sell", "Sell path", "pass", "Zap sell simulates successfully"));
  } else {
    signals.push(
      signal("sell", "Sell path", "unknown", "No recent sells — path not confirmed"),
    );
  }

  const buyPct = buyFeeBps / 100;
  const sellPct = sellFeeBps / 100;
  if (buyFeeBps > 500 || sellFeeBps > 500) {
    signals.push(
      signal("fees", "Trading fees", "warn", `Buy ${buyPct.toFixed(1)}% · Sell ${sellPct.toFixed(1)}%`),
    );
  } else {
    signals.push(
      signal("fees", "Trading fees", "pass", `Buy ${buyPct.toFixed(1)}% · Sell ${sellPct.toFixed(1)}%`),
    );
  }

  const topHolders = holders?.holders ?? [];
  const top1 = topHolders[0]?.percentage ?? null;
  const top5 = topHolders.slice(0, 5).reduce((sum, h) => sum + (h.percentage ?? 0), 0);

  if (top1 != null && top1 >= 40) {
    signals.push(
      signal("concentration", "Holder concentration", "warn", `Top holder ${top1.toFixed(1)}%`),
    );
  } else if (top5 >= 70) {
    signals.push(
      signal("concentration", "Holder concentration", "warn", `Top 5 hold ${top5.toFixed(1)}%`),
    );
  } else if (top1 != null) {
    signals.push(
      signal("concentration", "Holder concentration", "pass", `Top holder ${top1.toFixed(1)}%`),
    );
  } else {
    signals.push(
      signal("concentration", "Holder concentration", "unknown", "Holder distribution unavailable"),
    );
  }

  const totalHolders = holders?.totalHolders ?? null;
  if (totalHolders != null && totalHolders >= 20) {
    signals.push(
      signal("holders", "Holder count", "pass", `${totalHolders.toLocaleString()} holders tracked`),
    );
  } else if (totalHolders != null && totalHolders >= 5) {
    signals.push(
      signal("holders", "Holder count", "warn", `Only ${totalHolders} holders tracked`),
    );
  } else if (totalHolders != null) {
    signals.push(
      signal("holders", "Holder count", "warn", `Very few holders (${totalHolders})`),
    );
  } else {
    signals.push(signal("holders", "Holder count", "unknown", "Holder count unavailable"));
  }

  const ageSec = tokenRow?.launched_at ? Math.floor(Date.now() / 1000) - tokenRow.launched_at : null;
  if (ageSec != null && ageSec < 3600) {
    signals.push(signal("age", "Token age", "warn", "Launched less than 1 hour ago"));
  } else if (ageSec != null && ageSec < 86400) {
    signals.push(signal("age", "Token age", "warn", "Launched within 24 hours"));
  } else if (ageSec != null) {
    signals.push(signal("age", "Token age", "pass", formatAge(ageSec)));
  } else {
    signals.push(signal("age", "Token age", "unknown", "Launch time unknown"));
  }

  const trades = tokenRow?.trade_count ?? 0;
  if (trades >= 10) {
    signals.push(signal("activity", "Trade activity", "pass", `${trades} on-chain trades indexed`));
  } else if (trades > 0) {
    signals.push(signal("activity", "Trade activity", "warn", `Low activity (${trades} trades)`));
  } else {
    signals.push(signal("activity", "Trade activity", "warn", "No indexed trades yet"));
  }

  return {
    score: scoreFromSignals(signals),
    signals,
    summary: layerSummary(signals, "On-chain contract checks"),
  };
}

export function buildCreatorAnalysis(input: {
  creator: string | null;
  security: ApiSecurity | null;
  holders: ApiHolder[];
  onChain: CreatorOnChain;
}): AnalysisLayer {
  const signals: AnalysisSignal[] = [];
  const { creator, security, holders, onChain } = input;

  if (!creator) {
    signals.push(signal("creator", "Creator wallet", "unknown", "Creator address unavailable"));
  } else {
    signals.push(
      signal("creator", "Creator wallet", "pass", `${creator.slice(0, 6)}…${creator.slice(-4)}`),
    );
  }

  const holding = security?.creatorHoldingPct ?? null;
  if (holding != null && holding >= 50) {
    signals.push(
      signal("holding", "Creator holdings", "fail", `Creator holds ${holding.toFixed(1)}% of supply`),
    );
  } else if (holding != null && holding >= 25) {
    signals.push(
      signal("holding", "Creator holdings", "warn", `Creator holds ${holding.toFixed(1)}% of supply`),
    );
  } else if (holding != null) {
    signals.push(
      signal("holding", "Creator holdings", "pass", `Creator holds ${holding.toFixed(1)}% of supply`),
    );
  } else {
    signals.push(signal("holding", "Creator holdings", "unknown", "Creator balance unavailable"));
  }

  if (creator && holders.some((h) => h.wallet.toLowerCase() === creator.toLowerCase())) {
    const pct =
      holders.find((h) => h.wallet.toLowerCase() === creator.toLowerCase())?.percentage ?? 0;
    if (pct >= 25) {
      signals.push(
        signal("top_holder", "Creator in top holders", "warn", `Creator is a top holder (${pct.toFixed(1)}%)`),
      );
    } else {
      signals.push(signal("top_holder", "Creator in top holders", "pass", "Creator not dominating supply"));
    }
  } else if (creator) {
    signals.push(
      signal("top_holder", "Creator in top holders", "pass", "Creator not in top holder list"),
    );
  }

  if (onChain.txCount != null && onChain.txCount >= 20) {
    signals.push(
      signal("wallet_age", "Wallet activity", "pass", `${onChain.txCount.toLocaleString()} on-chain txs`),
    );
  } else if (onChain.txCount != null && onChain.txCount >= 3) {
    signals.push(
      signal("wallet_age", "Wallet activity", "warn", `Low wallet activity (${onChain.txCount} txs)`),
    );
  } else if (onChain.txCount != null) {
    signals.push(
      signal("wallet_age", "Wallet activity", "warn", "Fresh wallet — very few transactions"),
    );
  } else {
    signals.push(signal("wallet_age", "Wallet activity", "unknown", "Could not read wallet activity"));
  }

  if (onChain.launchCount != null && onChain.launchCount >= 5) {
    signals.push(
      signal("launches", "Prior launches", "warn", `${onChain.launchCount} tokens from this creator indexed`),
    );
  } else if (onChain.launchCount != null && onChain.launchCount > 1) {
    signals.push(
      signal("launches", "Prior launches", "pass", `${onChain.launchCount} tokens from this creator`),
    );
  } else if (onChain.launchCount === 1) {
    signals.push(signal("launches", "Prior launches", "pass", "First indexed launch from creator"));
  } else {
    signals.push(signal("launches", "Prior launches", "unknown", "Launch history unavailable"));
  }

  return {
    score: scoreFromSignals(signals),
    signals,
    summary: layerSummary(signals, "Creator wallet analysis"),
  };
}

export function buildSocialAnalysis(links: SocialLinks): AnalysisLayer {
  const signals: AnalysisSignal[] = [];

  if (links.twitter) {
    signals.push(signal("twitter", "Twitter / X", "pass", displayHost(links.twitter)));
  } else {
    signals.push(signal("twitter", "Twitter / X", "warn", "No Twitter link on token profile"));
  }

  if (links.telegram) {
    signals.push(signal("telegram", "Telegram", "pass", displayHost(links.telegram)));
  } else {
    signals.push(signal("telegram", "Telegram", "warn", "No Telegram community link"));
  }

  if (links.website) {
    const valid = isLikelyValidUrl(links.website);
    signals.push(
      signal(
        "website",
        "Website",
        valid ? "pass" : "warn",
        valid ? displayHost(links.website) : "Website URL looks malformed",
      ),
    );
  } else {
    signals.push(signal("website", "Website", "warn", "No project website listed"));
  }

  const present = [links.twitter, links.telegram, links.website].filter(Boolean).length;
  if (present >= 2) {
    signals.push(
      signal("presence", "Social presence", "pass", `${present}/3 social channels linked`),
    );
  } else if (present === 1) {
    signals.push(
      signal("presence", "Social presence", "warn", "Only one social channel linked"),
    );
  } else {
    signals.push(
      signal("presence", "Social presence", "fail", "No social links — anonymous launch"),
    );
  }

  return {
    score: scoreFromSignals(signals),
    signals,
    summary: layerSummary(signals, "Social footprint"),
  };
}

export function computeOverallScore(layers: {
  token: AnalysisLayer;
  creator: AnalysisLayer;
  social: AnalysisLayer;
}): number {
  const weighted =
    layers.token.score * 0.5 + layers.creator.score * 0.3 + layers.social.score * 0.2;
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

export function scoreToStatus(
  score: number,
  canSell: boolean | null,
  hardFails: boolean,
): "clear" | "caution" | "risk" | "unknown" {
  if (hardFails || canSell === false) return "risk";
  if (canSell === null && score < 50) return "unknown";
  if (score >= 75) return "clear";
  if (score >= 50) return "caution";
  return "risk";
}

function formatAge(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `Live for ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `Live for ${hours} hour${hours === 1 ? "" : "s"}`;
  return "Recently launched";
}

function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

function isLikelyValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchCreatorOnChain(
  creator: string | null,
  launchCount: number | null,
  getTxCount: (address: Address) => Promise<number>,
): Promise<CreatorOnChain> {
  if (!creator) return { txCount: null, launchCount };
  try {
    const txCount = await getTxCount(creator as Address);
    return { txCount, launchCount };
  } catch {
    return { txCount: null, launchCount };
  }
}
