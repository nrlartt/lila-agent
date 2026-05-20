import { type Address } from "viem";
import { bondingAbi, bounceLtAbi, pairAbi } from "../abis.js";
import { ADDRESSES } from "../constants.js";
import { getPublicClient } from "../chain.js";
import { type Lifecycle, getToken, upsertTokenEnrichment } from "./db.js";

const LIFECYCLE_MAP: Lifecycle[] = ["curve", "graduating", "graduated"];

export async function enrichToken(tokenAddress: Address): Promise<void> {
  const client = getPublicClient();
  const existing = getToken(tokenAddress);
  if (!existing) return;

  const info = await client.readContract({
    address: ADDRESSES.bonding,
    abi: bondingAbi,
    functionName: "getTokenInfo",
    args: [tokenAddress],
  });

  const lifecycle = LIFECYCLE_MAP[Number(info.lifecycle)] ?? "curve";

  let reserveToken: string | null = null;
  let reserveLt: string | null = null;
  let ltBuffer: string | null = null;
  let exchangeRate: string | null = null;
  let canGraduate = 0;

  if (info.pair && info.pair !== "0x0000000000000000000000000000000000000000") {
    try {
      const [reserves, tokenBal] = await Promise.all([
        client.readContract({
          address: info.pair as Address,
          abi: pairAbi,
          functionName: "getReserves",
        }),
        client.readContract({
          address: info.pair as Address,
          abi: pairAbi,
          functionName: "tokenBalance",
        }),
      ]);
      reserveToken = tokenBal.toString();
      reserveLt = reserves[1].toString();
    } catch {
      // pair unreadable
    }
  }

  if (info.ltAddress && info.ltAddress !== "0x0000000000000000000000000000000000000000") {
    try {
      const [buffer, rate, grad] = await Promise.all([
        client.readContract({
          address: info.ltAddress as Address,
          abi: bounceLtAbi,
          functionName: "baseAssetBalance",
        }),
        client.readContract({
          address: info.ltAddress as Address,
          abi: bounceLtAbi,
          functionName: "exchangeRate",
        }),
        lifecycle === "curve"
          ? client.readContract({
              address: ADDRESSES.bonding,
              abi: bondingAbi,
              functionName: "canGraduate",
              args: [tokenAddress],
            })
          : Promise.resolve(false),
      ]);
      ltBuffer = buffer.toString();
      exchangeRate = rate.toString();
      canGraduate = grad ? 1 : 0;
    } catch {
      // LT read failure
    }
  }

  upsertTokenEnrichment({
    address: tokenAddress.toLowerCase(),
    description: info.description,
    image: info.image,
    url0: info.urls[0] ?? "",
    url1: info.urls[1] ?? "",
    url2: info.urls[2] ?? "",
    pair: info.pair.toLowerCase(),
    lifecycle,
    graduated_pair: existing.graduated_pair,
    reserve_token: reserveToken,
    reserve_lt: reserveLt,
    lt_buffer_usdc: ltBuffer,
    exchange_rate: exchangeRate,
    can_graduate: canGraduate,
  });
}
