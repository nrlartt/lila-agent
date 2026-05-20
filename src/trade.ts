import {
  maxUint256,
  type Address,
  type Hash,
  zeroAddress,
} from "viem";
import { bondingAbi, erc20Abi, zapAbi } from "./abis.js";
import {
  ADDRESSES,
  MIN_USDC_BUY_UI,
  MIN_USDC_SELL_UI,
  USDC_DECIMALS,
} from "./constants.js";
import { getPublicClient, type createTradingWallet } from "./chain.js";
import {
  applySlippageMin,
  formatTokens,
  formatUsdc,
  parseUsdcInput,
} from "./format.js";
import {
  assertTradable,
  getTokenLifecycle,
  lifecycleLabel,
} from "./lifecycle.js";
import { estimateMaxSellableTokens } from "./sellLimits.js";

type WalletBundle = ReturnType<typeof createTradingWallet>;

export async function getTokenStatus(token: Address, owner: Address) {
  const client = getPublicClient();
  const lifecycle = await getTokenLifecycle(token);

  const [usdcBal, tokenBal, buyFeeBps, sellFeeBps] = await Promise.all([
    client.readContract({
      address: ADDRESSES.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
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

  let maxSell = 0n;
  let bufferUsdc = 0n;
  let sellNote: string | undefined;

  if (tokenBal > 0n && lifecycle !== "graduating" && lifecycle !== "unknown") {
    const limits = await estimateMaxSellableTokens(token, owner, 1000);
    maxSell = limits.maxTokens;
    bufferUsdc = limits.bufferUsdc;
    sellNote = limits.note;
  }

  return {
    lifecycle,
    lifecycleText: lifecycleLabel(lifecycle),
    usdcBal,
    tokenBal,
    buyFeeBps,
    sellFeeBps,
    maxSell,
    bufferUsdc,
    sellNote,
  };
}

export async function ensureAllowance(
  wallet: WalletBundle,
  token: Address,
  spender: Address,
  amount: bigint,
): Promise<Hash | null> {
  const client = getPublicClient();
  const allowance = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [wallet.address, spender],
  });

  if (allowance >= amount) return null;

  const hash = await wallet.wallet.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
    chain: wallet.wallet.chain,
    account: wallet.account,
  });

  await client.waitForTransactionReceipt({ hash });
  return hash;
}

export async function approveAll(wallet: WalletBundle): Promise<string[]> {
  const hashes: string[] = [];
  const usdcHash = await ensureAllowance(
    wallet,
    ADDRESSES.usdc,
    ADDRESSES.zap,
    1n,
  );
  if (usdcHash) hashes.push(usdcHash);
  return hashes;
}

export async function quoteBuy(
  wallet: WalletBundle,
  token: Address,
  usdcGross: bigint,
  slippageBps: number,
) {
  const lifecycle = await getTokenLifecycle(token);
  assertTradable(lifecycle);

  const minGross = MIN_USDC_BUY_UI * 10n ** BigInt(USDC_DECIMALS);
  if (usdcGross < minGross) {
    throw new Error(`Minimum buy is ${MIN_USDC_BUY_UI} USDC (UI recommendation)`);
  }

  const client = getPublicClient();
  await ensureAllowance(wallet, ADDRESSES.usdc, ADDRESSES.zap, usdcGross);

  const { result: tokensOut } = await client.simulateContract({
    address: ADDRESSES.zap,
    abi: zapAbi,
    functionName: "buy",
    args: [token, usdcGross, 0n, zeroAddress],
    account: wallet.address,
  });

  const minTokens = applySlippageMin(tokensOut, slippageBps);
  const buyFeeBps = await client.readContract({
    address: ADDRESSES.zap,
    abi: zapAbi,
    functionName: "buyFeeBps",
  });

  return {
    lifecycle: lifecycleLabel(lifecycle),
    usdcGross,
    tokensOut,
    minTokens,
    buyFeeBps,
    feeUsdc: (usdcGross * BigInt(buyFeeBps)) / 10_000n,
  };
}

export async function quoteSell(
  wallet: WalletBundle,
  token: Address,
  tokenAmount: bigint,
  slippageBps: number,
) {
  const lifecycle = await getTokenLifecycle(token);
  assertTradable(lifecycle);

  if (tokenAmount === 0n) throw new Error("Token amount must be > 0");

  const client = getPublicClient();
  await ensureAllowance(wallet, token, ADDRESSES.zap, tokenAmount);

  const { result: usdcOut } = await client.simulateContract({
    address: ADDRESSES.zap,
    abi: zapAbi,
    functionName: "sell",
    args: [token, tokenAmount, 0n],
    account: wallet.address,
  });

  const minUsdc = applySlippageMin(usdcOut, slippageBps);
  const minSell = MIN_USDC_SELL_UI * 1_000_000n;
  if (usdcOut < minSell) {
    throw new Error(`Expected output below ${MIN_USDC_SELL_UI} USDC UI minimum`);
  }

  const sellFeeBps = await client.readContract({
    address: ADDRESSES.zap,
    abi: zapAbi,
    functionName: "sellFeeBps",
  });

  return {
    lifecycle: lifecycleLabel(lifecycle),
    tokenAmount,
    usdcOut,
    minUsdc,
    sellFeeBps,
  };
}

export async function executeBuy(
  wallet: WalletBundle,
  token: Address,
  usdcAmountHuman: string,
  referrer: Address,
  slippageBps: number,
): Promise<{ hash: Hash; tokensOut: bigint }> {
  const usdcGross = parseUsdcInput(usdcAmountHuman);
  const quote = await quoteBuy(wallet, token, usdcGross, slippageBps);

  const hash = await wallet.wallet.writeContract({
    address: ADDRESSES.zap,
    abi: zapAbi,
    functionName: "buy",
    args: [token, usdcGross, quote.minTokens, referrer],
    chain: wallet.wallet.chain,
    account: wallet.account,
  });

  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Buy transaction reverted");
  }

  return { hash, tokensOut: quote.tokensOut };
}

export async function executeSell(
  wallet: WalletBundle,
  token: Address,
  tokenAmount: bigint,
  slippageBps: number,
): Promise<{ hash: Hash; usdcOut: bigint }> {
  const quote = await quoteSell(wallet, token, tokenAmount, slippageBps);

  const limits = await estimateMaxSellableTokens(
    token,
    wallet.address,
    slippageBps,
  );
  if (limits.maxTokens > 0n && tokenAmount > limits.maxTokens) {
    throw new Error(
      `Sell exceeds LT buffer. Max now: ${formatTokens(limits.maxTokens)} tokens. ${limits.note ?? ""}`,
    );
  }

  const hash = await wallet.wallet.writeContract({
    address: ADDRESSES.zap,
    abi: zapAbi,
    functionName: "sell",
    args: [token, tokenAmount, quote.minUsdc],
    chain: wallet.wallet.chain,
    account: wallet.account,
  });

  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("Sell transaction reverted");
  }

  return { hash, usdcOut: quote.usdcOut };
}

export function formatBuySummary(
  token: Address,
  usdcHuman: string,
  quote: Awaited<ReturnType<typeof quoteBuy>>,
  referrer: Address,
): string {
  return [
    `Token: ${token}`,
    `Lifecycle: ${quote.lifecycle}`,
    `Spend (gross): ${usdcHuman} USDC`,
    `Est. fee: ~${formatUsdc(quote.feeUsdc)} USDC (${Number(quote.buyFeeBps) / 100}%)`,
    `Est. receive: ${formatTokens(quote.tokensOut)} tokens`,
    `Min (slippage): ${formatTokens(quote.minTokens)} tokens`,
    `Referrer: ${referrer}`,
  ].join("\n");
}

export function formatSellSummary(
  token: Address,
  quote: Awaited<ReturnType<typeof quoteSell>>,
): string {
  return [
    `Token: ${token}`,
    `Lifecycle: ${quote.lifecycle}`,
    `Sell: ${formatTokens(quote.tokenAmount)} tokens`,
    `Est. receive: ${formatUsdc(quote.usdcOut)} USDC`,
    `Min (slippage): ${formatUsdc(quote.minUsdc)} USDC`,
  ].join("\n");
}
