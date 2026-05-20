import { type Address } from "viem";
import { bondingAbi } from "./abis.js";
import { ADDRESSES } from "./constants.js";
import { getPublicClient } from "./chain.js";

export type TokenLifecycle =
  | "unknown"
  | "curve"
  | "graduating"
  | "graduated";

export async function getTokenLifecycle(token: Address): Promise<TokenLifecycle> {
  const client = getPublicClient();

  const creator = await client.readContract({
    address: ADDRESSES.bonding,
    abi: bondingAbi,
    functionName: "creatorOf",
    args: [token],
  });

  if (creator === "0x0000000000000000000000000000000000000000") {
    return "unknown";
  }

  const [graduating, graduated, trading] = await Promise.all([
    client.readContract({
      address: ADDRESSES.bonding,
      abi: bondingAbi,
      functionName: "isGraduating",
      args: [token],
    }),
    client.readContract({
      address: ADDRESSES.bonding,
      abi: bondingAbi,
      functionName: "isGraduated",
      args: [token],
    }),
    client.readContract({
      address: ADDRESSES.bonding,
      abi: bondingAbi,
      functionName: "isTrading",
      args: [token],
    }),
  ]);

  if (graduating) return "graduating";
  if (graduated) return "graduated";
  if (trading) return "curve";
  return "unknown";
}

export function lifecycleLabel(lifecycle: TokenLifecycle): string {
  switch (lifecycle) {
    case "curve":
      return "Curve (bonding)";
    case "graduating":
      return "Graduating — trading paused (~1 min)";
    case "graduated":
      return "Graduated (HyperSwap)";
    default:
      return "Unknown / not listed";
  }
}

export function assertTradable(lifecycle: TokenLifecycle): void {
  if (lifecycle === "graduating") {
    throw new Error(
      "Token is graduating. Wait for HyperSwap liquidity seeding, then retry.",
    );
  }
  if (lifecycle === "unknown") {
    throw new Error("Token not found on alt.fun bonding.");
  }
}
