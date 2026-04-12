/**
 * One-shot OpenClaw connectivity test (uses .env OPENCLAW_GATEWAY_*).
 * Run: node scripts/test-openclaw.mjs
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { setupLLM, generateAIResponse, getProvider } from "../server/llm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const url = process.env.OPENCLAW_GATEWAY_URL || "";
const token = process.env.OPENCLAW_GATEWAY_TOKEN || null;

if (!url) {
  console.error("OPENCLAW_GATEWAY_URL is not set");
  process.exit(1);
}

setupLLM({ openclawUrl: url, openclawToken: token });

console.log("Provider:", getProvider());
console.log("Gateway URL:", url.replace(/^(wss?:\/\/)[^/]+/i, "$1<host>"));

try {
  const text = await generateAIResponse("chat", "Reply with exactly: OK");
  if (text && String(text).trim()) {
    console.log("OK. Reply length:", String(text).length);
    console.log("Preview:", String(text).slice(0, 200).replace(/\n/g, " "));
    process.exit(0);
  }
  console.error("Empty or null response from LLM");
  process.exit(2);
} catch (e) {
  console.error("FAIL:", e.message);
  process.exit(1);
}
