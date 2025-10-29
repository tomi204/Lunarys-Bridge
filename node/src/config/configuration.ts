import { NodeConfig } from 'src/types/node-config';

const num = (s: string | undefined, d: number) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : d;
};

export default (): NodeConfig => {
  const cfg: NodeConfig = {
    // Ethereum
    ethereumRpcUrl: process.env.ETHEREUM_RPC_URL ?? '',
    // Normalizamos a 0x… si faltara
    ethereumPrivateKey: (process.env.ETHEREUM_PRIVATE_KEY ?? '').startsWith('0x')
      ? (process.env.ETHEREUM_PRIVATE_KEY as string)
      : `0x${process.env.ETHEREUM_PRIVATE_KEY ?? ''}`,
    fhevmChainId: num(process.env.FHEVM_CHAIN_ID, 11155111),
    newRelayerAddress: process.env.NEW_RELAYER_ADDRESS,

    // Solana
    solanaRpcUrl: process.env.SOLANA_RPC_URL ?? '',
    solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY ?? '',
    solanaProgramId: process.env.SOLANA_PROGRAM_ID ?? '',
    solanaMinSolverBondLamports: num(process.env.SOLANA_MIN_SOLVER_BOND_LAMPORTS, 1_000_000),
    solanaSignSeed: process.env.SOLANA_SIGN_SEED ?? 'SignerAccount',

    // Node
    bondAmount: process.env.BOND_AMOUNT ?? '0.03',
    pollInterval: num(process.env.POLL_INTERVAL, 12_000),

    // FHE (EVM side)
    fhevmGatewayUrl: process.env.FHEVM_GATEWAY_URL ?? 'https://gateway.sepolia.zama.ai',
    fhevmAclAddress: process.env.FHEVM_ACL_ADDRESS ?? '',
    fhevmKmsVerifierAddress: process.env.FHEVM_KMS_VERIFIER_ADDRESS ?? '',

    // External relayer
    relayerApiUrl: process.env.RELAYER_API_URL ?? '',

    // Tests
    testSolanaDestination: process.env.TEST_SOLANA_DESTINATION ?? '',
    testEvmDestination: process.env.TEST_EVM_DESTINATION ?? '',

    // Tokens
    ethUsdcAddress: (process.env.TOKEN_USDC ?? '').trim(),
    solUsdcAddress: (process.env.TOKEN_SOL ?? '').trim(),
    tokenDecimalsEvm: num(process.env.TOKEN_DECIMALS_EVM, 6),
    tokenDecimalsSol: num(process.env.TOKEN_DECIMALS_SOL, 6),

    // Arcium (program + compdefs + fixed PDAs)
    arciumProgramId: process.env.ARCIUM_PROGRAM_ID ?? '',
    arciumMxeProgramId: process.env.ARCIUM_MXE_PROGRAM_ID ?? '',
    arciumCompDefResealPda: process.env.ARCIUM_COMPDEF_RESEAL_PDA ?? '',
    arciumCompDefPlanPayoutPda: process.env.ARCIUM_COMPDEF_PLAN_PAYOUT_PDA ?? '',

    // PDAs fijos de cluster
    arciumClusterPda: process.env.ARCIUM_CLUSTER_PDA ?? '',
    arciumFeePool: process.env.ARCIUM_FEE_POOL ?? '',
    arciumClock: process.env.ARCIUM_CLOCK ?? '',

    // Reseal MXE x25519 pub
    arciumMxeX25519PublicKey: process.env.ARCIUM_MXE_X25519_PUBLIC_KEY ?? '',

    // Solver key
    solverX25519Secret: process.env.SOLVER_X25519_SECRET ?? '',
  };

  // Requeridos mínimos
  if (!cfg.ethereumPrivateKey || cfg.ethereumPrivateKey.length < 10) throw new Error('ETHEREUM_PRIVATE_KEY is required');
  if (!cfg.solanaPrivateKey) throw new Error('SOLANA_PRIVATE_KEY is required');
  if (!cfg.solanaProgramId) throw new Error('SOLANA_PROGRAM_ID is required');
  if (!cfg.fhevmAclAddress) throw new Error('FHEVM_ACL_ADDRESS is required');
  if (!cfg.fhevmKmsVerifierAddress) throw new Error('FHEVM_KMS_VERIFIER_ADDRESS is required');
  if (!cfg.arciumMxeProgramId) throw new Error('ARCIUM_MXE_PROGRAM_ID is required');
  if (!cfg.arciumCompDefResealPda) throw new Error('ARCIUM_COMPDEF_RESEAL_PDA is required');

  // PDAs fijos del cluster (para claim reseal)
  if (!cfg.arciumClusterPda) throw new Error('ARCIUM_CLUSTER_PDA is required');
  if (!cfg.arciumFeePool) throw new Error('ARCIUM_FEE_POOL is required');
  if (!cfg.arciumClock) throw new Error('ARCIUM_CLOCK is required');

  return cfg;
};
