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

function mergeTemplate(template, existing, defaults = {}) {
  return (
    template
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line;
        const i = trimmed.indexOf("=");
        if (i <= 0) return line;
        const key = trimmed.slice(0, i);
        const def = defaults[key] ?? trimmed.slice(i + 1);
        const cur = existing.get(key);
        if (cur != null && cur !== "") return `${key}=${cur}`;
        return `${key}=${def}`;
      })
      .join("\n") + "\n"
  );
}

const rootTemplate = `# =============================================================================
# Lila Agent — server / Railway (lilagent.xyz)
# Secrets: fill TELEGRAM_BOT_TOKEN, CONSENT_IP_SALT, VAPID_* , PRIVATE_KEY
# =============================================================================

# HyperEVM RPC — production: use a dedicated RPC URL on Railway
RPC_URL=

# Referral wallet (0x…) — credited on user BUYs; required for web + bot
REFERRER_ADDRESS=

SLIPPAGE_PERCENT=10

# === Telegram bot (optional second Railway service) ===
TELEGRAM_BOT_TOKEN=

# === Web platform (API + indexer) ===
PORT=3000
DATA_DIR=./data
BOT_PUBLIC_URL=https://lilagent.xyz

# Risk consent — long random string (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CONSENT_IP_SALT=

# === Web push (optional) ===
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@lilagent.xyz

# === CLI only (optional) ===
PRIVATE_KEY=

# === Indexer (optional — defaults OK for dev) ===
ALTFUN_API_URL=https://api.alt.fun
INDEXER_START_BLOCK=
INDEXER_BLOCK_CHUNK=10
INDEXER_RPC_PAUSE_MS=2500
INDEXER_ENRICH_BATCH=15
CATALOG_REFRESH_SEC=600
CATALOG_PAGE_DELAY_MS=150
ACTIVITY_POLL_MS=4000
ACTIVITY_TRADE_LIMIT=50
ACTIVITY_REFRESH_MS=2000
`;

const webTemplate = `# =============================================================================
# Lila Agent — Vite build-time (Railway: set BEFORE deploy / rebuild)
# Must match server .env where noted
# =============================================================================

VITE_SITE_URL=https://lilagent.xyz

# Empty = same origin (recommended when API + web on one Railway service)
VITE_API_URL=

# Match server RPC_URL
VITE_RPC_URL=

# Match server REFERRER_ADDRESS
VITE_REFERRER_ADDRESS=

VITE_MEDIA_BASE_URL=https://api.alt.fun

# BotFather username without @ (optional)
VITE_TELEGRAM_BOT_USERNAME=
`;

const rootDefaults = {
  RPC_URL: "https://rpc.hyperliquid.xyz/evm",
  SLIPPAGE_PERCENT: "10",
  PORT: "3000",
  DATA_DIR: "./data",
  BOT_PUBLIC_URL: "https://lilagent.xyz",
  VAPID_SUBJECT: "mailto:support@lilagent.xyz",
  ALTFUN_API_URL: "https://api.alt.fun",
  INDEXER_BLOCK_CHUNK: "10",
  INDEXER_RPC_PAUSE_MS: "2500",
  INDEXER_ENRICH_BATCH: "15",
  CATALOG_REFRESH_SEC: "600",
  CATALOG_PAGE_DELAY_MS: "150",
  ACTIVITY_POLL_MS: "4000",
  ACTIVITY_TRADE_LIMIT: "50",
  ACTIVITY_REFRESH_MS: "2000",
};

const webDefaults = {
  VITE_SITE_URL: "https://lilagent.xyz",
  VITE_API_URL: "",
  VITE_RPC_URL: "https://rpc.hyperliquid.xyz/evm",
  VITE_MEDIA_BASE_URL: "https://api.alt.fun",
};

const rootExisting = loadEnv(".env");
const webExisting = loadEnv(path.join("web", ".env"));

// Sync non-secret cross-file values from server if already set
if (rootExisting.get("RPC_URL")?.trim()) {
  webDefaults.VITE_RPC_URL = rootExisting.get("RPC_URL").trim();
}
if (rootExisting.get("REFERRER_ADDRESS")?.trim()) {
  webDefaults.VITE_REFERRER_ADDRESS = rootExisting.get("REFERRER_ADDRESS").trim();
}

writeFileSync(".env", mergeTemplate(rootTemplate, rootExisting, rootDefaults));

const webPath = path.join("web", ".env");
writeFileSync(webPath, mergeTemplate(webTemplate, webExisting, webDefaults));

// Report key names only (no values)
const filled = (file, secrets) => {
  const m = loadEnv(file);
  for (const [k, v] of Object.entries(
    file === ".env" ? rootDefaults : webDefaults,
  )) {
    if (m.get(k) === v) process.stdout.write(`${file}:${k} `);
  }
  for (const k of secrets) {
    if (m.get(k)?.trim()) process.stdout.write(`${file}:${k}(set) `);
  }
};

filled(".env", [
  "TELEGRAM_BOT_TOKEN",
  "CONSENT_IP_SALT",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "REFERRER_ADDRESS",
  "PRIVATE_KEY",
]);
filled("web/.env", ["VITE_REFERRER_ADDRESS", "VITE_TELEGRAM_BOT_USERNAME"]);
console.log("\nDone.");
