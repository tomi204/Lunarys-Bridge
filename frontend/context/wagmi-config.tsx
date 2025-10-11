"use client";

import { createConfig, http, createStorage, noopStorage } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { RPC_URL } from "@/lib/constants";

const appName = "Lunarys";

export const wagmiConfig = createConfig({
  ssr: false,
  chains: [sepolia],
  transports: { [sepolia.id]: http(RPC_URL) },
  connectors: [injected(), coinbaseWallet({ appName })],
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : noopStorage,
  }),
  syncConnectedChain: false,
});