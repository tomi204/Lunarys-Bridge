export type NodeConfig = {
  // Ethereum
  ethereumRpcUrl: string;
  ethereumPrivateKey: string;
  fhevmChainId: number;
  newRelayerAddress?: string;

  // Solana
  solanaRpcUrl: string;
  solanaPrivateKey: string;
  solanaProgramId: string;
  solanaMinSolverBondLamports?: number;
  solanaRequestOwner?: string; // <- optional

  // Node
  bondAmount?: string;
  pollInterval?: number;

  // FHE (EVM side)
  fhevmGatewayUrl: string;
  fhevmAclAddress: string;
  fhevmKmsVerifierAddress: string;

  // External relayer
  relayerApiUrl?: string;

  // Tests/fallbacks
  testSolanaDestination?: string;
  testEvmDestination?: string;

  // Tokens
  ethUsdcAddress: string;
  solUsdcAddress: string;
  tokenDecimalsEvm: number;
  tokenDecimalsSol: number;

  // Arcium
  arciumProgramId?: string;
  arciumMxeProgramId: string;
  arciumCompDefResealPda: string;
  arciumCompDefPlanPayoutPda?: string;
  arciumMxeX25519PublicKey?: string;

  // Solver
  solverX25519Secret?: string;
};
