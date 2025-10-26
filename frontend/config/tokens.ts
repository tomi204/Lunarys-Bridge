// config/tokens.ts

export type EvmTokenConfig = {
  kind: "evm";
  chainId: number;
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  label?: string;
  logoURI?: string;
};

export type SplTokenConfig = {
  kind: "solana";
  cluster: "devnet" | "mainnet-beta" | "testnet";
  symbol: string;
  mint: string;      // base58 SPL mint
  decimals: number;
  label?: string;
  logoURI?: string;
};

import { TOKEN_USDC } from "@/lib/constants";

/* ----------------- EVM ----------------- */
const TOKENS_BY_CHAIN: Record<number, Record<string, EvmTokenConfig>> = {
  11155111: {
    USDC: {
      kind: "evm",
      chainId: 11155111,
      symbol: "USDC",
      address: TOKEN_USDC as `0x${string}`,
      decimals: 6,
      label: "USD Coin (Sepolia)",
    },
    CTKN: {
      kind: "evm",
      chainId: 11155111,
      symbol: "CTKN",
      address: "0x0F8902A83c9b20f2183dBc0d6672Ee0905B2Ca7d",
      decimals: 18,
      label: "Demo token",
    },
  },
};

export function getTokenConfig(chainId: number | undefined, symbol: string): EvmTokenConfig | undefined {
  if (!chainId) return undefined;
  return TOKENS_BY_CHAIN[chainId]?.[symbol];
}
export function listSupportedTokens(chainId: number | undefined): EvmTokenConfig[] {
  if (!chainId) return [];
  return Object.values(TOKENS_BY_CHAIN[chainId] ?? {});
}

/* ----------------- SOLANA (espejo) ----------------- */
export const SPL_TOKENS_BY_CLUSTER: Record<"devnet" | "mainnet-beta" | "testnet", Record<string, SplTokenConfig>> = {
  devnet: {
    USDC: {
      kind: "solana",
      cluster: "devnet",
      symbol: "USDC",
      mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      decimals: 6,
      label: "USD Coin (Solana Devnet)",
    },
  },
  "mainnet-beta": {
    USDC: {
      kind: "solana",
      cluster: "mainnet-beta",
      symbol: "USDC",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      decimals: 6,
      label: "USD Coin",
    },
  },
  testnet: {},
};

export function getSplTokenConfig(cluster: "devnet" | "mainnet-beta" | "testnet", symbol: string): SplTokenConfig | undefined {
  return SPL_TOKENS_BY_CLUSTER[cluster]?.[symbol];
}

/* ---- Helpers de conveniencia ---- */
export function detectSolanaCluster(): "devnet" | "mainnet-beta" | "testnet" {
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "";
  if (url.includes("devnet")) return "devnet";
  if (url.includes("testnet")) return "testnet";
  return "mainnet-beta";
}

/** USDC (SPL) según cluster, con override opcional por NEXT_PUBLIC_SPL_MINT */
export function getDefaultSplUsdc() {
  const cluster = detectSolanaCluster();
  const cfg = getSplTokenConfig(cluster, "USDC");
  if (!cfg) return undefined;
  const envMint = process.env.NEXT_PUBLIC_SPL_MINT?.replace(/"/g, "");
  return {
    ...cfg,
    mint: envMint && envMint.length > 0 ? envMint : cfg.mint,
  };
}