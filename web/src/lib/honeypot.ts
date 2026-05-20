import type { AnalysisLayer, AnalysisSignal, HoneypotCheck } from "../api";

const EMPTY_LAYER: AnalysisLayer = {
  score: 0,
  summary: "Analysis unavailable",
  signals: [],
};

const EMPTY_SOCIAL = {
  twitter: null,
  telegram: null,
  website: null,
};

function normalizeLayer(raw: unknown): AnalysisLayer {
  if (!raw || typeof raw !== "object") return EMPTY_LAYER;
  const layer = raw as Partial<AnalysisLayer>;
  const signals = Array.isArray(layer.signals)
    ? layer.signals
        .filter((s): s is AnalysisSignal => !!s && typeof s === "object")
        .map((s) => ({
          id: String(s.id ?? "unknown"),
          label: String(s.label ?? "Check"),
          status: s.status ?? "unknown",
          detail: String(s.detail ?? ""),
        }))
    : [];
  return {
    score: typeof layer.score === "number" ? layer.score : 0,
    summary: String(layer.summary ?? "Analysis unavailable"),
    signals,
  };
}

function normalizeSocial(raw: unknown): HoneypotCheck["social"] {
  if (!raw || typeof raw !== "object") return EMPTY_SOCIAL;
  const social = raw as Partial<HoneypotCheck["social"]>;
  return {
    twitter: typeof social.twitter === "string" ? social.twitter : null,
    telegram: typeof social.telegram === "string" ? social.telegram : null,
    website: typeof social.website === "string" ? social.website : null,
  };
}

export function normalizeHoneypot(raw: unknown): HoneypotCheck | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Partial<HoneypotCheck>;
  if (!h.status) return null;

  return {
    status: h.status,
    score: typeof h.score === "number" ? h.score : 0,
    isHoneypot: Boolean(h.isHoneypot),
    canSell: h.canSell ?? null,
    buyFeeBps: typeof h.buyFeeBps === "number" ? h.buyFeeBps : 0,
    sellFeeBps: typeof h.sellFeeBps === "number" ? h.sellFeeBps : 0,
    creatorHoldingPct: h.creatorHoldingPct ?? null,
    contractVerified: h.contractVerified ?? null,
    lpLocked: h.lpLocked ?? null,
    recentSellCount: typeof h.recentSellCount === "number" ? h.recentSellCount : 0,
    flags: Array.isArray(h.flags) ? h.flags.map(String) : [],
    summary: String(h.summary ?? "Safety check completed"),
    checkedAt: typeof h.checkedAt === "number" ? h.checkedAt : Math.floor(Date.now() / 1000),
    creator: typeof h.creator === "string" ? h.creator : null,
    social: normalizeSocial(h.social),
    tokenAnalysis: normalizeLayer(h.tokenAnalysis),
    creatorAnalysis: normalizeLayer(h.creatorAnalysis),
    socialAnalysis: normalizeLayer(h.socialAnalysis),
  };
}
