export interface NodeConfig {
  ethereumRpcUrl: string;
  newRelayerAddress: string;
  ethereumPrivateKey: string;

  solanaRpcUrl: string;
  solanaPrivateKey: string;

  bondAmount: string;
  pollInterval: number;

  fhevmChainId: number;
  fhevmGatewayUrl: string;
  fhevmAclAddress: string;
  fhevmKmsVerifierAddress: string;

  relayerApiUrl?: string;

  testSolanaDestination?: string;
  ethUsdcAddress?: string;
  solUsdcAddress?: string;

  testEvmDestination?: string;
  solanaProgramId: string;
  solanaMinSolverBondLamports?: number;
  solanaRequestOwner?: string;

  tokenDecimalsEvm: number;
  tokenDecimalsSol: number;
}
