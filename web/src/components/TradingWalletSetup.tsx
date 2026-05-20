import { useState } from "react";
import { useAccount } from "wagmi";
import { shortAddress } from "../lib/format";
import type { useTradingWallet } from "../hooks/useTradingWallet";

type WalletApi = ReturnType<typeof useTradingWallet>;

type Props = {
  wallet: WalletApi;
  disabled?: boolean;
  compact?: boolean;
};

export function TradingWalletSetup({ wallet, disabled, compact }: Props) {
  const { address: connectedAddress, isConnected } = useAccount();
  const [fundAmount, setFundAmount] = useState("50");
  const [importKey, setImportKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [exported, setExported] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const {
    address,
    sessionActive,
    hasPendingSetup,
    pendingKey,
    restored,
    usdcLabel,
    zapApproved,
    loading,
    error,
    setError,
    createWallet,
    importWallet,
    saveToProfile,
    disconnect,
    fundFromConnectedWallet,
    approveZap,
  } = wallet;

  const displayKey = pendingKey;
  const ready = sessionActive && zapApproved;

  if (!isConnected) {
    return (
      <div className={`trading-wallet ${compact ? "trading-wallet--compact" : ""}`}>
        <p className="trading-wallet__warn">
          Connect your main wallet first. Your trading wallet is saved per profile and
          restores automatically when you reconnect.
        </p>
      </div>
    );
  }

  if (!address && !hasPendingSetup) {
    return (
      <div className={`trading-wallet ${compact ? "trading-wallet--compact" : ""}`}>
        <p className="trading-wallet__warn">
          Dedicated hot wallet — limited USDC only. Saved in this browser, linked to{" "}
          {connectedAddress ? shortAddress(connectedAddress, 6, 4) : "your profile"}.
        </p>
        <div className="trading-wallet__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={disabled}
            onClick={() => {
              createWallet();
              setExported(false);
              setRiskAccepted(false);
            }}
          >
            Create trading wallet
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={disabled}
            onClick={() => setShowImport((v) => !v)}
          >
            Import existing
          </button>
        </div>
        {showImport && (
          <div className="trading-wallet__import-open">
            <textarea
              className="trading-wallet__import-input mono"
              placeholder="Private key 0x…"
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
              rows={2}
              disabled={disabled}
            />
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              disabled={disabled || !importKey.trim()}
              onClick={() => {
                try {
                  importWallet(importKey);
                  setExported(true);
                  setRiskAccepted(false);
                } catch {
                  /* hook sets error */
                }
              }}
            >
              Import key
            </button>
          </div>
        )}
        {error && <p className="bot-field-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`trading-wallet ${compact ? "trading-wallet--compact" : ""}`}>
      <div className="trading-wallet__row">
        <code className="mono">{address ? shortAddress(address, 8, 6) : "—"}</code>
        {sessionActive ? (
          <span className="trading-wallet__badge trading-wallet__badge--on">
            {restored ? "Restored" : "Linked"}
          </span>
        ) : (
          <span className="trading-wallet__badge">Not saved</span>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--xs"
          onClick={() => address && navigator.clipboard.writeText(address)}
        >
          Copy
        </button>
      </div>

      {restored && sessionActive && (
        <p className="trading-wallet__hint muted">
          Trading wallet restored from your profile. No need to create a new one.
        </p>
      )}

      {displayKey && !sessionActive && (
        <div className="trading-wallet__key-block">
          <p className="trading-wallet__warn trading-wallet__warn--sm">
            Back up this private key. It will be stored in this browser and linked to your
            connected wallet so it returns when you visit again.
          </p>
          <div className="trading-wallet__key-actions">
            {showKey ? (
              <code className="trading-wallet__key mono">{displayKey}</code>
            ) : (
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={() => setShowKey(true)}
              >
                Reveal key
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={() => {
                void navigator.clipboard.writeText(displayKey);
                setExported(true);
              }}
            >
              Copy key
            </button>
          </div>
          <label className="trading-wallet__check">
            <input
              type="checkbox"
              checked={riskAccepted}
              onChange={(e) => setRiskAccepted(e.target.checked)}
              disabled={disabled}
            />
            I accept the risks of a hot wallet stored in this browser.
          </label>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={disabled || !riskAccepted || (!exported && hasPendingSetup)}
            onClick={() => saveToProfile()}
          >
            Save to profile
          </button>
        </div>
      )}

      {sessionActive && (
        <div className="trading-wallet__steps">
          <div className={`trading-wallet__step ${Number(usdcLabel) > 0 ? "done" : ""}`}>
            <span className="trading-wallet__step-label">1. Fund</span>
            <div className="trading-wallet__fund-inline">
              <input
                type="text"
                inputMode="decimal"
                value={fundAmount}
                disabled={disabled || loading}
                onChange={(e) => setFundAmount(e.target.value)}
                aria-label="USDC amount"
              />
              <button
                type="button"
                className="btn btn--primary btn--xs"
                disabled={disabled || loading || !connectedAddress}
                onClick={() => {
                  if (!connectedAddress) return;
                  setError("");
                  void fundFromConnectedWallet(fundAmount, connectedAddress);
                }}
              >
                Send
              </button>
            </div>
            <span className="mono muted">{usdcLabel} USDC in wallet</span>
          </div>

          <div className={`trading-wallet__step ${zapApproved ? "done" : ""}`}>
            <span className="trading-wallet__step-label">2. Approve USDC</span>
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              disabled={disabled || loading || zapApproved}
              onClick={() => void approveZap()}
            >
              {zapApproved ? "Approved" : "Approve (no popup)"}
            </button>
          </div>

          {ready && (
            <p className="trading-wallet__ready muted">
              Ready for auto bot — set strategy and start.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn btn--ghost btn--xs trading-wallet__disconnect"
        disabled={disabled || loading}
        onClick={() => {
          disconnect();
          setImportKey("");
          setRiskAccepted(false);
          setExported(false);
        }}
      >
        Remove trading wallet
      </button>

      {error && <p className="bot-field-error">{error}</p>}
    </div>
  );
}
