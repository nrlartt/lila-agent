#!/usr/bin/env node
/**
 * One-shot: copy skills/lila-openclaw into ~/.openclaw/skills and print the exact
 * `openclaw mcp set lila` command (cwd = this repo). Run from repository root.
 *
 * Usage:
 *   node scripts/openclaw-bootstrap.mjs
 *   node scripts/openclaw-bootstrap.mjs --base-url=https://lilagent.xyz
 *
 * Env:
 *   OPENCLAW_HOME: default ~/.openclaw
 *   LILA_BASE_URL: default https://lilagent.xyz (overridden by --base-url=)
 *
 * Note: STELLAR_PAY_TO / STELLAR_AGENT_SECRET belong on the LILA API server.
 * MCP clients must add LILA_PAYER_SECRET to the `env` above (or set
 * LILA_ALLOW_SERVER_AGENT_QUERY=true for local dev only).
 */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const skillSrc = path.join(repoRoot, "skills", "lila-openclaw");

const argBase = process.argv.find((a) => a.startsWith("--base-url="));
const baseUrl = argBase
  ? argBase.split("=")[1]?.trim()
  : (process.env.LILA_BASE_URL || "https://lilagent.xyz").trim();

const openclawHome = process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw");
const skillDest = path.join(openclawHome, "skills", "lila-openclaw");

if (!fs.existsSync(skillSrc)) {
  console.error("[lila] skills/lila-openclaw not found. Run this script from the lila-agent repo root.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(skillDest), { recursive: true });
fs.cpSync(skillSrc, skillDest, { recursive: true });
console.log(`[lila] Skill copied to: ${skillDest}`);

const mcpFragment = {
  command: "node",
  args: ["mcp/lila-server.mjs"],
  cwd: repoRoot,
  env: { LILA_BASE_URL: baseUrl },
};

const json = JSON.stringify(mcpFragment);
console.log("\n[lila] Register MCP (restart OpenClaw gateway after):\n");
console.log(`openclaw mcp set lila ${JSON.stringify(json)}`);
console.log("\n[lila] LILA_BASE_URL for this fragment:", baseUrl);
console.log(
  "[lila] Add LILA_PAYER_SECRET to OpenClaw mcp.servers.lila.env so lila_query pays from your wallet (merge into the JSON above).\n"
);
console.log(
  "[lila] API server: STELLAR_PAY_TO etc. on Railway; dev-only fallback: LILA_ALLOW_SERVER_AGENT_QUERY=true.\n"
);
