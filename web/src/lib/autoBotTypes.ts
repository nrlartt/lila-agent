export type AutoBotMode =
  | "dca"
  | "dip_buy"
  | "breakout"
  | "grid"
  | "take_profit"
  | "stop_loss"
  | "trailing_stop"
  | "bracket";

export type PriceReference = "baseline" | "peak" | "last_trade";

export type BuySizing = "fixed" | "balance_percent";

export type AutoBotConfig = {
  mode: AutoBotMode;
  buyUsdc: string;
  buySizing: BuySizing;
  /** % of trading-wallet USDC balance per buy */
  buyBalancePercent: number;
  sellPercent: number;
  /** TP / dip / breakout / grid sell step */
  triggerPercent: number;
  stopLossPercent: number;
  trailingStopPercent: number;
  intervalMinutes: number;
  gridBuyStepPercent: number;
  gridSellStepPercent: number;
  priceMinUsd: string;
  priceMaxUsd: string;
  reference: PriceReference;
  requireHoneypotClear: boolean;
  maxTrades: number;
  maxBuys: number;
  maxSells: number;
  cooldownSec: number;
  pollIntervalSec: number;
};

export type AutoBotRuntime = {
  startedAt: number;
  baselinePrice: number;
  peakPrice: number;
  troughPrice: number;
  lastTradeAt: number;
  lastTradePrice: number;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  lastPrice: number;
  gridAnchor: number;
};

export type TradeSignal = {
  action: "buy" | "sell";
  reason: string;
  title: string;
};

export type BotLogLevel = "info" | "signal" | "trade" | "warn" | "error";

export type BotLogEntry = {
  id: string;
  at: number;
  level: BotLogLevel;
  message: string;
  title?: string;
  action?: "buy" | "sell";
  txHash?: string;
};

export const DEFAULT_AUTO_BOT_CONFIG: AutoBotConfig = {
  mode: "bracket",
  buyUsdc: "25",
  buySizing: "fixed",
  buyBalancePercent: 25,
  sellPercent: 50,
  triggerPercent: 25,
  stopLossPercent: 15,
  trailingStopPercent: 12,
  intervalMinutes: 60,
  gridBuyStepPercent: 8,
  gridSellStepPercent: 10,
  priceMinUsd: "",
  priceMaxUsd: "",
  reference: "baseline",
  requireHoneypotClear: true,
  maxTrades: 30,
  maxBuys: 20,
  maxSells: 20,
  cooldownSec: 90,
  pollIntervalSec: 30,
};

export function createRuntime(startPrice: number): AutoBotRuntime {
  const now = Math.floor(Date.now() / 1000);
  const p = startPrice > 0 ? startPrice : 0;
  return {
    startedAt: now,
    baselinePrice: p,
    peakPrice: p,
    troughPrice: p,
    lastTradeAt: now,
    lastTradePrice: p,
    tradeCount: 0,
    buyCount: 0,
    sellCount: 0,
    lastPrice: p,
    gridAnchor: p,
  };
}

/** Merge persisted partial config with defaults (forward-compatible). */
export function normalizeAutoBotConfig(
  partial?: Partial<AutoBotConfig> | null,
): AutoBotConfig {
  if (!partial) return { ...DEFAULT_AUTO_BOT_CONFIG };
  const mode = partial.mode ?? DEFAULT_AUTO_BOT_CONFIG.mode;
  const legacy = partial as Partial<AutoBotConfig> & { mode?: string };
  const safeMode = (
    [
      "dca",
      "dip_buy",
      "breakout",
      "grid",
      "take_profit",
      "stop_loss",
      "trailing_stop",
      "bracket",
    ] as const
  ).includes(mode as AutoBotMode)
    ? (mode as AutoBotMode)
    : DEFAULT_AUTO_BOT_CONFIG.mode;

  return {
    ...DEFAULT_AUTO_BOT_CONFIG,
    ...partial,
    mode: safeMode,
    buySizing: partial.buySizing ?? DEFAULT_AUTO_BOT_CONFIG.buySizing,
    buyBalancePercent:
      partial.buyBalancePercent ?? DEFAULT_AUTO_BOT_CONFIG.buyBalancePercent,
    stopLossPercent:
      partial.stopLossPercent ??
      (legacy.mode === "stop_loss" ? partial.triggerPercent : undefined) ??
      DEFAULT_AUTO_BOT_CONFIG.stopLossPercent,
    trailingStopPercent:
      partial.trailingStopPercent ?? DEFAULT_AUTO_BOT_CONFIG.trailingStopPercent,
    gridBuyStepPercent:
      partial.gridBuyStepPercent ?? DEFAULT_AUTO_BOT_CONFIG.gridBuyStepPercent,
    gridSellStepPercent:
      partial.gridSellStepPercent ?? DEFAULT_AUTO_BOT_CONFIG.gridSellStepPercent,
    maxBuys: partial.maxBuys ?? partial.maxTrades ?? DEFAULT_AUTO_BOT_CONFIG.maxBuys,
    maxSells: partial.maxSells ?? partial.maxTrades ?? DEFAULT_AUTO_BOT_CONFIG.maxSells,
  };
}
