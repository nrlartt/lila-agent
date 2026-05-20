import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  fetchPushConfig,
  getPushPrefs,
  setPushPrefs,
  subscribeToPush,
  unsubscribeFromPush,
  type PushAlertPrefs,
} from "../lib/pushClient";

export function PushSettings({ compact }: { compact?: boolean }) {
  const { address } = useAccount();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverPush, setServerPush] = useState(false);
  const [prefs, setPrefs] = useState<PushAlertPrefs>(getPushPrefs);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    fetchPushConfig().then((c) => setServerPush(c.enabled));
    setEnabled(
      typeof Notification !== "undefined" && Notification.permission === "granted",
    );
  }, []);

  const savePrefs = (next: PushAlertPrefs) => {
    setPrefs(next);
    setPushPrefs(next);
  };

  const enable = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await subscribeToPush(address, prefs);
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
      setEnabled(ok || Notification.permission === "granted");
    } finally {
      setLoading(false);
    }
  }, [address, prefs]);

  const disable = useCallback(async () => {
    setLoading(true);
    try {
      await unsubscribeFromPush();
      setEnabled(false);
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
    } finally {
      setLoading(false);
    }
  }, []);

  if (permission === "unsupported") return null;

  return (
    <div className={`push-settings ${compact ? "push-settings--compact" : ""}`}>
      <div className="push-settings__head">
        <strong>Push alerts</strong>
        {!serverPush && (
          <span className="muted" style={{ fontSize: "0.72rem" }}>
            SSE fallback (tab background)
          </span>
        )}
      </div>

      <label className="push-settings__row">
        <input
          type="checkbox"
          checked={prefs.watchTrades}
          onChange={(e) => savePrefs({ ...prefs, watchTrades: e.target.checked })}
        />
        Watchlist trades
      </label>
      <label className="push-settings__row">
        <input
          type="checkbox"
          checked={prefs.gradReady}
          onChange={(e) => savePrefs({ ...prefs, gradReady: e.target.checked })}
        />
        Graduation events
      </label>

      {!enabled ? (
        <button type="button" className="btn btn--primary" disabled={loading} onClick={enable}>
          {loading ? "…" : "Enable notifications"}
        </button>
      ) : (
        <button type="button" className="btn btn--ghost" disabled={loading} onClick={disable}>
          Disable notifications
        </button>
      )}
    </div>
  );
}
