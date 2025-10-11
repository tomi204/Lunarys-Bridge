import { NodeConfig } from "../types";
import * as dotenv from "dotenv";

dotenv.config();

export function getConfig(): NodeConfig {
  const config: NodeConfig = {
    // Ethereum configuration
    ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
    newRelayerAddress: process.env.NEW_RELAYER_ADDRESS || "",
    ethereumPrivateKey: process.env.ETHEREUM_PRIVATE_KEY || "",

    // Solana configuration
    solanaRpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    solanaPrivateKey: process.env.SOLANA_PRIVATE_KEY || "",

    // Node settings
    bondAmount: process.env.BOND_AMOUNT || "0.03", // 0.03 ETH minimum bond
    pollInterval: parseInt(process.env.POLL_INTERVAL || "12000"), // 12 seconds

    // FHE configuration
    fhevmChainId: parseInt(process.env.FHEVM_CHAIN_ID || "11155111"), // Sepolia chain ID
    fhevmGatewayUrl: process.env.FHEVM_GATEWAY_URL || "https://gateway.sepolia.zama.ai",
  };

  // Validate required configuration
  if (!config.ethereumPrivateKey) {
    throw new Error("ETHEREUM_PRIVATE_KEY is required in .env");
  }

  if (!config.newRelayerAddress) {
    throw new Error("NEW_RELAYER_ADDRESS is required in .env");
  }

  if (!config.solanaPrivateKey) {
    throw new Error("SOLANA_PRIVATE_KEY is required in .env");
  }

  return config;
}
