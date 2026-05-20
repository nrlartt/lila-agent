import type { Address } from "viem";
import { addressFromPrivateKey } from "./tradingWallet";

/** Persisted trading wallets keyed by connected main-wallet address (lowercase). */
const PROFILES_KEY = "alt_trading_wallet_profiles_v1";

/** Legacy keys — migrated on load when possible. */
const LEGACY_META_KEY = "alt_trading_wallet_meta_v1";
const LEGACY_SESSION_KEY = "alt_trading_wallet_session_v1";

export type TradingWalletProfile = {
  privateKey: `0x${string}`;
  address: Address;
  ownerAddress: Address;
  updatedAt: number;
};

type ProfileStore = Record<string, TradingWalletProfile>;

function readStore(): ProfileStore {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ProfileStore;
  } catch {
    return {};
  }
}

function writeStore(store: ProfileStore): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
}

export function loadPersistedTradingWallet(
  ownerAddress: Address,
): TradingWalletProfile | null {
  const key = ownerAddress.toLowerCase();
  const store = readStore();
  const profile = store[key];
  if (!profile?.privateKey?.startsWith("0x")) return null;
  return profile;
}

export function savePersistedTradingWallet(
  ownerAddress: Address,
  privateKey: `0x${string}`,
  tradingAddress: Address,
): void {
  const key = ownerAddress.toLowerCase();
  const store = readStore();
  store[key] = {
    privateKey,
    address: tradingAddress,
    ownerAddress,
    updatedAt: Date.now(),
  };
  writeStore(store);
  clearLegacyStorage();
}

export function clearPersistedTradingWallet(ownerAddress: Address): void {
  const key = ownerAddress.toLowerCase();
  const store = readStore();
  delete store[key];
  writeStore(store);
}

/** Migrate old session/meta storage after user connects main wallet. */
export function migrateLegacyTradingWallet(
  ownerAddress: Address,
): TradingWalletProfile | null {
  const existing = loadPersistedTradingWallet(ownerAddress);
  if (existing) return existing;

  try {
    const sessionRaw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    const metaRaw = localStorage.getItem(LEGACY_META_KEY);
    if (!sessionRaw) return null;

    const session = JSON.parse(sessionRaw) as { privateKey?: string };
    const pk = session.privateKey;
    if (!pk?.startsWith("0x")) return null;

    let address: Address | undefined;
    if (metaRaw) {
      const meta = JSON.parse(metaRaw) as { address?: Address };
      address = meta.address;
    }

    const tradingAddress = address ?? addressFromPrivateKey(pk as `0x${string}`);

    savePersistedTradingWallet(ownerAddress, pk as `0x${string}`, tradingAddress);
    return loadPersistedTradingWallet(ownerAddress);
  } catch {
    return null;
  } finally {
    clearLegacyStorage();
  }
}

function clearLegacyStorage(): void {
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
  localStorage.removeItem(LEGACY_META_KEY);
}

export function clearAllTradingWalletStorage(ownerAddress?: Address): void {
  if (ownerAddress) {
    clearPersistedTradingWallet(ownerAddress);
  }
  clearLegacyStorage();
}
