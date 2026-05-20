import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "../abis";
import { USDC } from "../wagmi";

export function useUsdcBalance() {
  const { address } = useAccount();
  const query = useReadContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  return { balance: query.data ?? 0n, isLoading: query.isLoading };
}
