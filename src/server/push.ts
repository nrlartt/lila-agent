import webpush from "web-push";
import { getDb, getToken } from "../indexer/db.js";

type PushPrefs = {
  watchTrades: boolean;
  gradReady: boolean;
  priceChangePct: number | null;
};

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  wallet: string | null;
  watch_tokens: string;
  alert_trades: number;
  alert_grad: number;
  alert_price_pct: number | null;
};

let vapidReady = false;

export function initPushVapid(): { enabled: boolean; publicKey: string | null } {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:support@lilagent.xyz";

  if (!publicKey || !privateKey) {
    return { enabled: false, publicKey: null };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  ensurePushTable();
  return { enabled: true, publicKey };
}

function ensurePushTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      wallet TEXT,
      watch_tokens TEXT NOT NULL DEFAULT '[]',
      alert_trades INTEGER NOT NULL DEFAULT 1,
      alert_grad INTEGER NOT NULL DEFAULT 1,
      alert_price_pct REAL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export function upsertPushSubscription(opts: {
  endpoint: string;
  p256dh: string;
  auth: string;
  wallet?: string;
  watchTokens: string[];
  prefs: PushPrefs;
}): void {
  ensurePushTable();
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, wallet, watch_tokens, alert_trades, alert_grad, alert_price_pct, updated_at)
       VALUES (@endpoint, @p256dh, @auth, @wallet, @watch_tokens, @alert_trades, @alert_grad, @alert_price_pct, @updated_at)
       ON CONFLICT(endpoint) DO UPDATE SET
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         wallet = excluded.wallet,
         watch_tokens = excluded.watch_tokens,
         alert_trades = excluded.alert_trades,
         alert_grad = excluded.alert_grad,
         alert_price_pct = excluded.alert_price_pct,
         updated_at = excluded.updated_at`,
    )
    .run({
      endpoint: opts.endpoint,
      p256dh: opts.p256dh,
      auth: opts.auth,
      wallet: opts.wallet ?? null,
      watch_tokens: JSON.stringify(opts.watchTokens.map((a) => a.toLowerCase())),
      alert_trades: opts.prefs.watchTrades ? 1 : 0,
      alert_grad: opts.prefs.gradReady ? 1 : 0,
      alert_price_pct: opts.prefs.priceChangePct,
      updated_at: now,
    });
}

export function removePushSubscription(endpoint: string): void {
  ensurePushTable();
  getDb().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

function parseWatchList(raw: string): string[] {
  try {
    const arr = JSON.parse(raw) as string[];
    return arr.map((a) => a.toLowerCase());
  } catch {
    return [];
  }
}

async function sendPush(
  row: SubscriptionRow,
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<void> {
  if (!vapidReady) return;
  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload),
    );
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      removePushSubscription(row.endpoint);
    }
  }
}

export async function handlePushForEvent(event: string, data: unknown): Promise<void> {
  if (!vapidReady) return;
  ensurePushTable();
  const rows = getDb()
    .prepare("SELECT * FROM push_subscriptions")
    .all() as SubscriptionRow[];

  if (rows.length === 0) return;

  const d = data as Record<string, unknown>;
  const tokenAddr = String(d.token ?? d.address ?? "")
    .toLowerCase()
    .trim();
  if (!tokenAddr) return;

  let tokenMeta: { name: string; ticker: string } | null = null;
  try {
    const t = getToken(tokenAddr);
    if (t) tokenMeta = { name: t.name, ticker: t.ticker };
  } catch {
    tokenMeta = { name: "Token", ticker: "?" };
  }

  const label = tokenMeta ? `$${tokenMeta.ticker}` : shortAddr(tokenAddr);

  for (const row of rows) {
    const watch = parseWatchList(row.watch_tokens);
    if (!watch.includes(tokenAddr)) continue;

    if (event === "trade" && row.alert_trades) {
      const isBuy = Boolean(d.isBuy);
      await sendPush(row, {
        title: `${label} · ${isBuy ? "Buy" : "Sell"}`,
        body: `Live ${isBuy ? "buy" : "sell"} on a watchlist token`,
        url: `/bot?token=${tokenAddr}`,
        tag: `trade-${tokenAddr}`,
      });
    }

    if (event === "token_graduating" && row.alert_grad) {
      await sendPush(row, {
        title: `${label} graduating`,
        body: "Liquidity seeding soon — trading may pause briefly",
        url: `/token/${tokenAddr}`,
        tag: `grad-${tokenAddr}`,
      });
    }

    if (event === "token_graduated" && row.alert_grad) {
      await sendPush(row, {
        title: `${label} graduated`,
        body: "Now trading on HyperSwap",
        url: `/token/${tokenAddr}`,
        tag: `graduated-${tokenAddr}`,
      });
    }
  }
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
