// src/bridge-sol-to-evm/types.ts
export interface SolBridgeRequest {
  requestId: bigint;
  payer: string;             // base58
  tokenMint: string;         // base58 (NATIVE_MINT si SOL/WSOL)
  amount: bigint;            // amount_locked (neto) en u64
  timestamp: bigint;
}

export interface EvmTransferResult {
  txHash: string;
  success: boolean;
  error?: string;
}

export type BridgeStatusSolToEvm =
  | 'detected' | 'claimed' | 'decrypted' | 'transferred' | 'verified' | 'failed';
