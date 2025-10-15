export interface BridgeRequest {
  requestId: bigint;
  sender: string;
  token: string;
  amount: bigint;
  timestamp: bigint;
  encryptedSolanaDestination: string; // hex/bigint-hex handle
}

export interface SolanaTransferResult {
  signature: string;
  success: boolean;
  error?: string;
}

export type BridgeStatus = 'detected' | 'claimed' | 'decrypted' | 'transferred' | 'verified' | 'failed';
