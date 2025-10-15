export type TokenInfo = {
  name: string;
  evm: { address: `0x${string}`; decimals: number };
  sol: { mint: string; decimals: number };
};

// Defaults (USDC devnet: 6 decimals)
const EVM = (process.env.TOKEN_USDC ?? '0xF7F556c59fD417f195ABcd8804e43cfc6714aBF8').toLowerCase();
const MINT = process.env.TOKEN_SOL ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const EVM_DEC = Number(process.env.TOKEN_USDC_EVM_DECIMALS ?? 6);
const SOL_DEC = Number(process.env.TOKEN_USDC_SOL_DECIMALS ?? 6);

const BY_EVM_ADDRESS: Record<string, TokenInfo> = {
  [EVM]: {
    name: 'USDC',
    evm: { address: EVM as `0x${string}`, decimals: EVM_DEC },
    sol: { mint: MINT, decimals: SOL_DEC },
  },
};

export function findTokenInfo(evmAddress: string): TokenInfo | undefined {
  return BY_EVM_ADDRESS[evmAddress.toLowerCase()];
}

const pow10 = (d: number) => 10n ** BigInt(Math.abs(d));

export function adjustToSolDecimals(amountEvm: bigint, info: TokenInfo) {
  // EVM units -> SPL units
  const diff = info.sol.decimals - info.evm.decimals;
  const solAmount = diff >= 0 ? amountEvm * pow10(diff) : amountEvm / pow10(-diff);
  return { solAmount, mint: info.sol.mint };
}

export function adjustToEvmDecimals(amountSol: bigint, info: TokenInfo) {
  if (amountSol < 0n) throw new Error('amountSol must be non-negative');
  const diff = info.evm.decimals - info.sol.decimals;
  const evmAmount = diff >= 0 ? amountSol * pow10(diff) : amountSol / pow10(-diff);
  return { evmAmount, token: info.evm.address };
}
