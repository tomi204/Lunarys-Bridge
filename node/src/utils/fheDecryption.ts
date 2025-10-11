import { createInstance, FhevmInstance } from "fhevmjs";
import { ethers } from "ethers";
import { NodeConfig } from "../types";

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
    console.log("Initializing FHE instance...");

    this.fhevmInstance = await createInstance({
      chainId: this.config.fhevmChainId,
      networkUrl: this.config.ethereumRpcUrl,
      gatewayUrl: this.config.fhevmGatewayUrl,
    });

    console.log("FHE instance initialized successfully");
  }

  /**
   * Decrypt an encrypted Solana address from the NewRelayer contract
   * @param requestId The bridge request ID
   * @param newRelayerAddress The NewRelayer contract address
   * @returns The decrypted Solana address as a string
   */
  async decryptSolanaAddress(requestId: bigint, newRelayerAddress: string): Promise<string> {
    if (!this.fhevmInstance) {
      throw new Error("FHE instance not initialized. Call initialize() first.");
    }

    try {
      console.log(`Decrypting Solana address for request ID: ${requestId}`);

      // Get the encrypted handle from the contract
      // The contract stores the encrypted address, we need to request decryption
      const { publicKey, privateKey } = this.fhevmInstance.generateKeypair();

      // Create EIP-712 signature for decryption permission
      const eip712 = this.fhevmInstance.createEIP712(publicKey, newRelayerAddress);
      const signature = await this.wallet.signTypedData(
        eip712.domain,
        { Reencrypt: eip712.types.Reencrypt },
        eip712.message
      );

      // Get the encrypted handle from the contract's storage
      // In the NewRelayer contract, the encryptedSolanaDestination is stored in the BridgeRequest struct
      const newRelayerAbi = [
        "function bridgeRequests(uint256) view returns (address sender, address token, uint256 amount, uint256 timestamp, address claimer, uint256 claimExpiry, bool verified, bool settled)",
      ];

      const newRelayer = new ethers.Contract(newRelayerAddress, newRelayerAbi, this.provider);

      // Note: We need to get the encrypted handle separately as it's not in the main struct
      // This would typically be done through a view function that returns the encrypted data
      // For now, we'll use a placeholder approach - in production, add a getter function to the contract

      console.log("Note: Encrypted address decryption requires contract support for FHE reencryption");
      console.log(
        "The NewRelayer contract needs a view function to return the encrypted Solana destination"
      );

      // Placeholder for actual decryption
      // In a real implementation, you would:
      // 1. Call a view function on NewRelayer that returns the encrypted handle
      // 2. Use fhevmInstance.reencrypt() to decrypt it
      // 3. Parse the result as a Solana address

      // Example of what the actual decryption would look like:
      // const encryptedHandle = await newRelayer.getEncryptedDestination(requestId);
      // const decryptedValue = await this.fhevmInstance.reencrypt(
      //   encryptedHandle,
      //   privateKey,
      //   publicKey,
      //   signature,
      //   newRelayerAddress,
      //   this.wallet.address
      // );
      // return this.parseAddressFromDecrypted(decryptedValue);

      throw new Error(
        "FHE decryption not fully implemented. NewRelayer contract needs getEncryptedDestination(uint256) view function."
      );
    } catch (error) {
      console.error("Error decrypting Solana address:", error);
      throw error;
    }
  }

  /**
   * Parse a decrypted value into a Solana address string
   * Solana addresses are base58-encoded 32-byte public keys
   */
  private parseAddressFromDecrypted(decryptedValue: bigint): string {
    // Convert the decrypted bigint to a Solana address
    // This is a simplified version - actual implementation depends on how the address is encoded
    const addressBytes = this.bigIntToBytes32(decryptedValue);

    // Convert bytes to base58 for Solana address format
    // Note: You'll need to install bs58 package for this
    // import bs58 from "bs58";
    // return bs58.encode(addressBytes);

    // For now, return hex representation (not a valid Solana address)
    return ethers.hexlify(addressBytes);
  }

  /**
   * Convert a bigint to 32 bytes
   */
  private bigIntToBytes32(value: bigint): Uint8Array {
    const hex = value.toString(16).padStart(64, "0");
    return ethers.getBytes("0x" + hex);
  }
}
