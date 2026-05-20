import { useEffect } from "react";
import { subscribeEvents } from "../api";
import { getPushPrefs } from "../lib/pushClient";
import { getWatchlist } from "../lib/tokenStorage";

/** Shows in-tab notifications for watchlist events when permission is granted (SSE fallback). */
export function useNotificationBridge(): void {
  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }

    const prefs = getPushPrefs();

    return subscribeEvents((type, data) => {
      const d = data as { token?: string; address?: string; isBuy?: boolean };
      const token = (d.token ?? d.address)?.toLowerCase();
      if (!token) return;

      const watch = getWatchlist().map((w) => w.address);
      if (!watch.includes(token)) return;

      const show = (title: string, body: string, url: string) => {
        if (document.visibilityState === "visible") return;
        try {
          new Notification(title, {
            body,
            tag: `${type}-${token}`,
            data: { url },
          }).onclick = () => {
            window.focus();
            window.location.href = url;
          };
        } catch {
          /* ignore */
        }
      };

      if (type === "trade" && prefs.watchTrades) {
        const side = d.isBuy ? "Buy" : "Sell";
        show(`Watchlist · ${side}`, `Live ${side.toLowerCase()} activity`, `/bot?token=${token}`);
      }

      if (type === "token_graduating" && prefs.gradReady) {
        show("Graduating", "Token is graduating — check before trading", `/token/${token}`);
      }

      if (type === "token_graduated" && prefs.gradReady) {
        show("Graduated", "Token graduated to HyperSwap", `/token/${token}`);
      }
    });
  }, []);
}
