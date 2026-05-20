export const BOT_RISK_CONSENT_VERSION = "2026-05-19-v1";

const CACHE_PREFIX = "alt_bot_risk_consent_v1_";

export function localConsentKey(wallet: string, version: string): string {
  return `${CACHE_PREFIX}${wallet.toLowerCase()}_${version}`;
}

export function readLocalBotRiskConsent(
  wallet: string,
  version: string = BOT_RISK_CONSENT_VERSION,
): boolean {
  try {
    return localStorage.getItem(localConsentKey(wallet, version)) === "1";
  } catch {
    return false;
  }
}

export function writeLocalBotRiskConsent(
  wallet: string,
  version: string = BOT_RISK_CONSENT_VERSION,
): void {
  localStorage.setItem(localConsentKey(wallet, version), "1");
}
