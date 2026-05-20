import type { HoneypotCheck } from "../api";

const LABELS: Record<HoneypotCheck["status"], string> = {
  clear: "Clear",
  caution: "Caution",
  risk: "Honeypot risk",
  unknown: "Unverified",
};

type Props = {
  honeypot: HoneypotCheck | null;
  loading?: boolean;
  compact?: boolean;
  showDetail?: boolean;
};

export function HoneypotBadge({
  honeypot,
  loading,
  compact,
  showDetail = !compact,
}: Props) {
  if (loading) {
    return (
      <span className="honeypot-badge honeypot-badge--loading" title="Checking token safety…">
        Checking…
      </span>
    );
  }

  if (!honeypot) return null;

  return (
    <div className={`honeypot-badge-wrap${compact ? " honeypot-badge-wrap--compact" : ""}`}>
      <span
        className={`honeypot-badge honeypot-badge--${honeypot.status}`}
        title={honeypot.summary}
      >
        <span className="honeypot-badge__icon" aria-hidden>
          {honeypot.status === "clear" ? "✓" : honeypot.status === "risk" ? "!" : "?"}
        </span>
        {LABELS[honeypot.status]}
        <span className="honeypot-badge__score">{honeypot.score}</span>
      </span>
      {showDetail && (
        <div className="honeypot-detail">
          <p className="honeypot-detail__summary">{honeypot.summary}</p>
          {honeypot.flags?.length ? (
            <ul className="honeypot-detail__flags">
              {honeypot.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
          <p className="honeypot-detail__disclaimer muted">
            Heuristic check for HyperEVM / alt.fun — not financial advice. DYOR.
          </p>
        </div>
      )}
    </div>
  );
}
