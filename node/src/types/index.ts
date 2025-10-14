export interface BridgeRequest {
  requestId: bigint;
  sender: string;
  token: string;
  amount: bigint;
  timestamp: bigint;
  encryptedSolanaDestination: string;
}

export interface NodeConfig {
  // Ethereum configuration
  ethereumRpcUrl: string;
  newRelayerAddress: string;
  ethereumPrivateKey: string;

  // Solana configuration
  solanaRpcUrl: string;
  solanaPrivateKey: string;

  // Node settings
  bondAmount: string; // in ETH
  pollInterval: number; // milliseconds

  // FHE configuration
  fhevmChainId: number;
  fhevmGatewayUrl: string;
  fhevmAclAddress: string;
  fhevmKmsVerifierAddress: string;

  // Relayer (for FHE permissions)
  relayerPrivateKey?: string; // Optional: If node acts as relayer for decryption
}

export interface ClaimResult {
  requestId: bigint;
  txHash: string;
  solanaDestination: string;
  success: boolean;
  error?: string;
}

export interface SolanaTransferResult {
  signature: string;
  success: boolean;
  error?: string;
}
