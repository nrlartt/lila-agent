import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "../abis";

export function useErc20Balance(tokenAddress?: `0x${string}`) {
  const { address } = useAccount();

  const query = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && tokenAddress) },
  });

  return {
    balance: query.data ?? 0n,
    refetch: query.refetch,
    isLoading: query.isLoading,
  };
}
