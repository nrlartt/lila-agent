import { getWatchlist } from "./tokenStorage";

export type PushAlertPrefs = {
  watchTrades: boolean;
  gradReady: boolean;
  priceChangePct: number | null;
};

const PREFS_KEY = "alt_push_prefs";

export function getPushPrefs(): PushAlertPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return { watchTrades: true, gradReady: true, priceChangePct: null };
    }
    return JSON.parse(raw) as PushAlertPrefs;
  } catch {
    return { watchTrades: true, gradReady: true, priceChangePct: null };
  }
}

export function setPushPrefs(prefs: PushAlertPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const API = import.meta.env.VITE_API_URL || "";

export async function fetchPushConfig(): Promise<{
  enabled: boolean;
  publicKey: string | null;
}> {
  const res = await fetch(`${API}/api/push/config`);
  if (!res.ok) return { enabled: false, publicKey: null };
  return res.json();
}

export async function subscribeToPush(
  wallet: string | undefined,
  prefs: PushAlertPrefs,
): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const config = await fetchPushConfig();
  if (!config.enabled || !config.publicKey) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource,
    });
  }

  const watchTokens = getWatchlist().map((t) => t.address);

  const res = await fetch(`${API}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      wallet: wallet?.toLowerCase(),
      watchTokens,
      prefs,
    }),
  });

  return res.ok;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch(`${API}/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
}

export async function syncPushWatchlist(wallet?: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await fetch(`${API}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      wallet: wallet?.toLowerCase(),
      watchTokens: getWatchlist().map((t) => t.address),
      prefs: getPushPrefs(),
    }),
  });
}
