import { useState } from "react";
import { useConnect } from "wagmi";
import type { useBotRiskConsent } from "../../hooks/useBotRiskConsent";
import { AGENT_NAME, BOT_NAME } from "../../lib/brand";
import { LilaAvatar } from "../LilaAvatar";

type Props = {
  consent: ReturnType<typeof useBotRiskConsent>;
};

export function BotRiskConsentGate({ consent }: Props) {
  const { connect, connectors, isPending } = useConnect();
  const [agreed, setAgreed] = useState(false);
  const { needsWallet, submitting, error, accept, consentVersion } = consent;

  return (
    <section className="bot-risk-gate glass-panel">
      <div className="bot-risk-gate__intro">
        <LilaAvatar size="md" />
        <div>
          <h2 className="bot-risk-gate__title">{BOT_NAME} — risk disclosure</h2>
          <p className="muted bot-agent-note">{AGENT_NAME} executes trades on your behalf once you opt in.</p>
        </div>
      </div>
      <div className="bot-risk-gate__body">
        <p>
          Trading memecoins on HyperEVM (via alt.fun) involves significant risk. Prices can be
          extremely volatile; you may lose part or all of your funds.
        </p>
        <ul>
          <li>
            <strong>Hot trading wallet:</strong> {AGENT_NAME} stores a private key in your browser.
            Anyone with access to this device or browser profile can move funds.
          </li>
          <li>
            <strong>Smart contract risk:</strong> Zap, bonding curves, and graduated pools may
            behave unexpectedly or be exploited.
          </li>
          <li>
            <strong>Honeypot &amp; liquidity:</strong> Some tokens may restrict selling or have thin
            liquidity.
          </li>
          <li>
            <strong>No advice:</strong> {AGENT_NAME} is a tool, not financial advice. You are solely
            responsible for your trades.
          </li>
          <li>
            <strong>Automation:</strong> Once started, {AGENT_NAME} can execute multiple trades
            without further confirmation.
          </li>
        </ul>
        <p className="muted bot-risk-gate__version">
          Consent version {consentVersion}. Your acceptance is recorded with your connected wallet
          address and a timestamp on our servers for compliance.
        </p>
      </div>

      {needsWallet ? (
        <div className="bot-risk-gate__actions">
          <p className="muted">Connect your wallet to accept and use {BOT_NAME}.</p>
          <button
            type="button"
            className="btn btn--primary"
            disabled={isPending}
            onClick={() => connect({ connector: connectors[0] })}
          >
            {isPending ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      ) : (
        <>
          <label className="bot-risk-gate__check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={submitting}
            />
            I have read and accept these risks. I understand I may lose my funds.
          </label>
          <button
            type="button"
            className="btn btn--primary bot-risk-gate__submit"
            disabled={!agreed || submitting}
            onClick={() => void accept()}
          >
            {submitting ? "Saving…" : `Accept & enable ${BOT_NAME}`}
          </button>
        </>
      )}

      {error && <p className="bot-field-error">{error}</p>}
    </section>
  );
}
