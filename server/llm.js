/**
 * LLM integration layer.
 * Priority: OpenClaw gateway (when configured), then optional HTTP chat backends, or static fallback.
 * Vendor names are not exposed to clients or public API responses.
 */

import dotenv from "dotenv";
import { buildAnalyzeMarketContext } from "./marketData.js";
import WebSocket from "ws";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let provider = "static";
let groqKey = null;
let groqModel = "llama-3.3-70b-versatile";
let openaiKey = null;
let openclawUrl = null;
let openclawToken = null;

const LILA_SYSTEM_PROMPT = `You are LILA — a Neural Terminal AI Agent on the Stellar network.
You deliver paid services via x402 (USDC): chat, market analysis, code, research.
Tone: concise, technical, terminal-friendly. Use ASCII sections where it helps readability.
Domain strengths: Stellar, Soroban, x402, DeFi, agentic systems — but only when relevant to the user's ask.`;

/** Applies to every reply (all services, all providers). */
const LILA_GROUNDING_POLICY = `
## Grounding and relevance (mandatory)
- Do not invent specific prices, volumes, statistics, dates, version numbers, people, URLs, or "live" figures unless they appear explicitly in this conversation (e.g. a [LIVE DATA] block).
- Stay on topic: answer what was asked. If the request is vague, state one short assumption or ask one clarifying question — do not fill pages of unrelated content.
- Separate clearly: (1) facts you can justify from general knowledge, (2) interpretation, (3) speculation — label the last two.
- Never imply you executed trades, accessed private systems, or browsed the web unless the prompt proves it.
- No personalized financial, legal, or medical advice; informational framing only, with "verify independently" where numbers matter.
- If you cannot answer safely, say what is missing and what the user should check instead of guessing.
`;

function buildFullSystemPrompt() {
  return `${LILA_SYSTEM_PROMPT.trim()}

${LILA_GROUNDING_POLICY.trim()}`;
}

/** Lower temperature = less creative invention for factual tasks */
const SERVICE_GEN_OPTS = {
  chat: { temperature: 0.65, max_tokens: 1024 },
  analyze: { temperature: 0.32, max_tokens: 1400 },
  code: { temperature: 0.38, max_tokens: 2560 },
  research: { temperature: 0.42, max_tokens: 1536 },
};

function getGenOpts(service) {
  return SERVICE_GEN_OPTS[service] || SERVICE_GEN_OPTS.chat;
}

// Ed25519 SPKI DER prefix (12 bytes)
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

// Persistent device identity
let devicePrivateKey = null;
let deviceRawPublicKey = null;
let deviceId = null;

const IDENTITY_PATH = path.join(__dirname, "..", ".openclaw-device-identity.json");

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function ensureDeviceIdentity() {
  if (devicePrivateKey) return;

  // Try loading persisted identity
  try {
    if (fs.existsSync(IDENTITY_PATH)) {
      const stored = JSON.parse(fs.readFileSync(IDENTITY_PATH, "utf-8"));
      if (stored?.version === 1 && stored.publicKeyPem && stored.privateKeyPem) {
        const pubKeyObj = crypto.createPublicKey(stored.publicKeyPem);
        devicePrivateKey = crypto.createPrivateKey(stored.privateKeyPem);
        const spkiDer = pubKeyObj.export({ type: "spki", format: "der" });
        deviceRawPublicKey = spkiDer.subarray(ED25519_SPKI_PREFIX.length);
        deviceId = crypto
          .createHash("sha256")
          .update(deviceRawPublicKey)
          .digest("hex");
        console.log(
          `[LLM] Device identity loaded: ${deviceId.slice(0, 16)}...`,
        );
        return;
      }
    }
  } catch (err) {
    console.warn("[LLM] Failed to load device identity:", err.message);
  }

  // Generate new identity
  const keyPair = crypto.generateKeyPairSync("ed25519");
  devicePrivateKey = keyPair.privateKey;
  const spkiDer = keyPair.publicKey.export({ type: "spki", format: "der" });
  deviceRawPublicKey = spkiDer.subarray(ED25519_SPKI_PREFIX.length);
  deviceId = crypto
    .createHash("sha256")
    .update(deviceRawPublicKey)
    .digest("hex");

  // Persist to disk
  try {
    const publicKeyPem = keyPair.publicKey.export({
      type: "spki",
      format: "pem",
    });
    const privateKeyPem = keyPair.privateKey.export({
      type: "pkcs8",
      format: "pem",
    });
    fs.writeFileSync(
      IDENTITY_PATH,
      JSON.stringify(
        {
          version: 1,
          deviceId,
          publicKeyPem,
          privateKeyPem,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    console.log(
      `[LLM] Device identity created and saved: ${deviceId.slice(0, 16)}...`,
    );
  } catch (err) {
    console.warn("[LLM] Could not persist device identity:", err.message);
    console.log(
      `[LLM] Device identity (ephemeral): ${deviceId.slice(0, 16)}...`,
    );
  }
}

export function setupLLM(config = {}) {
  // Reload .env here so keys win over empty shell vars (dotenv default is no override).
  dotenv.config({
    path: fileURLToPath(new URL("../.env", import.meta.url)),
    override: true,
    quiet: true,
  });

  if (config.openclawUrl || process.env.OPENCLAW_GATEWAY_URL) {
    openclawUrl = config.openclawUrl || process.env.OPENCLAW_GATEWAY_URL;
    openclawToken = config.openclawToken || process.env.OPENCLAW_GATEWAY_TOKEN || null;
    provider = "openclaw";
    if (!openclawToken) {
      ensureDeviceIdentity();
    }
    console.log("[LLM] Inference: gateway connected");
    return;
  }

  const groqCandidate = (
    process.env.GROQ_API_KEY ||
    config.groqKey ||
    ""
  ).trim();
  if (groqCandidate) {
    groqKey = groqCandidate;
    const modelEnv = process.env.GROQ_MODEL;
    const modelCfg = config.groqModel;
    if (modelEnv && String(modelEnv).trim()) {
      groqModel = String(modelEnv).trim();
    } else if (modelCfg && String(modelCfg).trim()) {
      groqModel = String(modelCfg).trim();
    }
    provider = "groq";
    console.log("[LLM] Inference: HTTP backend connected");
    return;
  }

  const openaiCandidate = (
    process.env.OPENAI_API_KEY ||
    config.openaiKey ||
    ""
  ).trim();
  if (openaiCandidate) {
    openaiKey = openaiCandidate;
    provider = "openai";
    console.log("[LLM] Inference: HTTP backend connected");
    return;
  }
  console.log("[LLM] Inference: static fallback (no remote LLM configured)");
}

export function getProvider() {
  return provider;
}

export function getDeviceId() {
  return deviceId;
}

export async function generateAIResponse(service, input) {
  let analyzeExtra = "";
  if (service === "analyze") {
    analyzeExtra = await buildAnalyzeMarketContext(input);
  }

  const serviceHints = {
    chat: `User message: "${input}"

Reply directly to this. If they ask for real-time or private data you do not have, say you cannot provide it and name what they could verify (e.g. exchange, explorer, official docs). Do not fabricate metrics.`,
    analyze: `${analyzeExtra}

User request: "${input}"

Write a concise analysis with ASCII section headers. Obey [STRICT RULES] in any LIVE DATA block; never contradict injected numbers. If no live block exists, do not invent market figures — thematic / educational only.`,
    code: `Requirement: "${input}"

Output a Soroban (Rust) contract or Stellar-related code. Use real stellar-sdk / soroban-sdk patterns. Comment uncertain API details; do not invent crate methods or opcodes.`,
    research: `Topic: "${input}"

Produce a structured report: executive summary, sections with clear headers, and a "Limitations" line stating what was not verified. Distinguish established facts from interpretation. Do not invent citations or study statistics; say "not sourced in this session" if needed.`,
  };

  const prompt = `[LILA ${service.toUpperCase()} SERVICE]\n\n${serviceHints[service] || input}`;

  try {
    if (provider === "groq") {
      return await queryGroq(prompt, service);
    }
    if (provider === "openclaw") {
      return await queryOpenClaw(prompt);
    }
    if (provider === "openai") {
      return await queryOpenAI(prompt, service);
    }
  } catch (err) {
    console.error("[LLM] inference error:", err.message);
  }
  return null;
}

// ──────────────────────────────────────────────
//  OpenClaw Gateway (Protocol v3 / device auth v2 payload)
// ──────────────────────────────────────────────

/**
 * Scopes for connect.params.scopes.
 * - Some gateways (e.g. hosted) require explicit operator.write for chat.send; [] can yield "missing scope: operator.write".
 * - Override: OPENCLAW_GATEWAY_SCOPES=operator.read,operator.write
 */
function getOpenClawScopeList(_useDeviceAuth) {
  const raw = process.env.OPENCLAW_GATEWAY_SCOPES;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [
    "operator.admin",
    "operator.read",
    "operator.write",
    "operator.approvals",
    "operator.pairing",
    "operator.talk.secrets",
  ];
}

function signChallenge(nonce) {
  const clientId = "gateway-client";
  const clientMode = "backend";
  const role = "operator";
  const scopes = getOpenClawScopeList(true).join(",");
  const signedAtMs = Date.now();
  const token = openclawToken || "";

  // v2 payload: v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
  const payload = [
    "v2",
    deviceId,
    clientId,
    clientMode,
    role,
    scopes,
    String(signedAtMs),
    token,
    nonce,
  ].join("|");

  const sig = crypto.sign(null, Buffer.from(payload, "utf-8"), devicePrivateKey);

  return {
    signature: base64UrlEncode(sig),
    publicKey: base64UrlEncode(deviceRawPublicKey),
    signedAt: signedAtMs,
  };
}

function queryOpenClaw(userTaskPrompt) {
  const bundled = `${buildFullSystemPrompt()}

--- USER TASK ---

${userTaskPrompt}`;
  const forceDevice =
    process.env.OPENCLAW_CONNECT_WITH_DEVICE === "true" && openclawToken;
  if (forceDevice) {
    ensureDeviceIdentity();
    return attemptOpenClaw(bundled, true);
  }
  return attemptOpenClaw(bundled, !openclawToken);
}

/**
 * @param useDeviceAuth  false when OPENCLAW_GATEWAY_TOKEN is used alone (connect.params.auth.token + URL ?token=); true when signing with Ed25519 device block.
 */
function attemptOpenClaw(prompt, useDeviceAuth) {
  let wsUrl = openclawUrl;
  if (openclawToken) {
    const sep = wsUrl.includes("?") ? "&" : "?";
    wsUrl += `${sep}token=${encodeURIComponent(openclawToken)}`;
  }

  const wsOptions = {};
  if (openclawToken) {
    wsOptions.headers = {
      Authorization: `Bearer ${openclawToken}`,
    };
  }

  return new Promise((resolve, reject) => {
    const TIMEOUT = 60000;
    let response = "";
    let resolved = false;
    let handshakeComplete = false;
    const sessionKey = "agent:main:main";

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    const timer = setTimeout(
      () => done(new Error("Neural gateway timeout (60s)")),
      TIMEOUT,
    );

    const ws = new WebSocket(wsUrl, wsOptions);

    function sendReq(method, params) {
      const id = crypto.randomUUID();
      ws.send(JSON.stringify({ type: "req", id, method, params }));
      return id;
    }

    function buildConnectParams(nonce, useDevice) {
      const base = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "gateway-client",
          version: "4.0.0",
          platform: "linux",
          mode: "backend",
        },
        role: "operator",
        // Token-backed gateways often grant a single admin-equivalent scope; listing read/write alone can leave the session under-scoped.
        scopes: getOpenClawScopeList(useDevice),
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: openclawToken || "" },
        locale: "en-US",
        userAgent: "lila-agent/4.0.0",
      };
      if (useDevice) {
        ensureDeviceIdentity();
        const auth = signChallenge(nonce);
        base.device = {
          id: deviceId,
          publicKey: auth.publicKey,
          signature: auth.signature,
          signedAt: auth.signedAt,
          nonce,
        };
      }
      return base;
    }

    function handleChallenge(payload) {
      const nonce = payload.nonce;
      console.log(
        `[LLM] Handshake: connect.challenge (${useDeviceAuth ? "device+token" : "token-only"})`,
      );
      sendReq("connect", buildConnectParams(nonce, useDeviceAuth));
    }

    function handleHelloOk(payload) {
      handshakeComplete = true;
      const proto = payload.protocol || "?";
      const granted =
        payload.auth?.scopes ||
        payload.features?.scopes ||
        payload.policy?.scopes;
      console.log(
        `[LLM] Handshake complete (protocol ${proto})${granted ? ` scopes=${JSON.stringify(granted)}` : ""}`,
      );

      // chat.send alone — subscribe can fail with same missing-scope if token session is narrow
      sendReq("chat.send", {
        sessionKey,
        message: prompt,
        idempotencyKey: crypto.randomUUID(),
      });
      console.log("[LLM] chat.send dispatched");
    }

    function extractText(obj) {
      if (!obj) return "";
      if (typeof obj === "string") return obj;
      return obj.text || obj.content || obj.message || obj.result || "";
    }

    ws.on("open", () => {
      console.log("[LLM] WebSocket connected to neural gateway");
    });

    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      // ── Pre-connect challenge ──
      if (msg.type === "event" && msg.event === "connect.challenge") {
        handleChallenge(msg.payload);
        return;
      }

      // ── Response frames ──
      if (msg.type === "res") {
        if (msg.ok && msg.payload?.type === "hello-ok") {
          handleHelloOk(msg.payload);
          return;
        }

        if (msg.ok && msg.payload) {
          const text = extractText(msg.payload);
          if (text) {
            response += text;
            done(response);
            return;
          }
        }

        if (!msg.ok && msg.error) {
          const errMsg =
            msg.error.message || msg.error.code || JSON.stringify(msg.error);
          console.error("[LLM] Gateway error:", errMsg);
          if (msg.error.details) {
            console.error(
              "[LLM] Error details:",
              JSON.stringify(msg.error.details),
            );
          }
          if (!handshakeComplete) {
            const canRetryDevice =
              openclawToken &&
              !useDeviceAuth &&
              process.env.OPENCLAW_DEVICE_AUTH_FALLBACK === "true";
            if (canRetryDevice) {
              console.warn(
                "[LLM] Token-only handshake failed — retrying with device auth (OPENCLAW_DEVICE_AUTH_FALLBACK)",
              );
              resolved = true;
              clearTimeout(timer);
              try {
                ws.close();
              } catch {}
              ensureDeviceIdentity();
              attemptOpenClaw(prompt, true).then(resolve).catch(reject);
              return;
            }
            done(new Error(`Gateway handshake failed: ${errMsg}`));
          }
          return;
        }
      }

      // ── Event frames ──
      if (msg.type === "event") {
        const ev = msg.event || "";

        if (ev === "session.message") {
          const p = msg.payload || {};
          if (p.role === "assistant" || p.type === "assistant") {
            const text = extractText(p);
            if (text) {
              response += text;
              if (p.done || p.final || p.finished) done(response);
            }
          }
          return;
        }

        if (
          ev === "chat.token" ||
          ev === "chat.chunk" ||
          ev === "agent.token" ||
          ev === "agent.chunk"
        ) {
          const text = extractText(msg.payload);
          if (text) response += text;
          return;
        }

        if (
          ev === "chat.done" ||
          ev === "chat.complete" ||
          ev === "chat.end" ||
          ev === "agent.done" ||
          ev === "agent.end" ||
          ev === "session.done" ||
          ev === "session.complete"
        ) {
          const text = extractText(msg.payload);
          if (text) response += text;
          if (response) done(response);
          return;
        }

        if (ev === "response") {
          const text = extractText(msg.payload);
          if (text) response += text;
          done(response);
          return;
        }
      }

      // Community API compat
      if (msg.type === "response") {
        const text = extractText(msg.payload || msg);
        if (text) {
          response += text;
          done(response);
        }
      }
    });

    ws.on("error", (err) => {
      console.error("[LLM] gateway WebSocket error:", err.message);
      done(new Error(`Neural gateway connection error: ${err.message}`));
    });

    ws.on("close", (code, reason) => {
      const r = reason ? reason.toString() : "";
      console.log(
        `[LLM] WebSocket closed (code=${code}${r ? `, reason=${r}` : ""})`,
      );
      if (!resolved) {
        if (response) done(response);
        else
          done(
            new Error(
              `Neural gateway connection closed (code=${code}) without response`,
            ),
          );
      }
    });
  });
}

// ──────────────────────────────────────────────
//  Optional HTTP inference backends (not exposed in API/UI)
// ──────────────────────────────────────────────

async function queryGroq(prompt, service = "chat") {
  const opts = getGenOpts(service);
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: groqModel,
      messages: [
        { role: "system", content: buildFullSystemPrompt() },
        { role: "user", content: prompt },
      ],
      max_tokens: opts.max_tokens,
      temperature: opts.temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Inference HTTP error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ──────────────────────────────────────────────
//  Alternate HTTP chat API
// ──────────────────────────────────────────────

async function queryOpenAI(prompt, service = "chat") {
  const opts = getGenOpts(service);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildFullSystemPrompt() },
        { role: "user", content: prompt },
      ],
      max_tokens: opts.max_tokens,
      temperature: opts.temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Inference HTTP error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}
