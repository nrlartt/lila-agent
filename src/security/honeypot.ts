import { type Address } from "viem";
import { erc20Abi, zapAbi } from "../abis.js";
import { ADDRESSES } from "../constants.js";
import { getPublicClient } from "../chain.js";
import { getTokenLifecycle } from "../lifecycle.js";
import {
  fetchApiHolders,
  fetchApiSecurity,
  fetchApiTradesForToken,
  type ApiSecurity,
} from "../indexer/altfun-api.js";

export type HoneypotStatus = "clear" | "caution" | "risk" | "unknown";

export type HoneypotCheck = {
  status: HoneypotStatus;
  isHoneypot: boolean;
  canSell: boolean | null;
  buyFeeBps: number;
  sellFeeBps: number;
  creatorHoldingPct: number | null;
  contractVerified: boolean | null;
  lpLocked: boolean | null;
  recentSellCount: number;
  flags: string[];
  summary: string;
  checkedAt: number;
};

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; data: HoneypotCheck }>();

export async function checkTokenHoneypot(address: string): Promise<HoneypotCheck> {
  const key = address.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const report = await runCheck(key as Address);
  cache.set(key, { at: Date.now(), data: report });
  return report;
}

async function runCheck(token: Address): Promise<HoneypotCheck> {
  const checkedAt = Math.floor(Date.now() / 1000);
  const flags: string[] = [];

  const lifecycle = await getTokenLifecycle(token);
  if (lifecycle === "graduating") {
    return finish({
      status: "caution",
      isHoneypot: false,
      canSell: false,
      buyFeeBps: 0,
      sellFeeBps: 0,
      creatorHoldingPct: null,
      contractVerified: null,
      lpLocked: null,
      recentSellCount: 0,
      flags: ["Trading paused during graduation"],
      summary: "Trading paused — graduating to HyperSwap",
      checkedAt,
    });
  }

  if (lifecycle === "unknown") {
    return finish({
      status: "unknown",
      isHoneypot: false,
      canSell: null,
      buyFeeBps: 0,
      sellFeeBps: 0,
      creatorHoldingPct: null,
      contractVerified: null,
      lpLocked: null,
      recentSellCount: 0,
      flags: ["Token not found on alt.fun bonding"],
      summary: "Unable to verify — not on bonding curve",
      checkedAt,
    });
  }

  const client = getPublicClient();

  const [security, trades, holders, buyFeeBps, sellFeeBps] = await Promise.all([
    fetchApiSecurity(token),
    fetchApiTradesForToken(token, 30),
    fetchApiHolders(token, 8),
    client.readContract({
      address: ADDRESSES.zap,
      abi: zapAbi,
      functionName: "buyFeeBps",
    }),
    client.readContract({
      address: ADDRESSES.zap,
      abi: zapAbi,
      functionName: "sellFeeBps",
    }),
  ]);

  const recentSellCount = trades.filter((t) => !t.isBuy).length;
  if (recentSellCount > 0) {
    flags.push(`${recentSellCount} recent sell(s) on alt.fun`);
  }

  applySecurityFlags(security, flags);

  const buyBps = Number(buyFeeBps);
  const sellBps = Number(sellFeeBps);
  if (buyBps > 500) flags.push(`Elevated buy fee (${(buyBps / 100).toFixed(1)}%)`);
  if (sellBps > 500) flags.push(`Elevated sell fee (${(sellBps / 100).toFixed(1)}%)`);

  let canSell: boolean | null = null;

  if (recentSellCount > 0) {
    canSell = true;
  } else {
    canSell = await simulateSellFromHolder(token, holders?.holders ?? []);
    if (canSell === true) flags.push("Sell path simulates OK");
    else if (canSell === false) flags.push("Sell simulation failed");
    else flags.push("Sell path not verified (no recent sells)");
  }

  let status: HoneypotStatus = "unknown";
  if (canSell === false) {
    status = "risk";
  } else if (recentSellCount > 0 || canSell === true) {
    status = hasCautionSignals(security, buyBps, sellBps) ? "caution" : "clear";
  } else {
    status = hasCautionSignals(security, buyBps, sellBps) ? "caution" : "unknown";
  }

  const isHoneypot = status === "risk";

  const summary =
    status === "clear"
      ? "No honeypot signals detected"
      : status === "caution"
        ? "Trade with caution — review flags"
        : status === "risk"
          ? "Possible honeypot — selling may fail"
          : "Sell safety not confirmed";

  return finish({
    status,
    isHoneypot,
    canSell,
    buyFeeBps: buyBps,
    sellFeeBps: sellBps,
    creatorHoldingPct: security?.creatorHoldingPct ?? null,
    contractVerified: security?.contractVerified ?? null,
    lpLocked: security?.lpLocked ?? null,
    recentSellCount,
    flags,
    summary,
    checkedAt,
  });
}

function applySecurityFlags(security: ApiSecurity | null, flags: string[]) {
  if (!security) {
    flags.push("alt.fun security data unavailable");
    return;
  }
  if (!security.contractVerified) flags.push("Contract not verified");
  if (security.creatorHoldingPct >= 50) {
    flags.push(`Creator holds ${security.creatorHoldingPct.toFixed(1)}%`);
  } else if (security.creatorHoldingPct >= 25) {
    flags.push(`Creator holds ${security.creatorHoldingPct.toFixed(1)}%`);
  }
  if (security.graduated && !security.lpLocked) {
    flags.push("LP not locked (graduated)");
  }
}

function hasCautionSignals(
  security: ApiSecurity | null,
  buyBps: number,
  sellBps: number,
): boolean {
  if (!security?.contractVerified) return true;
  if (security.creatorHoldingPct >= 50) return true;
  if (security.graduated && !security.lpLocked) return true;
  if (buyBps > 500 || sellBps > 500) return true;
  return false;
}

async function simulateSellFromHolder(
  token: Address,
  holders: { wallet: string; balance: string }[],
): Promise<boolean | null> {
  const client = getPublicClient();

  for (const h of holders) {
    const holder = h.wallet.toLowerCase() as Address;
    let balance: bigint;
    try {
      balance = await client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [holder],
      });
    } catch {
      continue;
    }

    if (balance === 0n) continue;

    const allowance = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [holder, ADDRESSES.zap],
    });

    const probe = balance / 200n || 1n;
    if (allowance < probe) continue;

    try {
      await client.simulateContract({
        address: ADDRESSES.zap,
        abi: zapAbi,
        functionName: "sell",
        args: [token, probe, 0n],
        account: holder,
      });
      return true;
    } catch {
      return false;
    }
  }

  return null;
}

function finish(check: HoneypotCheck): HoneypotCheck {
  return check;
}
