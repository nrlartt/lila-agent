import type { ReactNode } from "react";
import type { LaunchSniperConfig, LaunchSellMode } from "../../lib/launchSniperTypes";

type Props = {
  config: LaunchSniperConfig;
  setConfig: (c: LaunchSniperConfig) => void;
  disabled: boolean;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="launch-field">
      <span className="launch-field__label">{label}</span>
      {hint && <span className="launch-field__hint muted">{hint}</span>}
      {children}
    </label>
  );
}

export function LaunchSniperConfigForm({ config, setConfig, disabled }: Props) {
  const patch = (partial: Partial<LaunchSniperConfig>) =>
    setConfig({ ...config, ...partial });

  const sellModes: { id: LaunchSellMode; label: string }[] = [
    { id: "bracket", label: "Bracket (TP + SL)" },
    { id: "take_profit", label: "Take profit only" },
    { id: "stop_loss", label: "Stop loss only" },
    { id: "trailing_stop", label: "Trailing stop" },
    { id: "time_exit", label: "Time exit" },
  ];

  return (
    <div className="launch-config">
      <section className="launch-config__section glass-panel">
        <h3>Buy rules — when Lila snipes a new launch</h3>
        <div className="launch-config__grid">
          <Field label="Max launch age (sec)" hint="Only tokens this fresh">
            <input
              type="number"
              min={30}
              max={3600}
              value={config.maxTokenAgeSec}
              disabled={disabled}
              onChange={(e) => patch({ maxTokenAgeSec: Number(e.target.value) || 300 })}
            />
          </Field>
          <Field label="Buy size (USDC)" hint="Min 20 USDC on alt.fun">
            <input
              type="text"
              inputMode="decimal"
              value={config.buyUsdc}
              disabled={disabled || config.buySizing !== "fixed"}
              onChange={(e) => patch({ buyUsdc: e.target.value })}
            />
          </Field>
          <Field label="Buy sizing">
            <select
              value={config.buySizing}
              disabled={disabled}
              onChange={(e) =>
                patch({ buySizing: e.target.value as LaunchSniperConfig["buySizing"] })
              }
            >
              <option value="fixed">Fixed USDC</option>
              <option value="balance_percent">% of wallet USDC</option>
            </select>
          </Field>
          {config.buySizing === "balance_percent" && (
            <Field label="Balance % per snipe">
              <input
                type="number"
                min={5}
                max={100}
                value={config.buyBalancePercent}
                disabled={disabled}
                onChange={(e) =>
                  patch({ buyBalancePercent: Number(e.target.value) || 20 })
                }
              />
            </Field>
          )}
          <Field label="Max open positions">
            <input
              type="number"
              min={1}
              max={20}
              value={config.maxConcurrentPositions}
              disabled={disabled}
              onChange={(e) =>
                patch({ maxConcurrentPositions: Number(e.target.value) || 1 })
              }
            />
          </Field>
          <Field label="Max snipes / session">
            <input
              type="number"
              min={1}
              max={100}
              value={config.maxBuysPerSession}
              disabled={disabled}
              onChange={(e) =>
                patch({ maxBuysPerSession: Number(e.target.value) || 1 })
              }
            />
          </Field>
          <Field label="Snipe cooldown (sec)">
            <input
              type="number"
              min={0}
              max={600}
              value={config.snipeCooldownSec}
              disabled={disabled}
              onChange={(e) =>
                patch({ snipeCooldownSec: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Poll interval (sec)">
            <input
              type="number"
              min={8}
              max={120}
              value={config.pollIntervalSec}
              disabled={disabled}
              onChange={(e) =>
                patch({ pollIntervalSec: Number(e.target.value) || 12 })
              }
            />
          </Field>
          <Field label="Max mcap (USD)" hint="Empty = no limit">
            <input
              type="text"
              inputMode="decimal"
              placeholder="250000"
              value={config.maxMcapUsd}
              disabled={disabled}
              onChange={(e) => patch({ maxMcapUsd: e.target.value })}
            />
          </Field>
          <Field label="Min mcap (USD)">
            <input
              type="text"
              inputMode="decimal"
              value={config.minMcapUsd}
              disabled={disabled}
              onChange={(e) => patch({ minMcapUsd: e.target.value })}
            />
          </Field>
          <Field label="Curve fill min %" hint="0–100">
            <input
              type="number"
              min={0}
              max={100}
              value={config.minCurveFilledPct}
              disabled={disabled}
              onChange={(e) =>
                patch({ minCurveFilledPct: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Curve fill max %">
            <input
              type="number"
              min={0}
              max={100}
              value={config.maxCurveFilledPct}
              disabled={disabled}
              onChange={(e) =>
                patch({ maxCurveFilledPct: Number(e.target.value) || 100 })
              }
            />
          </Field>
          <Field label="Keywords" hint="Comma-separated name/ticker match">
            <input
              type="text"
              placeholder="ai, agent, lila"
              value={config.keywordFilter}
              disabled={disabled}
              onChange={(e) => patch({ keywordFilter: e.target.value })}
            />
          </Field>
        </div>
        <div className="launch-config__checks">
          <label>
            <input
              type="checkbox"
              checked={config.requireHoneypotClear}
              disabled={disabled}
              onChange={(e) => patch({ requireHoneypotClear: e.target.checked })}
            />
            Require honeypot clear
          </label>
          <label>
            <input
              type="checkbox"
              checked={config.curveOnly}
              disabled={disabled}
              onChange={(e) => patch({ curveOnly: e.target.checked })}
            />
            Curve phase only
          </label>
        </div>
      </section>

      <section className="launch-config__section glass-panel">
        <h3>Sell rules — when Lila exits a snipe</h3>
        <div className="launch-config__grid">
          <Field label="Exit strategy">
            <select
              value={config.sellMode}
              disabled={disabled}
              onChange={(e) =>
                patch({ sellMode: e.target.value as LaunchSellMode })
              }
            >
              {sellModes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Take profit %">
            <input
              type="number"
              min={1}
              max={500}
              value={config.takeProfitPercent}
              disabled={disabled}
              onChange={(e) =>
                patch({ takeProfitPercent: Number(e.target.value) || 35 })
              }
            />
          </Field>
          <Field label="Stop loss %">
            <input
              type="number"
              min={1}
              max={90}
              value={config.stopLossPercent}
              disabled={disabled}
              onChange={(e) =>
                patch({ stopLossPercent: Number(e.target.value) || 18 })
              }
            />
          </Field>
          <Field label="Trailing stop %">
            <input
              type="number"
              min={1}
              max={90}
              value={config.trailingStopPercent}
              disabled={disabled}
              onChange={(e) =>
                patch({ trailingStopPercent: Number(e.target.value) || 14 })
              }
            />
          </Field>
          <Field label="Sell amount %" hint="100 = full exit">
            <input
              type="number"
              min={1}
              max={100}
              value={config.sellPercent}
              disabled={disabled}
              onChange={(e) => patch({ sellPercent: Number(e.target.value) || 100 })}
            />
          </Field>
          <Field label="Max hold (minutes)" hint="Time exit / safety">
            <input
              type="number"
              min={1}
              max={10080}
              value={config.maxHoldMinutes}
              disabled={disabled}
              onChange={(e) =>
                patch({ maxHoldMinutes: Number(e.target.value) || 120 })
              }
            />
          </Field>
        </div>
        <label className="launch-config__checks">
          <input
            type="checkbox"
            checked={config.sellOnGraduating}
            disabled={disabled}
            onChange={(e) => patch({ sellOnGraduating: e.target.checked })}
          />
          Sell when token enters graduation
        </label>
      </section>
    </div>
  );
}
