import { type Address } from "viem";
import { createTradingWallet } from "./chain.js";
import { parsePrivateKey } from "./config.js";

type Session = {
  privateKey: `0x${string}`;
  wallet: ReturnType<typeof createTradingWallet>;
  connectedAt: number;
};

const sessions = new Map<number, Session>();

export function hasSession(chatId: number): boolean {
  return sessions.has(chatId);
}

export function setSession(chatId: number, privateKey: `0x${string}`): Address {
  const wallet = createTradingWallet(privateKey);
  sessions.set(chatId, {
    privateKey,
    wallet,
    connectedAt: Date.now(),
  });
  return wallet.address;
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId);
}

export function getSession(chatId: number): Session {
  const session = sessions.get(chatId);
  if (!session) {
    throw new Error("No wallet connected. Use /wallet in a private chat first.");
  }
  return session;
}

export function connectFromInput(chatId: number, keyInput: string): Address {
  const privateKey = parsePrivateKey(keyInput);
  return setSession(chatId, privateKey);
}

export function activeSessionCount(): number {
  return sessions.size;
}
