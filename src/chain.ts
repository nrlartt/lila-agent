import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getRpcUrl } from "./config.js";

export const hyperEvm = defineChain({
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: [getRpcUrl()] },
  },
});

let publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: hyperEvm,
      transport: http(getRpcUrl()),
    });
  }
  return publicClient;
}

export function createTradingWallet(privateKey: `0x${string}`): {
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: WalletClient;
  address: Address;
} {
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({
    account,
    chain: hyperEvm,
    transport: http(getRpcUrl()),
  });
  return { account, wallet, address: account.address };
}
