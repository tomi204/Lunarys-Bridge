import { createInstance } from "fhevmjs/node";
import type { FhevmInstance } from "fhevmjs/node";
import { ethers } from "ethers";
import { NodeConfig } from "../types";
import bs58 from "bs58";

export class FHEDecryptor {
  private fhevmInstance: FhevmInstance | null = null;
  private config: NodeConfig;
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;

  constructor(config: NodeConfig, provider: ethers.Provider, wallet: ethers.Wallet) {
    this.config = config;
    this.provider = provider;
    this.wallet = wallet;
  }

  /**
   * Initialize the FHE instance for decryption
   */
  async initialize(): Promise<void> {
    console.log("Initializing FHE instance for fhevmjs...");

    try {
      this.fhevmInstance = await createInstance({
        chainId: this.config.fhevmChainId,
        networkUrl: this.config.ethereumRpcUrl,
        gatewayUrl: this.config.fhevmGatewayUrl,
      });

      console.log("✓ FHE instance initialized successfully");
    } catch (error) {
      console.error("Failed to initialize FHE instance:", error);
      console.log("\n⚠️  FHE decryption will not be available");
      console.log("The node can still run but will skip decryption step");
      console.log("For testing, you can set a hardcoded destination address\n");
      // Don't throw - allow the node to continue without FHE
    }
  }

  /**
   * Decrypt an encrypted Solana address from the NewRelayer contract
   * @param requestId The bridge request ID
   * @param newRelayerAddress The NewRelayer contract address
   * @returns The decrypted Solana address as a string (base58)
   */
  async decryptSolanaAddress(requestId: bigint, newRelayerAddress: string): Promise<string> {
    if (!this.fhevmInstance) {
      throw new Error("FHE instance not initialized. Call initialize() first.");
    }

    try {
      console.log(`Decrypting Solana address for request ID: ${requestId}`);

      // ABI for NewRelayer contract with the correct struct definition
      const newRelayerAbi = [
        "function bridgeRequests(uint256) view returns (address sender, address token, uint256 amount, tuple(uint256, bytes) encryptedSolanaDestination, uint256 timestamp, bool finalized, uint256 fee)",
      ];

      const newRelayer = new ethers.Contract(newRelayerAddress, newRelayerAbi, this.provider);

      // Get the bridge request from the contract
      console.log("Fetching bridge request from contract...");
      const bridgeRequest = await newRelayer.bridgeRequests(requestId);

      // Extract the encrypted handle (euint256)
      // The encryptedSolanaDestination is a tuple(uint256, bytes) where the first element is the handle
      const encryptedHandle = bridgeRequest.encryptedSolanaDestination[0];

      console.log(`Encrypted handle obtained: ${encryptedHandle}`);

      // Create EIP-712 for decryption request
      // Using the Relayer SDK's decrypt functionality
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 1; // 1 day validity for decryption signature

      const eip712 = this.fhevmInstance.createEIP712(
        this.wallet.address, // public key (user address in this case)
        [newRelayerAddress], // contract addresses
        startTimestamp,
        durationDays
      );

      console.log("Signing decryption request...");
      const signature = await this.wallet.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      // Request decryption from the relayer
      console.log("Requesting decryption from Zama Gateway...");
      const decryptionResults = await this.fhevmInstance.decrypt([
        {
          handle: encryptedHandle,
          contractAddress: newRelayerAddress,
        }
      ], signature);

      if (!decryptionResults || decryptionResults.length === 0) {
        throw new Error("Decryption failed: No results returned");
      }

      const decryptedValue = decryptionResults[0];
      console.log(`Decrypted value (uint256): ${decryptedValue}`);

      // Convert the decrypted uint256 to a Solana address (base58)
      const solanaAddress = this.uint256ToSolanaAddress(BigInt(decryptedValue));
      console.log(`Converted to Solana address: ${solanaAddress}`);

      return solanaAddress;
    } catch (error) {
      console.error("Error decrypting Solana address:", error);
      throw error;
    }
  }

  /**
   * Convert a uint256 (bigint) to a Solana address (base58)
   * In the frontend, the Solana address was converted from base58 to uint256 before encryption
   * Now we need to reverse that process
   */
  private uint256ToSolanaAddress(value: bigint): string {
    // Convert the uint256 to 32 bytes (Solana public key size)
    const addressBytes = this.bigIntToBytes32(value);

    // Encode the 32 bytes to base58 (Solana address format)
    const base58Address = bs58.encode(addressBytes);

    return base58Address;
  }

  /**
   * Convert a bigint to 32 bytes (Uint8Array)
   * Solana addresses are 32-byte public keys
   */
  private bigIntToBytes32(value: bigint): Uint8Array {
    // Convert bigint to hex string with 64 characters (32 bytes)
    const hex = value.toString(16).padStart(64, "0");

    // Convert hex string to Uint8Array
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }

    return bytes;
  }
}
