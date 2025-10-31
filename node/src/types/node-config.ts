  // Asegurate que este sea el NodeConfig real que usa tu app
  export interface NodeConfig {
    // Ethereum
    ethereumRpcUrl: string;
    ethereumPrivateKey: string; // 0x-prefixed
    fhevmChainId: number;
    newRelayerAddress?: string;

    // Solana
    solanaRpcUrl: string;
    solanaPrivateKey: string; // base58 o JSON array
    solanaProgramId: string;
    solanaMinSolverBondLamports?: number;
    solanaSignSeed?: string; // <-- ADD

    // Node
    bondAmount: string;
    pollInterval: number;

    // FHE (EVM side)
    fhevmGatewayUrl: string;
    fhevmAclAddress: string;
    fhevmKmsVerifierAddress: string;

    // External relayer
    relayerApiUrl?: string;

    // Tests (opcionales)
    testSolanaDestination?: string;
    testEvmDestination?: string;

    // Tokens
    ethUsdcAddress: string;
    solUsdcAddress: string;
    tokenDecimalsEvm: number;
    tokenDecimalsSol: number;

    // Arcium (program + compdefs + fixed PDAs)
    arciumProgramId: string;
    arciumMxeProgramId: string;
    arciumCompDefResealPda: string;
    arciumCompDefPlanPayoutPda: string;

    // PDAs fijos de cluster (FRONT->NODE)
    arciumClusterPda: string; // <-- ADD
    arciumFeePool: string;    // <-- ADD
    arciumClock: string;      // <-- ADD

    // Reseal MXE pubkey (x25519)
    arciumMxeX25519PublicKey: string;

    // Solver key
    solverX25519Secret: string;
  }
