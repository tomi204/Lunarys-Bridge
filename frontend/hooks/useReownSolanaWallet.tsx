"use client";

import React, {
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
} from "@reown/appkit/react";
import {
  useAppKitConnection,
  type Provider as SolanaWalletProvider,
} from "@reown/appkit-adapter-solana/react";
import { toast } from "sonner";

interface SolanaWalletContextValue {
  address?: string;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  connection: unknown;
  walletProvider?: SolanaWalletProvider;
}

const SolanaWalletContext = React.createContext<SolanaWalletContextValue | undefined>(
  undefined
);

function normalizeSolanaAddress(address?: string | null): string | undefined {
  if (!address) return undefined;
  return address;
}

function useSolanaWalletInternal(): SolanaWalletContextValue {
  const { open, close } = useAppKit();
  const { address: genericAddress, isConnected } = useAppKitAccount();
  const { connection } = useAppKitConnection();
  const { walletProvider } = useAppKitProvider<SolanaWalletProvider>("solana");
  const [lastConnectedNamespace, setLastConnectedNamespace] = useState<string | null>(null);
  const address = useMemo(() => {
    const providerAddress = walletProvider?.publicKey?.toBase58?.();
    if (providerAddress) return normalizeSolanaAddress(providerAddress);
    if (lastConnectedNamespace === "solana") {
      return normalizeSolanaAddress(genericAddress);
    }
    return undefined;
  }, [genericAddress, walletProvider, lastConnectedNamespace]);
  const baseConnected = useMemo(() => {
    if (walletProvider?.publicKey) return true;
    return lastConnectedNamespace === "solana" && Boolean(address);
  }, [walletProvider, lastConnectedNamespace, address]);

  const connect = useCallback(() => {
    setLastConnectedNamespace("solana");
    open({ view: "Connect", chainNamespace: "solana" } as any);
  }, [open]);

  const disconnect = useCallback(() => {
    setLastConnectedNamespace(null);
    close();
  }, [close]);

  return {
    address,
    isConnected: baseConnected && isConnected,
    connect,
    disconnect,
    connection,
    walletProvider,
  };
}

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useSolanaWalletInternal();
  return (
    <SolanaWalletContext.Provider value={value}>
      {children}
    </SolanaWalletContext.Provider>
  );
}

export function useSolanaWallet(): SolanaWalletContextValue {
  const value = useContext(SolanaWalletContext);
  if (!value) {
    toast.error("useSolanaWallet must be used within <SolanaWalletProvider>");
    throw new Error("useSolanaWallet must be used within <SolanaWalletProvider>");
  }
  return value;
}
