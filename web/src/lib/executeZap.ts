import {
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import { maxUint256, parseUnits, zeroAddress, type Address } from "viem";
import { erc20Abi, zapAbi } from "../abis";
import { config, REFERRER, USDC, ZAP } from "../wagmi";
import { applySlippageMin } from "./slippage";
import { getSlippageBps } from "./slippage";
import {
  formatTokenAmountInput,
  sellAmountFromBalance,
} from "./tradeAmount";

const MIN_BUY_USDC = 20;

export async function ensureUsdcAllowance(owner: Address): Promise<void> {
  const allowance = await readContract(config, {
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, ZAP],
  });
  if (allowance >= parseUnits(String(MIN_BUY_USDC), 6)) return;

  const hash = await writeContract(config, {
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [ZAP, maxUint256],
  });
  await waitForTransactionReceipt(config, { hash });
}

export async function executeZapBuy(opts: {
  token: Address;
  owner: Address;
  usdcHuman: string;
}): Promise<{ hash: `0x${string}`; usdcRaw: bigint; tokenRaw: bigint }> {
  const usdc = parseUnits(opts.usdcHuman, 6);
  if (usdc < parseUnits(String(MIN_BUY_USDC), 6)) {
    throw new Error(`Minimum buy is ${MIN_BUY_USDC} USDC`);
  }

  await ensureUsdcAllowance(opts.owner);

  const ref =
    REFERRER.toLowerCase() === opts.owner.toLowerCase() ? zeroAddress : REFERRER;

  const sim = await simulateContract(config, {
    address: ZAP,
    abi: zapAbi,
    functionName: "buy",
    args: [opts.token, usdc, 0n, ref],
    account: opts.owner,
  });

  const tokensOut = sim.result as bigint;
  const minOut = applySlippageMin(tokensOut, getSlippageBps());

  const hash = await writeContract(config, {
    address: ZAP,
    abi: zapAbi,
    functionName: "buy",
    args: [opts.token, usdc, minOut, ref],
    account: opts.owner,
  });

  await waitForTransactionReceipt(config, { hash });
  return { hash, usdcRaw: usdc, tokenRaw: tokensOut };
}

export async function executeZapSell(opts: {
  token: Address;
  owner: Address;
  sellPercent: number;
}): Promise<{ hash: `0x${string}`; tokenRaw: bigint; usdcRaw: bigint }> {
  const balance = await readContract(config, {
    address: opts.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [opts.owner],
  });

  if (balance === 0n) throw new Error("No token balance to sell");

  const tokenAmount = sellAmountFromBalance(balance, opts.sellPercent);
  if (tokenAmount === 0n) throw new Error("Sell amount too small");

  const allowance = await readContract(config, {
    address: opts.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [opts.owner, ZAP],
  });
  if (allowance < tokenAmount) {
    const approveHash = await writeContract(config, {
      address: opts.token,
      abi: erc20Abi,
      functionName: "approve",
      args: [ZAP, maxUint256],
    });
    await waitForTransactionReceipt(config, { hash: approveHash });
  }

  const sim = await simulateContract(config, {
    address: ZAP,
    abi: zapAbi,
    functionName: "sell",
    args: [opts.token, tokenAmount, 0n],
    account: opts.owner,
  });

  const usdcOut = sim.result as bigint;
  const minOut = applySlippageMin(usdcOut, getSlippageBps());

  const hash = await writeContract(config, {
    address: ZAP,
    abi: zapAbi,
    functionName: "sell",
    args: [opts.token, tokenAmount, minOut],
    account: opts.owner,
  });

  await waitForTransactionReceipt(config, { hash });
  return { hash, tokenRaw: tokenAmount, usdcRaw: usdcOut };
}

export async function readTokenBalance(
  token: Address,
  owner: Address,
): Promise<bigint> {
  return readContract(config, {
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
}

export function formatSellAmountForLog(amount: bigint): string {
  return formatTokenAmountInput(amount);
}
