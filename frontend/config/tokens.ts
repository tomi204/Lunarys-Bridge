import { TOKEN_USDC } from "@/lib/constants";

export type TokenConfig = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  label?: string;
};

const TOKENS_BY_CHAIN: Record<number, Record<string, TokenConfig>> = {
  11155111: {
    USDC: {
      symbol: "USDC",
      address: TOKEN_USDC as `0x${string}`,
      decimals: 6,
      label: "USD Coin",
    },
    CTKN: {
      symbol: "CTKN",
      address: "0x0F8902A83c9b20f2183dBc0d6672Ee0905B2Ca7d",
      decimals: 18,
      label: "Demo token",
    },
  },
};

export function getTokenConfig(
  chainId: number | undefined,
  symbol: string
): TokenConfig | undefined {
  if (!chainId) return undefined;
  const tokens = TOKENS_BY_CHAIN[chainId];
  if (!tokens) return undefined;
  return tokens[symbol];
}

export function listSupportedTokens(chainId: number | undefined): TokenConfig[] {
  if (!chainId) return [];
  return Object.values(TOKENS_BY_CHAIN[chainId] ?? {});
}
