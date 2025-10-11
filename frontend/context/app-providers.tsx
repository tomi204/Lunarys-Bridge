"use client";

import { ReactNode, Suspense } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/context/wagmi-config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; 
import { ContractsProvider } from "./contracts-context";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export function AppProviders({ children }: { children: ReactNode }) {

  return (
    <Suspense fallback={null}>
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={darkTheme()} modalSize="compact">
                    <ContractsProvider>
                        {children}
                    </ContractsProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    </Suspense>
  );
}
