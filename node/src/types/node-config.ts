export interface NodeConfig {
  // --- Ethereum / EVM ---
  ethereumRpcUrl: string;
  ethereumPrivateKey: string;
  fhevmChainId: number;          // ej 11155111
  newRelayerAddress: string;

  // FHE / opcionales
  fhevmGatewayUrl?: string;
  fhevmAclAddress?: string;
  fhevmKmsVerifierAddress?: string;
  relayerPrivateKey?: string;

  // --- Solana ---
  solanaRpcUrl: string;
  solanaPrivateKey: string;

  // Necesarios para SOL → EVM
  solanaProgramId: string;               // Program ID (Pubkey)
  solanaMinSolverBondLamports?: number;  // default en config
  solanaRequestOwner?: string;           // Pubkey; si tus seeds lo requieren

  // --- Relayer externo ---
  relayerApiUrl?: string;

  // --- Bridge / Node settings ---
  bondAmount: string;     // "0.03"
  pollInterval: number;   // ms

  // --- Token mapping ---
  ethUsdcAddress?: string;  // EVM addr
  solUsdcAddress?: string;  // SPL mint

  // --- Fallbacks de test ---
  testSolanaDestination?: string;  // base58 (EVM→SOL)
  testEvmDestination?: string;     // 0x... (SOL→EVM)
}
