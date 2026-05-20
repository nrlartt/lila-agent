import type { AutoBotConfig, AutoBotRuntime, TradeSignal } from "./autoBotTypes";

export type EvaluateContext = {
  priceUsd: number;
  honeypotOk: boolean;
  lifecycle: string;
  hasTokenBalance: boolean;
  now: number;
};

function inPriceBand(price: number, config: AutoBotConfig): boolean {
  const min = config.priceMinUsd.trim() ? Number(config.priceMinUsd) : NaN;
  const max = config.priceMaxUsd.trim() ? Number(config.priceMaxUsd) : NaN;
  if (!Number.isNaN(min) && price < min) return false;
  if (!Number.isNaN(max) && price > max) return false;
  return true;
}

function refPrice(runtime: AutoBotRuntime, config: AutoBotConfig): number {
  switch (config.reference) {
    case "peak":
      return runtime.peakPrice > 0 ? runtime.peakPrice : runtime.baselinePrice;
    case "last_trade":
      return runtime.lastTradePrice > 0 ? runtime.lastTradePrice : runtime.baselinePrice;
    default:
      return runtime.baselinePrice > 0 ? runtime.baselinePrice : runtime.lastPrice;
  }
}

function canBuy(runtime: AutoBotRuntime, config: AutoBotConfig, ctx: EvaluateContext): boolean {
  if (runtime.buyCount >= config.maxBuys) return false;
  if (runtime.tradeCount >= config.maxTrades) return false;
  if (ctx.lifecycle === "graduating") return false;
  if (config.requireHoneypotClear && !ctx.honeypotOk) return false;
  if (!inPriceBand(ctx.priceUsd, config)) return false;
  return true;
}

function canSell(runtime: AutoBotRuntime, config: AutoBotConfig, ctx: EvaluateContext): boolean {
  if (!ctx.hasTokenBalance) return false;
  if (runtime.sellCount >= config.maxSells) return false;
  if (runtime.tradeCount >= config.maxTrades) return false;
  if (ctx.lifecycle === "graduating") return false;
  if (config.requireHoneypotClear && !ctx.honeypotOk) return false;
  if (!inPriceBand(ctx.priceUsd, config)) return false;
  return true;
}

function cooldownOk(runtime: AutoBotRuntime, config: AutoBotConfig, now: number): boolean {
  return now - runtime.lastTradeAt >= config.cooldownSec;
}

export function evaluateAutoBot(
  config: AutoBotConfig,
  runtime: AutoBotRuntime,
  ctx: EvaluateContext,
): TradeSignal | null {
  if (ctx.priceUsd <= 0) return null;
  if (!cooldownOk(runtime, config, ctx.now)) return null;

  const baseline = refPrice(runtime, config);
  const anchor = runtime.gridAnchor > 0 ? runtime.gridAnchor : baseline;

  switch (config.mode) {
    case "dca": {
      if (!canBuy(runtime, config, ctx)) return null;
      const intervalSec = config.intervalMinutes * 60;
      if (ctx.now - runtime.lastTradeAt < intervalSec) return null;
      return {
        action: "buy",
        title: "DCA buy",
        reason: `Interval ${config.intervalMinutes}m elapsed`,
      };
    }

    case "dip_buy": {
      if (!canBuy(runtime, config, ctx)) return null;
      const peak = Math.max(runtime.peakPrice, ctx.priceUsd);
      const threshold = peak * (1 - config.triggerPercent / 100);
      if (ctx.priceUsd > threshold) return null;
      return {
        action: "buy",
        title: "Dip buy",
        reason: `Price −${config.triggerPercent}% from session peak`,
      };
    }

    case "breakout": {
      if (!canBuy(runtime, config, ctx)) return null;
      const trigger = baseline * (1 + config.triggerPercent / 100);
      if (ctx.priceUsd < trigger) return null;
      return {
        action: "buy",
        title: "Breakout buy",
        reason: `Price +${config.triggerPercent}% above ${config.reference}`,
      };
    }

    case "grid": {
      const buyLevel = anchor * (1 - config.gridBuyStepPercent / 100);
      const sellLevel = anchor * (1 + config.gridSellStepPercent / 100);

      if (canSell(runtime, config, ctx) && ctx.priceUsd >= sellLevel) {
        return {
          action: "sell",
          title: "Grid sell",
          reason: `+${config.gridSellStepPercent}% above grid anchor · ${config.sellPercent}%`,
        };
      }
      if (canBuy(runtime, config, ctx) && ctx.priceUsd <= buyLevel) {
        return {
          action: "buy",
          title: "Grid buy",
          reason: `−${config.gridBuyStepPercent}% below grid anchor`,
        };
      }
      return null;
    }

    case "take_profit": {
      if (!canSell(runtime, config, ctx)) return null;
      const target = baseline * (1 + config.triggerPercent / 100);
      if (ctx.priceUsd < target) return null;
      return {
        action: "sell",
        title: "Take profit",
        reason: `+${config.triggerPercent}% vs ${config.reference} · sell ${config.sellPercent}%`,
      };
    }

    case "stop_loss": {
      if (!canSell(runtime, config, ctx)) return null;
      const floor = baseline * (1 - config.stopLossPercent / 100);
      if (ctx.priceUsd > floor) return null;
      return {
        action: "sell",
        title: "Stop loss",
        reason: `−${config.stopLossPercent}% vs ${config.reference} · sell ${config.sellPercent}%`,
      };
    }

    case "trailing_stop": {
      if (!canSell(runtime, config, ctx)) return null;
      const peak = Math.max(runtime.peakPrice, ctx.priceUsd);
      const trail = peak * (1 - config.trailingStopPercent / 100);
      if (ctx.priceUsd > trail) return null;
      return {
        action: "sell",
        title: "Trailing stop",
        reason: `−${config.trailingStopPercent}% from peak $${peak.toFixed(6)}`,
      };
    }

    case "bracket": {
      if (!canSell(runtime, config, ctx)) return null;
      const sl = baseline * (1 - config.stopLossPercent / 100);
      const tp = baseline * (1 + config.triggerPercent / 100);
      if (ctx.priceUsd <= sl) {
        return {
          action: "sell",
          title: "Stop loss",
          reason: `Bracket SL −${config.stopLossPercent}% · sell ${config.sellPercent}%`,
        };
      }
      if (ctx.priceUsd >= tp) {
        return {
          action: "sell",
          title: "Take profit",
          reason: `Bracket TP +${config.triggerPercent}% · sell ${config.sellPercent}%`,
        };
      }
      return null;
    }

    default:
      return null;
  }
}

export function nextRuntimeAfterTick(
  runtime: AutoBotRuntime,
  priceUsd: number,
): AutoBotRuntime {
  return {
    ...runtime,
    lastPrice: priceUsd,
    peakPrice: Math.max(runtime.peakPrice, priceUsd),
    troughPrice:
      runtime.troughPrice > 0
        ? Math.min(runtime.troughPrice, priceUsd)
        : priceUsd,
  };
}

export function nextRuntimeAfterTrade(
  runtime: AutoBotRuntime,
  now: number,
  action: "buy" | "sell",
  priceUsd: number,
): AutoBotRuntime {
  return {
    ...runtime,
    lastTradeAt: now,
    lastTradePrice: priceUsd,
    tradeCount: runtime.tradeCount + 1,
    buyCount: runtime.buyCount + (action === "buy" ? 1 : 0),
    sellCount: runtime.sellCount + (action === "sell" ? 1 : 0),
    gridAnchor: priceUsd > 0 ? priceUsd : runtime.gridAnchor,
  };
}
