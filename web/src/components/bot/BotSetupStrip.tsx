import type { useTradingWallet } from "../../hooks/useTradingWallet";
import { AGENT_NAME } from "../../lib/brand";

type Wallet = ReturnType<typeof useTradingWallet>;

type Props = {
  wallet: Wallet;
  botRunning: boolean;
  tab: "manual" | "auto";
};

export function BotSetupStrip({ wallet, botRunning, tab }: Props) {
  if (tab !== "auto") return null;

  const steps = [
    {
      id: "wallet",
      label: "Trading wallet",
      done: wallet.sessionActive,
    },
    {
      id: "fund",
      label: "USDC funded",
      done: wallet.sessionActive && wallet.usdcBalance > 0n,
    },
    {
      id: "approve",
      label: "Zap approved",
      done: wallet.zapApproved,
    },
    {
      id: "run",
      label: `${AGENT_NAME} active`,
      done: botRunning,
    },
  ];

  const ready = steps.slice(0, 3).every((s) => s.done);

  return (
    <div className="bot-setup-strip" role="list" aria-label="Auto bot setup">
      {steps.map((s, i) => (
        <div
          key={s.id}
          role="listitem"
          className={`bot-setup-step ${s.done ? "bot-setup-step--done" : ""}`}
        >
          <span className="bot-setup-step__num">{s.done ? "✓" : i + 1}</span>
          <span className="bot-setup-step__label">{s.label}</span>
        </div>
      ))}
      {ready && !botRunning && (
        <span className="bot-setup-strip__hint muted">Ready — configure strategy and start</span>
      )}
    </div>
  );
}
