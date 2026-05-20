import type { HoneypotCheck, Token } from "../api";
import type { BuySizing } from "./autoBotTypes";

export type LaunchSellMode =
  | "take_profit"
  | "stop_loss"
  | "trailing_stop"
  | "bracket"
  | "time_exit";

export type LaunchSniperConfig = {
  /** Max seconds since launch to consider sniping */
  maxTokenAgeSec: number;
  buyUsdc: string;
  buySizing: BuySizing;
  buyBalancePercent: number;
  maxConcurrentPositions: number;
  maxBuysPerSession: number;
  snipeCooldownSec: number;
  pollIntervalSec: number;
  requireHoneypotClear: boolean;
  curveOnly: boolean;
  minMcapUsd: string;
  maxMcapUsd: string;
  minCurveFilledPct: number;
  maxCurveFilledPct: number;
  minPriceUsd: string;
  maxPriceUsd: string;
  /** Comma-separated; token must match one if set */
  keywordFilter: string;
  sellMode: LaunchSellMode;
  takeProfitPercent: number;
  stopLossPercent: number;
  trailingStopPercent: number;
  sellPercent: number;
  maxHoldMinutes: number;
  maxSellsPerPosition: number;
  sellOnGraduating: boolean;
};

export type LaunchPosition = {
  address: string;
  ticker: string;
  name: string;
  image: string;
  entryPrice: number;
  entryAt: number;
  peakPrice: number;
  buyTxHash?: string;
  sellCount: number;
  closed: boolean;
};

export type LaunchSniperRuntime = {
  startedAt: number;
  sessionBuys: number;
  lastSnipeAt: number;
};

export const DEFAULT_LAUNCH_SNIPER_CONFIG: LaunchSniperConfig = {
  maxTokenAgeSec: 300,
  buyUsdc: "25",
  buySizing: "fixed",
  buyBalancePercent: 20,
  maxConcurrentPositions: 3,
  maxBuysPerSession: 10,
  snipeCooldownSec: 45,
  pollIntervalSec: 12,
  requireHoneypotClear: true,
  curveOnly: true,
  minMcapUsd: "",
  maxMcapUsd: "250000",
  minCurveFilledPct: 0,
  maxCurveFilledPct: 40,
  minPriceUsd: "",
  maxPriceUsd: "",
  keywordFilter: "",
  sellMode: "bracket",
  takeProfitPercent: 35,
  stopLossPercent: 18,
  trailingStopPercent: 14,
  sellPercent: 100,
  maxHoldMinutes: 120,
  maxSellsPerPosition: 3,
  sellOnGraduating: true,
};

export function normalizeLaunchSniperConfig(
  partial?: Partial<LaunchSniperConfig> | null,
): LaunchSniperConfig {
  if (!partial) return { ...DEFAULT_LAUNCH_SNIPER_CONFIG };
  return { ...DEFAULT_LAUNCH_SNIPER_CONFIG, ...partial };
}

export function createLaunchRuntime(): LaunchSniperRuntime {
  const now = Math.floor(Date.now() / 1000);
  return { startedAt: now, sessionBuys: 0, lastSnipeAt: 0 };
}

export type LaunchBuyEvaluation = {
  ok: boolean;
  reason: string;
};

export type LaunchSellSignal = {
  title: string;
  reason: string;
};

function numOrNaN(s: string): number {
  const v = s.trim();
  if (!v) return NaN;
  return Number(v);
}

function matchesKeywords(token: Token, filter: string): boolean {
  const raw = filter.trim();
  if (!raw) return true;
  const hay = `${token.ticker} ${token.name}`.toLowerCase();
  return raw
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .some((k) => hay.includes(k));
}

export function evaluateLaunchBuy(
  config: LaunchSniperConfig,
  token: Token,
  honeypot: HoneypotCheck | null,
  now: number,
  runtime: LaunchSniperRuntime,
  openPositions: number,
  alreadySeen: boolean,
): LaunchBuyEvaluation {
  if (alreadySeen) return { ok: false, reason: "Already processed this launch" };
  if (openPositions >= config.maxConcurrentPositions) {
    return { ok: false, reason: "Max open positions reached" };
  }
  if (runtime.sessionBuys >= config.maxBuysPerSession) {
    return { ok: false, reason: "Session buy limit reached" };
  }
  if (now - runtime.lastSnipeAt < config.snipeCooldownSec) {
    return { ok: false, reason: "Snipe cooldown active" };
  }

  const age = token.launchedAt > 0 ? now - token.launchedAt : 0;
  if (token.launchedAt > 0 && age > config.maxTokenAgeSec) {
    return { ok: false, reason: `Launch older than ${config.maxTokenAgeSec}s` };
  }

  if (config.curveOnly && token.lifecycle !== "curve") {
    return { ok: false, reason: `Lifecycle is ${token.lifecycle}, curve only` };
  }

  if (!matchesKeywords(token, config.keywordFilter)) {
    return { ok: false, reason: "Keyword filter mismatch" };
  }

  const minM = numOrNaN(config.minMcapUsd);
  const maxM = numOrNaN(config.maxMcapUsd);
  if (!Number.isNaN(minM) && token.mcapUsd < minM) {
    return { ok: false, reason: `Mcap below $${minM}` };
  }
  if (!Number.isNaN(maxM) && token.mcapUsd > maxM) {
    return { ok: false, reason: `Mcap above $${maxM}` };
  }

  if (token.curveFilledPct < config.minCurveFilledPct) {
    return { ok: false, reason: "Curve fill too low" };
  }
  if (token.curveFilledPct > config.maxCurveFilledPct) {
    return { ok: false, reason: "Curve fill too high" };
  }

  const minP = numOrNaN(config.minPriceUsd);
  const maxP = numOrNaN(config.maxPriceUsd);
  if (!Number.isNaN(minP) && token.priceUsd < minP) {
    return { ok: false, reason: "Price below min" };
  }
  if (!Number.isNaN(maxP) && token.priceUsd > maxP) {
    return { ok: false, reason: "Price above max" };
  }

  if (config.requireHoneypotClear) {
    if (!honeypot) return { ok: false, reason: "Honeypot check pending" };
    if (honeypot.status === "risk" || honeypot.isHoneypot) {
      return { ok: false, reason: "Honeypot risk" };
    }
    if (honeypot.canSell === false) {
      return { ok: false, reason: "Sell restricted" };
    }
  }

  if (token.priceUsd <= 0) return { ok: false, reason: "No price yet" };

  return { ok: true, reason: `New launch · ${age}s old · $${token.mcapUsd.toFixed(0)} mcap` };
}

export function evaluateLaunchSell(
  config: LaunchSniperConfig,
  position: LaunchPosition,
  token: Token,
  honeypot: HoneypotCheck | null,
  now: number,
  hasBalance: boolean,
): LaunchSellSignal | null {
  if (position.closed || !hasBalance) return null;
  if (position.sellCount >= config.maxSellsPerPosition) return null;

  const price = token.priceUsd;
  if (price <= 0) return null;

  if (config.sellOnGraduating && token.lifecycle === "graduating") {
    return {
      title: "Graduating exit",
      reason: "Token entering graduation — Lila selling",
    };
  }

  if (config.requireHoneypotClear && honeypot?.status === "risk") {
    return { title: "Risk exit", reason: "Honeypot turned risky" };
  }

  const entry = position.entryPrice > 0 ? position.entryPrice : price;
  const peak = Math.max(position.peakPrice, price);
  const holdMin = (now - position.entryAt) / 60;

  if (config.sellMode === "time_exit" || config.maxHoldMinutes > 0) {
    if (holdMin >= config.maxHoldMinutes) {
      return {
        title: "Time exit",
        reason: `Held ${Math.floor(holdMin)}m · max ${config.maxHoldMinutes}m`,
      };
    }
  }

  switch (config.sellMode) {
    case "take_profit": {
      const target = entry * (1 + config.takeProfitPercent / 100);
      if (price >= target) {
        return {
          title: "Take profit",
          reason: `+${config.takeProfitPercent}% from entry`,
        };
      }
      return null;
    }
    case "stop_loss": {
      const floor = entry * (1 - config.stopLossPercent / 100);
      if (price <= floor) {
        return {
          title: "Stop loss",
          reason: `−${config.stopLossPercent}% from entry`,
        };
      }
      return null;
    }
    case "trailing_stop": {
      const trail = peak * (1 - config.trailingStopPercent / 100);
      if (price <= trail) {
        return {
          title: "Trailing stop",
          reason: `−${config.trailingStopPercent}% from peak`,
        };
      }
      return null;
    }
    case "time_exit":
      return null;
    case "bracket":
    default: {
      const tp = entry * (1 + config.takeProfitPercent / 100);
      const sl = entry * (1 - config.stopLossPercent / 100);
      if (price >= tp) {
        return { title: "Take profit", reason: `Bracket TP +${config.takeProfitPercent}%` };
      }
      if (price <= sl) {
        return { title: "Stop loss", reason: `Bracket SL −${config.stopLossPercent}%` };
      }
      return null;
    }
  }
}

export function bumpPositionPeak(pos: LaunchPosition, price: number): LaunchPosition {
  return { ...pos, peakPrice: Math.max(pos.peakPrice, price) };
}
