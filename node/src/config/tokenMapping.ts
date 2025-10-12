/**
 * Token mapping between EVM and Solana chains
 * Maps ERC20 addresses to SPL token mint addresses
 */

export interface TokenMapping {
  evmAddress: string;
  solanaAddress: string;
  name: string;
  decimals: {
    evm: number;
    solana: number;
  };
}

// Token mappings for different networks
export const TOKEN_MAPPINGS: Record<number, TokenMapping[]> = {
  // Sepolia testnet
  11155111: [
    {
      evmAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
      solanaAddress: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // USDC on Solana Devnet
      name: "USDC",
      decimals: {
        evm: 6,
        solana: 6,
      },
    },
    // Add more token mappings here
  ],
  // Mainnet (example)
  1: [
    {
      evmAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
      solanaAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC on Solana Mainnet
      name: "USDC",
      decimals: {
        evm: 6,
        solana: 6,
      },
    },
  ],
};

/**
 * Get Solana token address from EVM token address
 */
export function getSolanaTokenAddress(
  evmTokenAddress: string,
  chainId: number
): string | null {
  const mappings = TOKEN_MAPPINGS[chainId];
  if (!mappings) return null;

  const mapping = mappings.find(
    (m) => m.evmAddress.toLowerCase() === evmTokenAddress.toLowerCase()
  );

  return mapping?.solanaAddress || null;
}

/**
 * Get token mapping info
 */
export function getTokenMapping(
  evmTokenAddress: string,
  chainId: number
): TokenMapping | null {
  const mappings = TOKEN_MAPPINGS[chainId];
  if (!mappings) return null;

  return (
    mappings.find(
      (m) => m.evmAddress.toLowerCase() === evmTokenAddress.toLowerCase()
    ) || null
  );
}

/**
 * Check if token is native (ETH/SOL)
 */
export function isNativeToken(tokenAddress: string): boolean {
  return (
    tokenAddress === "0x0000000000000000000000000000000000000000" ||
    tokenAddress.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  );
}
