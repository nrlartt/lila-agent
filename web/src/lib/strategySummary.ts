import type { AutoBotConfig } from "./autoBotTypes";
export function describeStrategy(config: AutoBotConfig): string {
  const band =
    config.priceMinUsd || config.priceMaxUsd
      ? ` · band ${config.priceMinUsd || "0"}–${config.priceMaxUsd || "∞"}`
      : "";
  const size =
    config.buySizing === "balance_percent"
      ? `${config.buyBalancePercent}% of USDC`
      : `${config.buyUsdc} USDC`;

  switch (config.mode) {
    case "dca":
      return `Buy ${size} every ${config.intervalMinutes}m${band}`;
    case "dip_buy":
      return `Buy ${size} when price drops ${config.triggerPercent}% from peak${band}`;
    case "breakout":
      return `Buy ${size} on +${config.triggerPercent}% breakout (${config.reference})${band}`;
    case "grid":
      return `Grid ±${config.gridBuyStepPercent}%/${config.gridSellStepPercent}% · sell ${config.sellPercent}%${band}`;
    case "take_profit":
      return `Sell ${config.sellPercent}% at +${config.triggerPercent}% vs ${config.reference}${band}`;
    case "stop_loss":
      return `Sell ${config.sellPercent}% at −${config.stopLossPercent}% vs ${config.reference}${band}`;
    case "trailing_stop":
      return `Sell ${config.sellPercent}% on −${config.trailingStopPercent}% trail from peak${band}`;
    case "bracket":
      return `TP +${config.triggerPercent}% / SL −${config.stopLossPercent}% · sell ${config.sellPercent}%${band}`;
    default:
      return "Configure strategy";
  }
}

export function priceVsBaselinePct(
  price: number,
  baseline: number,
): number | null {
  if (baseline <= 0 || price <= 0) return null;
  return ((price - baseline) / baseline) * 100;
}

export function formatPctChange(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function strategyModeLabel(mode: AutoBotConfig["mode"]): string {
  const labels: Record<AutoBotConfig["mode"], string> = {
    dca: "DCA",
    dip_buy: "Dip buy",
    breakout: "Breakout",
    grid: "Grid",
    take_profit: "Take profit",
    stop_loss: "Stop loss",
    trailing_stop: "Trailing stop",
    bracket: "TP + SL",
  };
  return labels[mode];
}
