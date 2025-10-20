import { NodeConfig } from 'src/types/node-config';

const num = (s: string | undefined, d: number) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : d;
};

export default (): NodeConfig => {
  const cfg: NodeConfig = {
    // Ethereum
    ethereumRpcUrl: process.env.ETHEREUM_RPC_URL ?? 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    ethereumPrivateKey: process.env.ETHEREUM_PRIVATE_KEY ?? '',
    fhevmChainId: num(process.env.FHEVM_CHAIN_ID, 11155111),  
    newRelayerAddress: process.env.NEW_RELAYER_ADDRESS,

    // Solana
    solanaRpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY ?? '',
    solanaProgramId: process.env.SOLANA_PROGRAM_ID ?? '',
    solanaMinSolverBondLamports: num(process.env.SOLANA_MIN_SOLVER_BOND_LAMPORTS, 1_000_000),
    // OPTIONAL for Variant A; unused for Variant B (we take owner from the event):
    solanaRequestOwner: process.env.SOLANA_REQUEST_OWNER ?? '',

    // Node
    bondAmount: process.env.BOND_AMOUNT ?? '0.03',
    pollInterval: num(process.env.POLL_INTERVAL, 12_000),

    // FHE (EVM side)
    fhevmGatewayUrl: process.env.FHEVM_GATEWAY_URL ?? 'https://gateway.sepolia.zama.ai',
    fhevmAclAddress:
      process.env.FHEVM_ACL_ADDRESS ?? '0x339EcE85B9E11a3A3AA557582784a15d7F82AAf2',
    fhevmKmsVerifierAddress:
      process.env.FHEVM_KMS_VERIFIER_ADDRESS ?? '0x9D6891A6240D6130c54ae243d8005063D05fE14b',

    // External relayer
    relayerApiUrl: process.env.RELAYER_API_URL ?? '',

    // Tests/fallbacks
    testSolanaDestination: process.env.TEST_SOLANA_DESTINATION ?? '',
    testEvmDestination: process.env.TEST_EVM_DESTINATION ?? '',

    // Tokens
    ethUsdcAddress: (process.env.TOKEN_USDC ?? '').trim(),
    solUsdcAddress: (process.env.TOKEN_SOL ?? '').trim(),
    tokenDecimalsEvm: num(process.env.TOKEN_DECIMALS_EVM, 6),
    tokenDecimalsSol: num(process.env.TOKEN_DECIMALS_SOL, 6),

    // Arcium (what you’re actually using)
    arciumProgramId: process.env.ARCIUM_PROGRAM_ID ?? '',
    arciumMxeProgramId: process.env.ARCIUM_MXE_PROGRAM_ID ?? '',
    arciumCompDefResealPda: process.env.ARCIUM_COMPDEF_RESEAL_PDA ?? '',
    arciumCompDefPlanPayoutPda: process.env.ARCIUM_COMPDEF_PLAN_PAYOUT_PDA ?? '',
    arciumMxeX25519PublicKey: process.env.ARCIUM_MXE_X25519_PUBLIC_KEY ?? '',

    // Solver key
    solverX25519Secret: process.env.SOLVER_X25519_SECRET ?? '',
  };

  // Minimal required
  if (!cfg.ethereumPrivateKey) throw new Error('ETHEREUM_PRIVATE_KEY is required');
  if (!cfg.solanaPrivateKey) throw new Error('SOLANA_PRIVATE_KEY is required');
  if (!cfg.solanaProgramId) throw new Error('SOLANA_PROGRAM_ID is required');

  // FHE addresses needed by your EVM-side init
  if (!cfg.fhevmAclAddress) throw new Error('FHEVM_ACL_ADDRESS is required');
  if (!cfg.fhevmKmsVerifierAddress) throw new Error('FHEVM_KMS_VERIFIER_ADDRESS is required');

  // Arcium minimal (claim→reseal)
  if (!cfg.arciumMxeProgramId) throw new Error('ARCIUM_MXE_PROGRAM_ID is required');
  if (!cfg.arciumCompDefResealPda) throw new Error('ARCIUM_COMPDEF_RESEAL_PDA is required');

  // NOTE: solanaRequestOwner is OPTIONAL now.

  return cfg;
};
