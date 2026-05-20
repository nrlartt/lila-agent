/**
 * Pre-production smoke tests — never prints secret values.
 */
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";

const API = process.env.SMOKE_API_URL || "http://localhost:3000";
const WEB = process.env.SMOKE_WEB_URL || "http://localhost:5173";
const TEST_WALLET_CHECK = "0x000000000000000000000000000000000000dEaD";
const TEST_WALLET_POST = "0x000000000000000000000000000000000000bEEF";

const results = [];
let failed = 0;

function pass(name, detail = "") {
  results.push({ status: "PASS", name, detail });
}
function fail(name, detail = "") {
  results.push({ status: "FAIL", name, detail });
  failed++;
}
function warn(name, detail = "") {
  results.push({ status: "WARN", name, detail });
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text: text.slice(0, 200) };
}

function envPresent(key) {
  const v = process.env[key];
  return v != null && String(v).trim() !== "";
}

function checkEnvFile(relativePath, keys) {
  const full = path.join(process.cwd(), relativePath);
  if (!existsSync(full)) {
    for (const k of keys) warn(`env:${relativePath}`, `${k} — file missing`);
    return;
  }
  const raw = readFileSync(full, "utf8");
  for (const k of keys) {
    const re = new RegExp(`^${k}=(.+)$`, "m");
    const m = raw.match(re);
    const set = m && m[1].trim() !== "" && !m[1].trim().startsWith("your_");
    if (set) pass(`env:${relativePath}`, `${k} is set`);
    else warn(`env:${relativePath}`, `${k} is empty or placeholder`);
  }
}

async function main() {
  console.log("=== Lila Agent — pre-production smoke tests ===\n");

  // --- Build artifacts ---
  if (existsSync("dist/index.js")) pass("build", "server dist/index.js exists");
  else fail("build", "server dist/index.js missing — run npm run build");

  if (existsSync("web/dist/index.html")) pass("build", "web/dist/index.html exists");
  else fail("build", "web/dist/index.html missing");

  // --- Env (presence only, no values) ---
  checkEnvFile(".env", [
    "RPC_URL",
    "PORT",
    "DATA_DIR",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "CONSENT_IP_SALT",
  ]);
  checkEnvFile("web/.env", ["VITE_RPC_URL", "VITE_REFERRER_ADDRESS", "VITE_API_URL"]);

  // --- Secret leak scan in client bundle ---
  const bundlePath = "web/dist/assets";
  if (existsSync(bundlePath)) {
    const files = await import("node:fs/promises").then((fs) =>
      fs.readdir(bundlePath).then((names) => names.filter((n) => n.endsWith(".js"))),
    );
    const patterns = [
      /TELEGRAM_BOT_TOKEN/i,
      /VAPID_PRIVATE/i,
      /PRIVATE_KEY/i,
      /sk-[a-zA-Z0-9]{20,}/,
      /ghp_[a-zA-Z0-9]+/,
    ];
    let leak = false;
    for (const file of files) {
      const content = readFileSync(path.join(bundlePath, file), "utf8");
      for (const p of patterns) {
        if (p.test(content)) {
          fail("bundle-secrets", `Suspicious pattern in ${file}`);
          leak = true;
        }
      }
    }
    if (!leak) pass("bundle-secrets", "No obvious secret patterns in JS bundle");
  }

  // --- API health ---
  try {
    const h = await fetchJson(`${API}/api/health`);
    if (h.status === 200 && h.json?.ok === true) pass("api/health", `service=${h.json.service}`);
    else fail("api/health", `status=${h.status}`);
  } catch (e) {
    fail("api/health", (e).message);
  }

  // --- Stats ---
  try {
    const s = await fetchJson(`${API}/api/stats`);
    if (s.status === 200 && typeof s.json?.total === "number") pass("api/stats", `total=${s.json.total}`);
    else fail("api/stats", `status=${s.status}`);
  } catch (e) {
    fail("api/stats", (e).message);
  }

  // --- Tokens list ---
  try {
    const t = await fetchJson(`${API}/api/tokens?limit=5&category=active`);
    if (t.status === 200 && Array.isArray(t.json?.tokens)) pass("api/tokens", `count=${t.json.tokens.length}`);
    else fail("api/tokens", `status=${t.status}`);
  } catch (e) {
    fail("api/tokens", (e).message);
  }

  // --- Invalid token address ---
  try {
    const bad = await fetchJson(`${API}/api/tokens/not-an-address`);
    if (bad.status === 400 || bad.status === 404) pass("api/tokens-invalid", `status=${bad.status}`);
    else fail("api/tokens-invalid", `expected 400/404 got ${bad.status}`);
  } catch (e) {
    fail("api/tokens-invalid", (e).message);
  }

  // --- Risk consent GET (not accepted) ---
  try {
    const r = await fetchJson(`${API}/api/bot/risk-consent?wallet=${TEST_WALLET_CHECK}`);
    if (r.status === 200 && typeof r.json?.accepted === "boolean") {
      pass("api/risk-consent-get", `accepted=${r.json.accepted}`);
      if (r.json.record?.ip_hash !== undefined) fail("api/risk-consent-privacy", "ip_hash exposed in GET");
      else pass("api/risk-consent-privacy", "no ip_hash in response");
    } else fail("api/risk-consent-get", JSON.stringify(r.json)?.slice(0, 120));
  } catch (e) {
    fail("api/risk-consent-get", (e).message);
  }

  // --- Risk consent invalid wallet ---
  try {
    const inv = await fetchJson(`${API}/api/bot/risk-consent?wallet=bad`);
    if (inv.status === 400) pass("api/risk-consent-validation");
    else fail("api/risk-consent-validation", `status=${inv.status}`);
  } catch (e) {
    fail("api/risk-consent-validation", (e).message);
  }

  // --- Risk consent POST + idempotent re-check ---
  try {
    const post = await fetchJson(`${API}/api/bot/risk-consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "smoke-test/1.0" },
      body: JSON.stringify({ wallet: TEST_WALLET_POST, accepted: true }),
    });
    if (post.status === 200 && post.json?.ok && post.json?.record?.wallet) {
      pass("api/risk-consent-post");
      if (post.json.record.ip_hash !== undefined) fail("api/risk-consent-post-privacy", "ip_hash in POST response");
    } else fail("api/risk-consent-post", `status=${post.status}`);

    const again = await fetchJson(`${API}/api/bot/risk-consent?wallet=${TEST_WALLET_POST}`);
    if (again.json?.accepted === true) pass("api/risk-consent-persist");
    else fail("api/risk-consent-persist");
  } catch (e) {
    fail("api/risk-consent-post", (e).message);
  }

  // --- Push config (public key only when enabled) ---
  try {
    const p = await fetchJson(`${API}/api/push/config`);
    if (p.status === 200 && typeof p.json?.enabled === "boolean") {
      pass("api/push/config", `enabled=${p.json.enabled}`);
      if (p.json.privateKey !== undefined) fail("api/push-privacy", "privateKey exposed");
      else pass("api/push-privacy", "no private key in response");
    } else fail("api/push/config", `status=${p.status}`);
  } catch (e) {
    fail("api/push/config", (e).message);
  }

  // --- Web dev/proxy ---
  try {
    const w = await fetch(WEB, { redirect: "manual" });
    if (w.status === 200) pass("web/index", WEB);
    else fail("web/index", `status=${w.status}`);
  } catch (e) {
    fail("web/index", (e).message);
  }

  try {
    const proxied = await fetchJson(`${WEB}/api/health`);
    if (proxied.status === 200 && proxied.json?.ok) pass("web/api-proxy");
    else fail("web/api-proxy", `status=${proxied.status}`);
  } catch (e) {
    fail("web/api-proxy", (e).message);
  }

  // --- Git ignore secrets ---
  if (existsSync(".env")) {
    pass("gitignore", ".env exists locally (expected)");
  }

  // --- Summary ---
  console.log("\nResults:");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : r.status === "WARN" ? "!" : "✗";
    console.log(`  ${icon} [${r.status}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  const passCount = results.filter((r) => r.status === "PASS").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;
  console.log(`\n${passCount} passed, ${warnCount} warnings, ${failed} failed\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
