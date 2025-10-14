export type TokenInfo = {
  name: string;
  evm: { address: `0x${string}`; decimals: number };
  sol: { mint: string; decimals: number }; // base58 mint
};

const BY_EVM_ADDRESS: Record<string, TokenInfo> = {
  // USDC (your test addresses)
  '0xf7f556c59fd417f195abcd8804e43cfc6714abf8': {
    name: 'USDC',
    evm: { address: '0xF7F556c59fD417f195ABcd8804e43cfc6714aBF8', decimals: 6 },
    sol: { mint: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', decimals: 6 }, // change if your mint uses other decimals
  },
};

export function findTokenInfo(evmAddress: string): TokenInfo | undefined {
  return BY_EVM_ADDRESS[evmAddress.toLowerCase()];
}

export function adjustToSolDecimals(amountEvm: bigint, info: TokenInfo) {
  const diff = info.sol.decimals - info.evm.decimals;
  const solAmount =
    diff >= 0 ? amountEvm * BigInt(10 ** diff) : amountEvm / BigInt(10 ** -diff);
  return { solAmount, mint: info.sol.mint };
}

export function adjustToEvmDecimals(amountSol: bigint, info: TokenInfo) {
  const diff = info.evm.decimals - info.sol.decimals;
  const evmAmount =
    diff >= 0 ? amountSol * BigInt(10 ** diff) : amountSol / BigInt(10 ** -diff);
  return { evmAmount, token: info.evm.address };
}
