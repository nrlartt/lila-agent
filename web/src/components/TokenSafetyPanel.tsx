import type { AnalysisLayer, AnalysisSignal, HoneypotCheck } from "../api";
import { shortAddress } from "../lib/format";

const STATUS_LABEL: Record<HoneypotCheck["status"], string> = {
  clear: "Clear",
  caution: "Caution",
  risk: "High risk",
  unknown: "Unverified",
};

const SIGNAL_ICON: Record<AnalysisSignal["status"], string> = {
  pass: "✓",
  warn: "!",
  fail: "✕",
  unknown: "?",
};

type Props = {
  honeypot: HoneypotCheck | null;
  loading?: boolean;
  compact?: boolean;
};

export function TokenSafetyPanel({ honeypot, loading, compact }: Props) {
  if (loading) {
    return (
      <section className={`glass-panel safety-panel safety-panel--loading${compact ? " safety-panel--compact" : ""}`}>
        <div className="safety-panel__head">
          <span className="safety-panel__title">Safety scan</span>
          <span className="muted">Analyzing token…</span>
        </div>
      </section>
    );
  }

  if (!honeypot) return null;

  const tokenLayer = honeypot.tokenAnalysis ?? { score: 0, summary: "", signals: [] };
  const creatorLayer = honeypot.creatorAnalysis ?? { score: 0, summary: "", signals: [] };
  const socialLayer = honeypot.socialAnalysis ?? { score: 0, summary: "", signals: [] };
  const social = honeypot.social ?? { twitter: null, telegram: null, website: null };
  const score = typeof honeypot.score === "number" ? honeypot.score : 0;

  return (
    <section
      className={`glass-panel safety-panel safety-panel--${honeypot.status}${compact ? " safety-panel--compact" : ""}`}
    >
      <header className="safety-panel__head">
        <div className="safety-panel__head-main">
          <span className="safety-panel__title">Safety scan</span>
          <span className={`safety-panel__status safety-panel__status--${honeypot.status}`}>
            {STATUS_LABEL[honeypot.status]}
          </span>
        </div>
        <ScoreRing score={score} status={honeypot.status} size={compact ? "sm" : "md"} />
      </header>

      <p className="safety-panel__summary">{honeypot.summary}</p>

      <div className="safety-panel__layers">
        <LayerCard
          title="Token CA"
          subtitle="On-chain contract"
          layer={tokenLayer}
          compact={compact}
        />
        <LayerCard
          title="Creator"
          subtitle={honeypot.creator ? shortAddress(honeypot.creator, 6, 4) : "Unknown wallet"}
          layer={creatorLayer}
          compact={compact}
        />
        <LayerCard
          title="Social"
          subtitle={socialSubtitle(social)}
          layer={socialLayer}
          links={social}
          compact={compact}
        />
      </div>

      {!compact && (
        <footer className="safety-panel__foot muted">
          Heuristic scan for HyperEVM / alt.fun — not financial advice. DYOR.
        </footer>
      )}
    </section>
  );
}

function socialSubtitle(social: HoneypotCheck["social"]): string {
  const count = [social.twitter, social.telegram, social.website].filter(Boolean).length;
  return count > 0 ? `${count} link${count === 1 ? "" : "s"} listed` : "No links";
}

function ScoreRing({
  score,
  status,
  size,
}: {
  score: number;
  status: HoneypotCheck["status"];
  size: "sm" | "md";
}) {
  const dim = size === "sm" ? 44 : 56;
  const stroke = size === "sm" ? 4 : 5;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <div className={`safety-score safety-score--${status} safety-score--${size}`} title={`Safety score ${score}/100`}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden>
        <circle
          className="safety-score__track"
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="safety-score__fill"
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
        />
      </svg>
      <span className="safety-score__value">{score}</span>
    </div>
  );
}

function LayerCard({
  title,
  subtitle,
  layer,
  links,
  compact,
}: {
  title: string;
  subtitle: string;
  layer: AnalysisLayer;
  links?: HoneypotCheck["social"];
  compact?: boolean;
}) {
  const visibleSignals = compact ? (layer.signals ?? []).slice(0, 3) : (layer.signals ?? []);

  return (
    <article className="safety-layer">
      <div className="safety-layer__head">
        <div>
          <h3 className="safety-layer__title">{title}</h3>
          <p className="safety-layer__subtitle">{subtitle}</p>
        </div>
        <span className="safety-layer__score">{layer.score}</span>
      </div>

      {links && (links.twitter || links.telegram || links.website) && (
        <div className="safety-layer__links">
          {links.twitter && (
            <a href={links.twitter} target="_blank" rel="noreferrer" className="safety-link">
              X
            </a>
          )}
          {links.telegram && (
            <a href={links.telegram} target="_blank" rel="noreferrer" className="safety-link">
              TG
            </a>
          )}
          {links.website && (
            <a href={links.website} target="_blank" rel="noreferrer" className="safety-link">
              Web
            </a>
          )}
        </div>
      )}

      <ul className="safety-signals">
        {visibleSignals.map((sig) => (
          <li key={sig.id} className={`safety-signal safety-signal--${sig.status}`}>
            <span className="safety-signal__icon" aria-hidden>
              {SIGNAL_ICON[sig.status]}
            </span>
            <div className="safety-signal__body">
              <span className="safety-signal__label">{sig.label}</span>
              <span className="safety-signal__detail">{sig.detail}</span>
            </div>
          </li>
        ))}
      </ul>

      {compact && (layer.signals?.length ?? 0) > 3 && (
        <p className="safety-layer__more muted">+{(layer.signals?.length ?? 0) - 3} more checks</p>
      )}
    </article>
  );
}
