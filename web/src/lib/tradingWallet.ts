import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address } from "viem";

export function createTradingPrivateKey(): `0x${string}` {
  return generatePrivateKey();
}

export function addressFromPrivateKey(privateKey: `0x${string}`): Address {
  return privateKeyToAccount(privateKey).address;
}

export function parsePrivateKeyInput(input: string): `0x${string}` {
  const hex = input.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Invalid private key (64 hex characters expected)");
  }
  return `0x${hex}` as `0x${string}`;
}
