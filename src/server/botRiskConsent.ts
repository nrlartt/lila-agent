import { createHash } from "node:crypto";
import { getDb } from "../indexer/db.js";

export const BOT_RISK_CONSENT_VERSION = "2026-05-19-v1";

export type BotRiskConsentRecord = {
  wallet: string;
  acceptedAt: number;
  consentVersion: string;
};

let schemaReady = false;

export function ensureBotRiskConsentSchema(): void {
  if (schemaReady) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS bot_risk_consent (
      wallet TEXT PRIMARY KEY,
      accepted_at INTEGER NOT NULL,
      consent_version TEXT NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_hash TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_bot_risk_consent_at ON bot_risk_consent(accepted_at DESC);
  `);
  schemaReady = true;
}

export function getBotRiskConsent(
  wallet: string,
  version: string = BOT_RISK_CONSENT_VERSION,
): BotRiskConsentRecord | null {
  ensureBotRiskConsentSchema();
  const row = getDb()
    .prepare(
      `SELECT wallet, accepted_at, consent_version
       FROM bot_risk_consent
       WHERE wallet = ? AND consent_version = ?`,
    )
    .get(wallet.toLowerCase(), version) as
    | { wallet: string; accepted_at: number; consent_version: string }
    | undefined;

  if (!row) return null;
  return {
    wallet: row.wallet,
    acceptedAt: row.accepted_at,
    consentVersion: row.consent_version,
  };
}

export function hasBotRiskConsent(
  wallet: string,
  version: string = BOT_RISK_CONSENT_VERSION,
): boolean {
  return getBotRiskConsent(wallet, version) !== null;
}

export function recordBotRiskConsent(opts: {
  wallet: string;
  version: string;
  userAgent: string;
  ipHash: string;
}): BotRiskConsentRecord {
  ensureBotRiskConsentSchema();
  const wallet = opts.wallet.toLowerCase();
  const acceptedAt = Math.floor(Date.now() / 1000);

  getDb()
    .prepare(
      `INSERT INTO bot_risk_consent (wallet, accepted_at, consent_version, user_agent, ip_hash)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(wallet) DO UPDATE SET
         accepted_at = excluded.accepted_at,
         consent_version = excluded.consent_version,
         user_agent = excluded.user_agent,
         ip_hash = excluded.ip_hash`,
    )
    .run(
      wallet,
      acceptedAt,
      opts.version,
      opts.userAgent.slice(0, 512),
      opts.ipHash,
    );

  return { wallet, acceptedAt, consentVersion: opts.version };
}

export function hashClientIp(ip: string): string {
  const salt = process.env.CONSENT_IP_SALT ?? "alt-bot-consent";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "";
  return headers.get("x-real-ip") ?? "";
}
