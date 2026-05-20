import type { AutoBotConfig, AutoBotMode, PriceReference } from "../../lib/autoBotTypes";
import {
  describeStrategy,
  formatPctChange,
  priceVsBaselinePct,
  strategyModeLabel,
} from "../../lib/strategySummary";

type Props = {
  config: AutoBotConfig;
  setConfig: (c: AutoBotConfig) => void;
  disabled?: boolean;
  currentPrice?: number;
  baselinePrice?: number;
};

const MODE_GROUPS: {
  title: string;
  modes: { id: AutoBotMode; desc: string }[];
}[] = [
  {
    title: "Accumulate",
    modes: [
      { id: "dca", desc: "Time-based buys" },
      { id: "dip_buy", desc: "Buy pullbacks" },
      { id: "breakout", desc: "Buy momentum" },
      { id: "grid", desc: "Buy low / sell high" },
    ],
  },
  {
    title: "Exit",
    modes: [
      { id: "bracket", desc: "TP + SL together" },
      { id: "take_profit", desc: "Target gain" },
      { id: "stop_loss", desc: "Cap loss" },
      { id: "trailing_stop", desc: "Trail from peak" },
    ],
  },
];

const REFERENCES: { id: PriceReference; label: string }[] = [
  { id: "baseline", label: "Session start" },
  { id: "peak", label: "Session peak" },
  { id: "last_trade", label: "Last trade" },
];

export function StrategyConfigurator({
  config,
  setConfig,
  disabled,
  currentPrice,
  baselinePrice,
}: Props) {
  const update = <K extends keyof AutoBotConfig>(key: K, value: AutoBotConfig[K]) => {
    if (disabled) return;
    setConfig({ ...config, [key]: value });
  };

  const isBuyMode = ["dca", "dip_buy", "breakout", "grid"].includes(config.mode);
  const isSellMode = ["take_profit", "stop_loss", "trailing_stop", "bracket"].includes(
    config.mode,
  );
  const pct = priceVsBaselinePct(currentPrice ?? 0, baselinePrice ?? 0);

  return (
    <div className="strategy-config">
      <div className="strategy-config__summary">
        <span className="strategy-config__summary-label">Preview</span>
        <p>{describeStrategy(config)}</p>
        {baselinePrice != null && baselinePrice > 0 && currentPrice != null && (
          <span className="strategy-config__delta mono">
            vs baseline {formatPctChange(pct)}
          </span>
        )}
      </div>

      {MODE_GROUPS.map((group) => (
        <div key={group.title} className="strategy-config__group">
          <h4 className="strategy-config__group-title">{group.title}</h4>
          <div className="strategy-config__modes">
            {group.modes.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`strategy-card ${config.mode === m.id ? "active" : ""}`}
                disabled={disabled}
                onClick={() => update("mode", m.id)}
              >
                <span className="strategy-card__name">{strategyModeLabel(m.id)}</span>
                <span className="strategy-card__desc">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="strategy-config__panel">
        <h4 className="strategy-config__panel-title">Parameters</h4>

        {(isBuyMode || config.mode === "grid") && (
          <div className="strategy-config__block">
            <span className="strategy-config__block-label">Buy sizing</span>
            <div className="strategy-config__seg">
              <button
                type="button"
                className={config.buySizing === "fixed" ? "active" : ""}
                disabled={disabled}
                onClick={() => update("buySizing", "fixed")}
              >
                Fixed USDC
              </button>
              <button
                type="button"
                className={config.buySizing === "balance_percent" ? "active" : ""}
                disabled={disabled}
                onClick={() => update("buySizing", "balance_percent")}
              >
                % of balance
              </button>
            </div>
            {config.buySizing === "fixed" ? (
              <label className="auto-bot__field">
                <span>Amount (USDC)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={config.buyUsdc}
                  disabled={disabled}
                  onChange={(e) => update("buyUsdc", e.target.value)}
                />
              </label>
            ) : (
              <label className="auto-bot__field">
                <span>% of wallet USDC</span>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={config.buyBalancePercent}
                  disabled={disabled}
                  onChange={(e) =>
                    update(
                      "buyBalancePercent",
                      Math.min(100, Math.max(5, Number(e.target.value) || 25)),
                    )
                  }
                />
              </label>
            )}
          </div>
        )}

        {config.mode === "dca" && (
          <label className="auto-bot__field">
            <span>Interval (minutes)</span>
            <input
              type="number"
              min={5}
              value={config.intervalMinutes}
              disabled={disabled}
              onChange={(e) =>
                update("intervalMinutes", Math.max(5, Number(e.target.value) || 5))
              }
            />
          </label>
        )}

        {(config.mode === "dip_buy" || config.mode === "breakout") && (
          <label className="auto-bot__field">
            <span>Trigger (%)</span>
            <input
              type="number"
              min={1}
              max={500}
              value={config.triggerPercent}
              disabled={disabled}
              onChange={(e) =>
                update("triggerPercent", Math.max(1, Number(e.target.value) || 10))
              }
            />
          </label>
        )}

        {config.mode === "grid" && (
          <div className="auto-bot__param-row">
            <label className="auto-bot__field">
              <span>Buy step (% below anchor)</span>
              <input
                type="number"
                min={1}
                max={50}
                value={config.gridBuyStepPercent}
                disabled={disabled}
                onChange={(e) =>
                  update(
                    "gridBuyStepPercent",
                    Math.min(50, Math.max(1, Number(e.target.value) || 8)),
                  )
                }
              />
            </label>
            <label className="auto-bot__field">
              <span>Sell step (% above anchor)</span>
              <input
                type="number"
                min={1}
                max={100}
                value={config.gridSellStepPercent}
                disabled={disabled}
                onChange={(e) =>
                  update(
                    "gridSellStepPercent",
                    Math.min(100, Math.max(1, Number(e.target.value) || 10)),
                  )
                }
              />
            </label>
          </div>
        )}

        {(config.mode === "take_profit" || config.mode === "bracket") && (
          <label className="auto-bot__field">
            <span>Take profit (%)</span>
            <input
              type="number"
              min={1}
              value={config.triggerPercent}
              disabled={disabled}
              onChange={(e) =>
                update("triggerPercent", Math.max(1, Number(e.target.value) || 10))
              }
            />
          </label>
        )}

        {(config.mode === "stop_loss" || config.mode === "bracket") && (
          <label className="auto-bot__field">
            <span>Stop loss (%)</span>
            <input
              type="number"
              min={1}
              max={90}
              value={config.stopLossPercent}
              disabled={disabled}
              onChange={(e) =>
                update(
                  "stopLossPercent",
                  Math.min(90, Math.max(1, Number(e.target.value) || 15)),
                )
              }
            />
          </label>
        )}

        {config.mode === "trailing_stop" && (
          <label className="auto-bot__field">
            <span>Trail distance (% from peak)</span>
            <input
              type="number"
              min={1}
              max={50}
              value={config.trailingStopPercent}
              disabled={disabled}
              onChange={(e) =>
                update(
                  "trailingStopPercent",
                  Math.min(50, Math.max(1, Number(e.target.value) || 12)),
                )
              }
            />
          </label>
        )}

        {(isSellMode || config.mode === "grid") && (
          <label className="auto-bot__field">
            <span>Sell size (% of token balance)</span>
            <input
              type="number"
              min={1}
              max={100}
              value={config.sellPercent}
              disabled={disabled}
              onChange={(e) =>
                update("sellPercent", Math.min(100, Math.max(1, Number(e.target.value) || 50)))
              }
            />
          </label>
        )}

        {!["dca", "trailing_stop"].includes(config.mode) && (
          <label className="auto-bot__field">
            <span>Price reference</span>
            <select
              value={config.reference}
              disabled={disabled}
              onChange={(e) => update("reference", e.target.value as PriceReference)}
            >
              {REFERENCES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="auto-bot__param-row">
          <label className="auto-bot__field">
            <span>Min price (USD)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Optional"
              value={config.priceMinUsd}
              disabled={disabled}
              onChange={(e) => update("priceMinUsd", e.target.value)}
            />
          </label>
          <label className="auto-bot__field">
            <span>Max price (USD)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Optional"
              value={config.priceMaxUsd}
              disabled={disabled}
              onChange={(e) => update("priceMaxUsd", e.target.value)}
            />
          </label>
        </div>
      </div>

      <details className="strategy-config__advanced">
        <summary>Risk & execution</summary>
        <div className="auto-bot__param-row">
          <label className="auto-bot__field">
            <span>Poll (sec)</span>
            <input
              type="number"
              min={15}
              value={config.pollIntervalSec}
              disabled={disabled}
              onChange={(e) =>
                update("pollIntervalSec", Math.max(15, Number(e.target.value) || 30))
              }
            />
          </label>
          <label className="auto-bot__field">
            <span>Cooldown (sec)</span>
            <input
              type="number"
              min={30}
              value={config.cooldownSec}
              disabled={disabled}
              onChange={(e) =>
                update("cooldownSec", Math.max(30, Number(e.target.value) || 90))
              }
            />
          </label>
        </div>
        <div className="auto-bot__param-row">
          <label className="auto-bot__field">
            <span>Max buys</span>
            <input
              type="number"
              min={1}
              max={200}
              value={config.maxBuys}
              disabled={disabled}
              onChange={(e) =>
                update("maxBuys", Math.min(200, Math.max(1, Number(e.target.value) || 20)))
              }
            />
          </label>
          <label className="auto-bot__field">
            <span>Max sells</span>
            <input
              type="number"
              min={1}
              max={200}
              value={config.maxSells}
              disabled={disabled}
              onChange={(e) =>
                update("maxSells", Math.min(200, Math.max(1, Number(e.target.value) || 20)))
              }
            />
          </label>
          <label className="auto-bot__field">
            <span>Max total</span>
            <input
              type="number"
              min={1}
              max={200}
              value={config.maxTrades}
              disabled={disabled}
              onChange={(e) =>
                update("maxTrades", Math.min(200, Math.max(1, Number(e.target.value) || 30)))
              }
            />
          </label>
        </div>
        <label className="auto-bot__check">
          <input
            type="checkbox"
            checked={config.requireHoneypotClear}
            disabled={disabled}
            onChange={(e) => update("requireHoneypotClear", e.target.checked)}
          />
          Only trade when honeypot is clear
        </label>
      </details>
    </div>
  );
}
