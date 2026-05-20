import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { formatUnits, parseUnits, type Address } from "viem";
import { erc20Abi } from "../abis";
import { config, USDC } from "../wagmi";
import {
  approveUsdcForZapSigned,
  readUsdcBalanceSigned,
  readZapUsdcAllowanceSigned,
} from "../lib/executeZapSigned";
import {
  addressFromPrivateKey,
  createTradingPrivateKey,
  parsePrivateKeyInput,
} from "../lib/tradingWallet";
import {
  clearAllTradingWalletStorage,
  loadPersistedTradingWallet,
  migrateLegacyTradingWallet,
  savePersistedTradingWallet,
} from "../lib/tradingWalletStorage";

const MIN_ALLOWANCE = parseUnits("20", 6);

export type TradingWalletSession = {
  address: Address;
  privateKey: `0x${string}`;
};

export function useTradingWallet() {
  const { address: ownerAddress, isConnected } = useAccount();
  const [privateKey, setPrivateKey] = useState<`0x${string}` | null>(null);
  const [pendingKey, setPendingKey] = useState<`0x${string}` | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
  const [zapApproved, setZapApproved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);

  const sessionKey = privateKey;
  const address = sessionKey
    ? addressFromPrivateKey(sessionKey)
    : pendingKey
      ? addressFromPrivateKey(pendingKey)
      : null;

  const session: TradingWalletSession | null = sessionKey
    ? { address: addressFromPrivateKey(sessionKey), privateKey: sessionKey }
    : null;

  const sessionActive = Boolean(sessionKey && isConnected && ownerAddress);

  useEffect(() => {
    if (!ownerAddress || !isConnected) {
      setPrivateKey(null);
      setPendingKey(null);
      setRestored(false);
      return;
    }

    const migrated = migrateLegacyTradingWallet(ownerAddress);
    const profile = migrated ?? loadPersistedTradingWallet(ownerAddress);
    if (profile) {
      setPrivateKey(profile.privateKey);
      setPendingKey(null);
      setRestored(true);
    } else {
      setPrivateKey(null);
      setRestored(false);
    }
  }, [ownerAddress, isConnected]);

  const refreshBalances = useCallback(async () => {
    if (!sessionKey) return;
    try {
      const [bal, allowance] = await Promise.all([
        readUsdcBalanceSigned(sessionKey),
        readZapUsdcAllowanceSigned(sessionKey),
      ]);
      setUsdcBalance(bal);
      setZapApproved(allowance >= MIN_ALLOWANCE);
    } catch {
      /* ignore poll errors */
    }
  }, [sessionKey]);

  useEffect(() => {
    void refreshBalances();
    if (!sessionKey) return;
    const id = window.setInterval(() => void refreshBalances(), 12_000);
    return () => window.clearInterval(id);
  }, [sessionKey, refreshBalances]);

  const requireOwner = useCallback((): Address | null => {
    if (!ownerAddress || !isConnected) {
      setError("Connect your main wallet to link a trading wallet to your profile");
      return null;
    }
    return ownerAddress;
  }, [ownerAddress, isConnected]);

  const persistKey = useCallback(
    (pk: `0x${string}`, owner: Address) => {
      const tradingAddr = addressFromPrivateKey(pk);
      savePersistedTradingWallet(owner, pk, tradingAddr);
      setPrivateKey(pk);
      setPendingKey(null);
      setRestored(true);
      setError("");
    },
    [],
  );

  const createWallet = useCallback(() => {
    const owner = requireOwner();
    if (!owner) return null;
    setError("");
    const pk = createTradingPrivateKey();
    setPendingKey(pk);
    setPrivateKey(null);
    return pk;
  }, [requireOwner]);

  const importWallet = useCallback(
    (input: string) => {
      const owner = requireOwner();
      if (!owner) return null;
      setError("");
      try {
        const pk = parsePrivateKeyInput(input);
        setPendingKey(pk);
        setPrivateKey(null);
        return pk;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid key";
        setError(msg);
        throw e;
      }
    },
    [requireOwner],
  );

  const saveToProfile = useCallback(() => {
    const owner = requireOwner();
    if (!owner) return;
    const pk = pendingKey ?? privateKey;
    if (!pk) {
      setError("No wallet to save");
      return;
    }
    persistKey(pk, owner);
  }, [requireOwner, pendingKey, privateKey, persistKey]);

  const disconnect = useCallback(() => {
    if (ownerAddress) {
      clearAllTradingWalletStorage(ownerAddress);
    } else {
      clearAllTradingWalletStorage();
    }
    setPrivateKey(null);
    setPendingKey(null);
    setUsdcBalance(0n);
    setZapApproved(false);
    setRestored(false);
    setError("");
  }, [ownerAddress]);

  const fundFromConnectedWallet = useCallback(
    async (amountHuman: string, fromAddress: Address) => {
      if (!address) throw new Error("No trading wallet address");
      setLoading(true);
      setError("");
      try {
        const amount = parseUnits(amountHuman, 6);
        if (amount <= 0n) throw new Error("Enter a valid USDC amount");

        const hash = await writeContract(config, {
          address: USDC,
          abi: erc20Abi,
          functionName: "transfer",
          args: [address, amount],
          account: fromAddress,
        });
        await waitForTransactionReceipt(config, { hash });
        if (sessionKey) await refreshBalances();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transfer failed";
        setError(msg.split("\n")[0]);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [address, sessionKey, refreshBalances],
  );

  const approveZap = useCallback(async () => {
    if (!sessionKey) throw new Error("Save trading wallet to your profile first");
    setLoading(true);
    setError("");
    try {
      await approveUsdcForZapSigned(sessionKey);
      await refreshBalances();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Approve failed";
      setError(msg.split("\n")[0]);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [sessionKey, refreshBalances]);

  const usdcLabel =
    sessionKey && usdcBalance > 0n
      ? Number(formatUnits(usdcBalance, 6)).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })
      : "0";

  return {
    address,
    session: sessionActive ? session : null,
    ownerAddress,
    pendingKey,
    sessionActive,
    hasPendingSetup: Boolean(pendingKey),
    restored,
    usdcBalance,
    usdcLabel,
    zapApproved,
    loading,
    error,
    setError,
    createWallet,
    importWallet,
    saveToProfile,
    disconnect,
    fundFromConnectedWallet,
    approveZap,
    refreshBalances,
  };
}
