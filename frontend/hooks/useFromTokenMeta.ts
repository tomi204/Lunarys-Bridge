"use client";

import { useMemo } from "react";
import { getTokenConfig, getSplTokenConfig, detectSolanaCluster } from "@/config/tokens";

export type FromTokenMeta =
  | { kind: "solana"; symbol: string; mint: string; decimals: number; label: string }
  | { kind: "evm"; chainId: number; symbol: string; address: `0x${string}`; decimals: number; label: string };

export function useFromTokenMeta(fromChain: string, symbol = "USDC"): FromTokenMeta | null {
  return useMemo(() => {
    const isSolana = fromChain?.toLowerCase().startsWith("solana");
    if (isSolana) {
      const cluster = detectSolanaCluster(); // devnet | mainnet-beta | testnet
      const spl = getSplTokenConfig(cluster, symbol);
      if (!spl) return null;
      return {
        kind: "solana",
        symbol: spl.symbol,
        mint: spl.mint,
        decimals: spl.decimals,
        label: spl.label ?? `${spl.symbol} (Solana ${cluster})`,
      };
    }

    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID); // 11155111
    const evm = getTokenConfig(chainId, symbol);
    if (!evm) return null;
    return {
      kind: "evm",
      chainId,
      symbol: evm.symbol,
      address: evm.address,
      decimals: evm.decimals,
      label: evm.label ?? `${evm.symbol} (chainId ${chainId})`,
    };
  }, [fromChain, symbol]);
}