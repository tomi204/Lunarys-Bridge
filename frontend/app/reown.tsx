"use client";

import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import {
  sepolia,
  localhost,
  solana,
  solanaDevnet,
  solanaTestnet,
} from "@reown/appkit/networks";

const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ||
  "c54d67b8d6e2adca8b76b5e4db3a7b8a";

const metadata = {
  name: "Lunarys Bridge",
  description:
    "Private Solana ↔ EVM bridge using Zama FHEVM encryption",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

const localhostEvmNetwork = {
  ...localhost,
  id: 31337,
  name: "Localhost",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    public: { http: ["http://127.0.0.1:8545"] },
    default: { http: ["http://127.0.0.1:8545"] },
  },
};

const solanaNetworks = [solana, solanaDevnet, solanaTestnet];

createAppKit({
  adapters: [new EthersAdapter(), new SolanaAdapter()],
  metadata,
  networks: [sepolia, localhostEvmNetwork, ...solanaNetworks],
  projectId,
  defaultNetwork: sepolia,
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
});

export function AppKit({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
