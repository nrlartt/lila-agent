import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { fetchBotRiskConsent, submitBotRiskConsent } from "../api";
import {
  BOT_RISK_CONSENT_VERSION,
  readLocalBotRiskConsent,
  writeLocalBotRiskConsent,
} from "../lib/botRiskConsent";

export function useBotRiskConsent() {
  const { address, isConnected } = useAccount();
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (wallet: string) => {
    if (readLocalBotRiskConsent(wallet)) {
      setAccepted(true);
      setChecked(true);
      return;
    }
    try {
      const res = await fetchBotRiskConsent(wallet, BOT_RISK_CONSENT_VERSION);
      if (res.accepted) {
        writeLocalBotRiskConsent(wallet);
        setAccepted(true);
      } else {
        setAccepted(false);
      }
    } catch {
      setAccepted(false);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      setAccepted(false);
      setChecked(false);
      setError("");
      return;
    }
    setChecked(false);
    void refresh(address);
  }, [address, isConnected, refresh]);

  const accept = useCallback(async () => {
    if (!address) {
      setError("Connect your wallet to accept");
      return false;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitBotRiskConsent({
        wallet: address,
        consentVersion: BOT_RISK_CONSENT_VERSION,
      });
      writeLocalBotRiskConsent(address);
      setAccepted(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save consent");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [address]);

  return {
    accepted,
    checked,
    submitting,
    error,
    accept,
    needsWallet: !isConnected || !address,
    consentVersion: BOT_RISK_CONSENT_VERSION,
  };
}
