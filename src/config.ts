import "dotenv/config";
import { type Address, isAddress } from "viem";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function optionalAddress(name: string): Address | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if (!isAddress(value)) {
    throw new Error(`Invalid address in ${name}: ${value}`);
  }
  return value;
}

export function getRpcUrl(): string {
  return process.env.RPC_URL?.trim() || "https://rpc.hyperliquid.xyz/evm";
}

export function getSlippageBps(): number {
  const pct = Number(process.env.SLIPPAGE_PERCENT ?? "10");
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
    throw new Error("SLIPPAGE_PERCENT must be between 0 and 50");
  }
  return Math.round(pct * 100);
}

export function getReferrerAddress(): Address {
  const ref = optionalAddress("REFERRER_ADDRESS");
  if (!ref) {
    throw new Error("REFERRER_ADDRESS is required (your referral earnings wallet)");
  }
  return ref;
}

export function getTelegramToken(): string {
  return requireEnv("TELEGRAM_BOT_TOKEN");
}

export function getBotPublicUrl(): string | undefined {
  return optionalEnv("BOT_PUBLIC_URL");
}

export function getPrivateKeyFromEnv(): `0x${string}` {
  const pk = requireEnv("PRIVATE_KEY");
  return parsePrivateKey(pk);
}

export function parsePrivateKey(input: string): `0x${string}` {
  const normalized = input.trim().startsWith("0x")
    ? input.trim()
    : `0x${input.trim()}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Invalid private key format");
  }
  return normalized as `0x${string}`;
}

export function validateBotEnv(): void {
  getTelegramToken();
  getReferrerAddress();
}

export function validateCliEnv(): void {
  getPrivateKeyFromEnv();
  getReferrerAddress();
}
