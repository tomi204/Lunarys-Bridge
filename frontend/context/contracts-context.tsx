"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { Address, PublicClient, WalletClient } from "viem";
import { getContract } from "viem";
import { useAccount, usePublicClient, useWalletClient, useChainId } from "wagmi";
import { RELAYER_ADDR, TOKEN_USDC } from "@/lib/constants";
import { ERC20_ABI, RELAYER_ABI } from "@/lib/abi";

type ContractsContextValue = {
  /** Connected EOA (if any) */
  address?: Address;
  /** Active chain id from wagmi */
  chainId?: number;
  /** viem public client (reads) */
  publicClient?: PublicClient;
  /** viem wallet client (writes), null if not connected */
  walletClient?: WalletClient | null;
  /** ERC-20 USDC contract (reads + writes if wallet present) */
  usdc?: ReturnType<typeof getContract>;
  /** Relayer/Bridge contract (reads + writes if wallet present) */
  relayer?: ReturnType<typeof getContract>;
  /** True when at least public client is ready */
  isReady: boolean;
};

const ContractsContext = createContext<ContractsContextValue | null>(null);

export function ContractsProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Instantiate USDC once clients are available
  const usdc = useMemo(() => {
    if (!publicClient) return undefined;
    try {
      return getContract({
        address: TOKEN_USDC as Address,
        abi: ERC20_ABI,
        client: { public: publicClient, wallet: walletClient ?? undefined },
      });
    } catch {
      return undefined;
    }
  }, [publicClient, walletClient]);

  // Instantiate Relayer/Bridge
  const relayer = useMemo(() => {
    if (!publicClient) return undefined;
    try {
      return getContract({
        address: RELAYER_ADDR as Address,
        abi: RELAYER_ABI,
        client: { public: publicClient, wallet: walletClient ?? undefined },
      });
    } catch {
      return undefined;
    }
  }, [publicClient, walletClient]);

  const value = useMemo<ContractsContextValue>(
    () => ({
      address: address as Address | undefined,
      chainId,
      publicClient: publicClient ?? undefined,
      walletClient: walletClient ?? null,
      usdc,
      relayer,
      isReady: Boolean(publicClient),
    }),
    [address, chainId, publicClient, walletClient, usdc, relayer],
  );

  return <ContractsContext.Provider value={value}>{children}</ContractsContext.Provider>;
}

export function useContracts() {
  const ctx = useContext(ContractsContext);
  if (!ctx) throw new Error("useContracts must be used within a ContractsProvider");
  return ctx;
}
