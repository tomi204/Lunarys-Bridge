import { NodeConfig } from 'src/types/node-config';

export default (): NodeConfig => {
  const cfg: NodeConfig = {
    // Ethereum
    ethereumRpcUrl: process.env.ETHEREUM_RPC_URL ?? 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    newRelayerAddress: process.env.NEW_RELAYER_ADDRESS!,
    ethereumPrivateKey: process.env.ETHEREUM_PRIVATE_KEY!,

    // Solana
    solanaRpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY!,

    // Program used in the SOL → EVM flow
    solanaProgramId: process.env.SOLANA_PROGRAM_ID ?? '',
    solanaMinSolverBondLamports: parseInt(process.env.SOLANA_MIN_SOLVER_BOND_LAMPORTS ?? '1000000', 10),
    solanaRequestOwner: process.env.SOLANA_REQUEST_OWNER ?? '',

    // Node settings
    bondAmount: process.env.BOND_AMOUNT ?? '0.03',
    pollInterval: parseInt(process.env.POLL_INTERVAL ?? '12000', 10),

    // FHE
    fhevmChainId: parseInt(process.env.FHEVM_CHAIN_ID ?? '11155111', 10),
    fhevmGatewayUrl: process.env.FHEVM_GATEWAY_URL ?? 'https://gateway.sepolia.zama.ai',
    fhevmAclAddress: process.env.FHEVM_ACL_ADDRESS ?? '0x339EcE85B9E11a3A3AA557582784a15d7F82AAf2',
    fhevmKmsVerifierAddress: process.env.FHEVM_KMS_VERIFIER_ADDRESS ?? '0x9D6891A6240D6130c54ae243d8005063D05fE14b',

    // External relayer API base URL
    relayerApiUrl: process.env.RELAYER_API_URL ?? '',

    // Test destinations (fallbacks)
    testSolanaDestination: process.env.TEST_SOLANA_DESTINATION ?? '',
    testEvmDestination: process.env.TEST_EVM_DESTINATION ?? '',

    // Token mapping
    ethUsdcAddress: process.env.TOKEN_USDC ?? '',
    solUsdcAddress: process.env.TOKEN_SOL ?? '',
  };

  if (!cfg.ethereumPrivateKey) throw new Error('ETHEREUM_PRIVATE_KEY is required in .env');
  if (!cfg.newRelayerAddress) throw new Error('NEW_RELAYER_ADDRESS is required in .env');
  if (!cfg.solanaPrivateKey) throw new Error('SOLANA_PRIVATE_KEY is required in .env');

  // Required if you run the SOL → EVM flow
  if (!cfg.solanaProgramId) {
    throw new Error('SOLANA_PROGRAM_ID is required in .env for SOL→EVM bridging');
  }

  return cfg;
};
