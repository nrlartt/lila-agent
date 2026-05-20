import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

export const hyperEvm = {
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RPC_URL || "https://rpc.hyperliquid.xyz/evm"] },
  },
  blockExplorers: {
    default: { name: "HyperEVMScan", url: "https://hyperevmscan.io" },
  },
} as const;

export const config = createConfig({
  chains: [hyperEvm],
  connectors: [injected()],
  transports: {
    [hyperEvm.id]: http(),
  },
});

export const ZAP = "0x693F12E9E6B35b34458793546065E8b08e0299d6" as const;
export const USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f" as const;
export const REFERRER = (import.meta.env.VITE_REFERRER_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
