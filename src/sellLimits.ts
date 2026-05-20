import { type Address, zeroAddress } from "viem";
import { bondingAbi, bounceLtAbi, zapAbi } from "./abis.js";
import { ADDRESSES } from "./constants.js";
import { getPublicClient } from "./chain.js";
/** Max token sell size limited by LT idle USDC buffer (BounceTech redeem). */
export async function estimateMaxSellableTokens(
  token: Address,
  owner: Address,
  _slippageBps = 1000,
): Promise<{ maxTokens: bigint; bufferUsdc: bigint; note?: string }> {
  const client = getPublicClient();

  const lt = await client.readContract({
    address: ADDRESSES.bonding,
    abi: bondingAbi,
    functionName: "ltOf",
    args: [token],
  });

  if (lt === zeroAddress) {
    return { maxTokens: 0n, bufferUsdc: 0n, note: "No LT for token" };
  }

  const [bufferUsdc, exchangeRate, balance] = await Promise.all([
    client.readContract({
      address: lt,
      abi: bounceLtAbi,
      functionName: "baseAssetBalance",
    }),
    client.readContract({
      address: lt,
      abi: bounceLtAbi,
      functionName: "exchangeRate",
    }),
    client.readContract({
      address: token,
      abi: [
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ type: "uint256" }],
        },
      ] as const,
      functionName: "balanceOf",
      args: [owner],
    }),
  ]);

  if (balance === 0n || bufferUsdc === 0n || exchangeRate === 0n) {
    return { maxTokens: 0n, bufferUsdc };
  }

  let lo = 0n;
  let hi = balance;
  let best = 0n;

  for (let i = 0; i < 40 && lo <= hi; i++) {
    const mid = (lo + hi) / 2n;
    if (mid === 0n) {
      lo = 1n;
      continue;
    }

    try {
      await client.simulateContract({
        address: ADDRESSES.zap,
        abi: zapAbi,
        functionName: "sell",
        args: [token, mid, 0n],
        account: owner,
      });
      best = mid;
      lo = mid + 1n;
    } catch {
      hi = mid - 1n;
    }
  }

  return {
    maxTokens: best,
    bufferUsdc,
    note:
      best < balance
        ? "LT buffer limits atomic sell size; sell in chunks (~10s between)"
        : undefined,
  };
}
