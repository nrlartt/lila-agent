import { maxUint256, parseUnits, zeroAddress, type Address, type Hash } from "viem";
import { erc20Abi, zapAbi } from "../abis";
import { hyperEvm, REFERRER, USDC, ZAP } from "../wagmi";
import { applySlippageMin, getSlippageBps } from "./slippage";
import { sellAmountFromBalance } from "./tradeAmount";
import {
  createTradingClients,
  getTradingPublicClient,
  waitTradingTx,
} from "./tradingWalletClient";

const MIN_BUY_USDC = 20;

async function ensureAllowanceSigned(
  privateKey: `0x${string}`,
  token: Address,
  spender: Address,
  minAmount: bigint,
): Promise<Hash | null> {
  const { address, publicClient, walletClient, account } =
    createTradingClients(privateKey);

  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address, spender],
  });
  if (allowance >= minAmount) return null;

  const hash = await walletClient.writeContract({
    chain: hyperEvm,
    account,
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
  });
  await waitTradingTx(hash);
  return hash;
}

export async function approveUsdcForZapSigned(
  privateKey: `0x${string}`,
): Promise<boolean> {
  const hash = await ensureAllowanceSigned(
    privateKey,
    USDC,
    ZAP,
    parseUnits(String(MIN_BUY_USDC), 6),
  );
  return hash !== null;
}

export async function executeZapBuySigned(opts: {
  privateKey: `0x${string}`;
  token: Address;
  usdcHuman: string;
}): Promise<{ hash: `0x${string}`; usdcRaw: bigint; tokenRaw: bigint }> {
  const usdc = parseUnits(opts.usdcHuman, 6);
  if (usdc < parseUnits(String(MIN_BUY_USDC), 6)) {
    throw new Error(`Minimum buy is ${MIN_BUY_USDC} USDC`);
  }

  const { address, publicClient, walletClient, account } = createTradingClients(
    opts.privateKey,
  );

  await ensureAllowanceSigned(opts.privateKey, USDC, ZAP, usdc);

  const ref =
    REFERRER.toLowerCase() === address.toLowerCase() ? zeroAddress : REFERRER;

  const { result: tokensOut } = await publicClient.simulateContract({
    address: ZAP,
    abi: zapAbi,
    functionName: "buy",
    args: [opts.token, usdc, 0n, ref],
    account: address,
  });

  const minOut = applySlippageMin(tokensOut as bigint, getSlippageBps());

  const hash = await walletClient.writeContract({
    chain: hyperEvm,
    account,
    address: ZAP,
    abi: zapAbi,
    functionName: "buy",
    args: [opts.token, usdc, minOut, ref],
  });

  await waitTradingTx(hash);
  return { hash, usdcRaw: usdc, tokenRaw: tokensOut as bigint };
}

export async function executeZapSellSigned(opts: {
  privateKey: `0x${string}`;
  token: Address;
  sellPercent: number;
}): Promise<{ hash: `0x${string}`; tokenRaw: bigint; usdcRaw: bigint }> {
  const { address, publicClient, walletClient, account } = createTradingClients(
    opts.privateKey,
  );

  const balance = await publicClient.readContract({
    address: opts.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  if (balance === 0n) throw new Error("No token balance to sell");

  const tokenAmount = sellAmountFromBalance(balance, opts.sellPercent);
  if (tokenAmount === 0n) throw new Error("Sell amount too small");

  await ensureAllowanceSigned(opts.privateKey, opts.token, ZAP, tokenAmount);

  const { result: usdcOut } = await publicClient.simulateContract({
    address: ZAP,
    abi: zapAbi,
    functionName: "sell",
    args: [opts.token, tokenAmount, 0n],
    account: address,
  });

  const minOut = applySlippageMin(usdcOut as bigint, getSlippageBps());

  const hash = await walletClient.writeContract({
    chain: hyperEvm,
    account,
    address: ZAP,
    abi: zapAbi,
    functionName: "sell",
    args: [opts.token, tokenAmount, minOut],
  });

  await waitTradingTx(hash);
  return { hash, tokenRaw: tokenAmount, usdcRaw: usdcOut as bigint };
}

export async function readTokenBalanceSigned(
  privateKey: `0x${string}`,
  token: Address,
): Promise<bigint> {
  const { address } = createTradingClients(privateKey);
  return getTradingPublicClient().readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
}

export async function readUsdcBalanceSigned(
  privateKey: `0x${string}`,
): Promise<bigint> {
  const { address } = createTradingClients(privateKey);
  return getTradingPublicClient().readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
}

export async function readZapUsdcAllowanceSigned(
  privateKey: `0x${string}`,
): Promise<bigint> {
  const { address } = createTradingClients(privateKey);
  return getTradingPublicClient().readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address, ZAP],
  });
}
