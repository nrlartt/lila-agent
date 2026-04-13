/**
 * External-agent only: imported from mcp/lila-server.mjs (never from server/index.js).
 * Optional: load or auto-create a Stellar payer key for MCP (like browser demos that
 * attach a wallet before chat). Secrets never go to stdout — only stderr notices.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { envBool } from "./envBool.mjs";

async function maybeAutoSetupTestnetPayer() {
  const secret = process.env.LILA_PAYER_SECRET?.trim();
  if (!secret || !envBool(process.env.LILA_AUTO_SETUP_TESTNET_PAYER)) return;

  const net = process.env.STELLAR_NETWORK || "stellar:testnet";
  if (!String(net).includes("testnet")) {
    console.error(
      "[lila-mcp] LILA_AUTO_SETUP_TESTNET_PAYER applies only to stellar:testnet — skipping.",
    );
    return;
  }

  try {
    const { setupTestnetPayerWallet } = await import("./stellarTestnetPayerSetup.mjs");
    await setupTestnetPayerWallet(secret);
  } catch (err) {
    console.error(
      "[lila-mcp] LILA_AUTO_SETUP_TESTNET_PAYER failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function bootstrapPayerWallet() {
  const rawAuto = process.env.LILA_AUTO_CREATE_PAYER_WALLET;

  if (!process.env.LILA_PAYER_SECRET?.trim()) {
    const autoCreate = envBool(rawAuto);
    if (rawAuto !== undefined && rawAuto !== "" && !autoCreate) {
      console.error(
        `[lila-mcp] bootstrapPayerWallet: LILA_AUTO_CREATE_PAYER_WALLET=${JSON.stringify(rawAuto)} is not a true value — use true/1/yes/on (case-insensitive).`,
      );
    }

    const explicitFile = process.env.LILA_PAYER_SECRET_FILE?.trim();
    const openclawHome = process.env.OPENCLAW_HOME?.trim() || path.join(os.homedir(), ".openclaw");
    const defaultPath = path.join(openclawHome, "lila-payer.secret");
    const filePath = explicitFile || (autoCreate ? defaultPath : null);

    if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          const secret = fs.readFileSync(filePath, "utf8").trim();
          if (secret) {
            process.env.LILA_PAYER_SECRET = secret;
            process.env.LILA_MCP_PAYER_SOURCE = "file";
            console.error(`[lila-mcp] Loaded payer wallet from ${filePath}`);
          }
        } else if (autoCreate) {
          const { Keypair } = await import("@stellar/stellar-sdk");
          const kp = Keypair.random();
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, kp.secret(), { mode: 0o600 });
          process.env.LILA_PAYER_SECRET = kp.secret();
          process.env.LILA_MCP_PAYER_SOURCE = "auto_created";
          const net = process.env.STELLAR_NETWORK || "stellar:testnet";
          console.error(
            `[lila-mcp] Auto-created payer wallet G=${kp.publicKey()} — secret saved to ${filePath}. Network: ${net}.`,
          );
        }
      } catch (err) {
        console.error(
          "[lila-mcp] bootstrapPayerWallet:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  } else {
    process.env.LILA_MCP_PAYER_SOURCE = process.env.LILA_MCP_PAYER_SOURCE || "env";
  }

  await maybeAutoSetupTestnetPayer();
}
