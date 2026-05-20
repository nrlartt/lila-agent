import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { hyperEvm } from "../wagmi";

export type TradingClients = {
  account: PrivateKeyAccount;
  address: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
};

let cachedPublic: PublicClient | null = null;

export function getTradingPublicClient(): PublicClient {
  if (!cachedPublic) {
    cachedPublic = createPublicClient({
      chain: hyperEvm,
      transport: http(),
    });
  }
  return cachedPublic;
}

export function createTradingClients(privateKey: `0x${string}`): TradingClients {
  const account = privateKeyToAccount(privateKey);
  const publicClient = getTradingPublicClient();
  const walletClient = createWalletClient({
    account,
    chain: hyperEvm,
    transport: http(),
  });
  return { account, address: account.address, publicClient, walletClient };
}

export async function waitTradingTx(hash: Hash): Promise<void> {
  await getTradingPublicClient().waitForTransactionReceipt({ hash });
}
