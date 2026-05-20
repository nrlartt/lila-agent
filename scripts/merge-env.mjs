import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

function loadEnv(file) {
  const map = new Map();
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    map.set(trimmed.slice(0, i), trimmed.slice(i + 1));
  }
  return map;
}

function mergeTemplate(template, existing) {
  return (
    template
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line;
        const i = trimmed.indexOf("=");
        if (i <= 0) return line;
        const key = trimmed.slice(0, i);
        const def = trimmed.slice(i + 1);
        const cur = existing.get(key);
        if (cur != null && cur !== "") return `${key}=${cur}`;
        return `${key}=${def}`;
      })
      .join("\n") + "\n"
  );
}

const rootTemplate = `# HyperEVM RPC (chain id 999) — production: use a dedicated RPC
RPC_URL=

# Referral wallet — credited on every user BUY
REFERRER_ADDRESS=

# Default slippage % (10 = 10%)
SLIPPAGE_PERCENT=10

# === Telegram bot (separate service: npm run start:bot) ===
TELEGRAM_BOT_TOKEN=

# === Web platform (API + indexer) — lilagent.xyz ===
PORT=3000
DATA_DIR=./data
BOT_PUBLIC_URL=https://lilagent.xyz

# Risk consent IP salt — long random string in production
CONSENT_IP_SALT=

# === Web push (optional) — npx web-push generate-vapid-keys ===
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@lilagent.xyz

# === CLI only (optional: npm run start:cli) ===
PRIVATE_KEY=

# === Indexer tuning (optional) ===
ALTFUN_API_URL=https://api.alt.fun
INDEXER_START_BLOCK=
INDEXER_BLOCK_CHUNK=
INDEXER_RPC_PAUSE_MS=
INDEXER_ENRICH_BATCH=
CATALOG_REFRESH_SEC=
CATALOG_PAGE_DELAY_MS=
ACTIVITY_POLL_MS=
ACTIVITY_TRADE_LIMIT=
ACTIVITY_REFRESH_MS=
`;

const webTemplate = `# Build-time (Vite) — set before npm run build / Railway Variables
VITE_SITE_URL=https://lilagent.xyz
VITE_API_URL=
VITE_RPC_URL=
VITE_REFERRER_ADDRESS=
VITE_MEDIA_BASE_URL=https://api.alt.fun
VITE_TELEGRAM_BOT_USERNAME=
`;

const rootExisting = loadEnv(".env");
writeFileSync(".env", mergeTemplate(rootTemplate, rootExisting));

const webPath = path.join("web", ".env");
const webExisting = loadEnv(webPath);
writeFileSync(webPath, mergeTemplate(webTemplate, webExisting));

console.log(`.env: ${loadEnv(".env").size} keys`);
console.log(`web/.env: ${loadEnv(webPath).size} keys`);
