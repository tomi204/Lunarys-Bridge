import { createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk/node';
import type { FhevmInstance } from '@zama-fhe/relayer-sdk/node';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import { NodeConfig } from 'src/types/node-config';
import {
  FileStringStorage,
  FhevmDecryptionSignature,
  GenericStringStorage,
} from './fheSignature.js';

export class FHEDecryptor {
  private fhevmInstance: FhevmInstance | null = null;
  private config: NodeConfig;
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private keypair: { publicKey: string; privateKey: string } | null = null;
  private signatureStorage: GenericStringStorage;
  private signatureCache = new Map<string, FhevmDecryptionSignature>();

  constructor(
    config: NodeConfig,
    provider: ethers.Provider,
    wallet: ethers.Wallet
  ) {
    this.config = config;
    this.provider = provider;
    this.wallet = wallet;
    this.signatureStorage = new FileStringStorage();
  }

  /**
   * Initialize the FHE instance for decryption
   */
  async initialize(): Promise<void> {
    console.log("Initializing FHE instance with @zama-fhe/relayer-sdk...");

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(new Error('FHE initialization timeout after 30 seconds')),
          30000,
        );
      });

      // Use SepoliaConfig if chainId matches, otherwise use custom config
      let initPromise: Promise<FhevmInstance>;
      if (this.config.fhevmChainId === 11155111) {
        console.log('Using SepoliaConfig preset...');
        initPromise = createInstance({
          ...SepoliaConfig,
          network: this.config.ethereumRpcUrl,
        });
      } else {
        // Custom config for other networks
        console.log('Using custom network config...');
        initPromise = createInstance({
          aclContractAddress: this.config.fhevmAclAddress,
          kmsContractAddress: this.config.fhevmKmsVerifierAddress,
          chainId: this.config.fhevmChainId,
          network: this.config.ethereumRpcUrl,
          // These are required by the SDK - use Sepolia values as defaults
          inputVerifierContractAddress:
            '0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4',
          verifyingContractAddressDecryption:
            '0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1',
          verifyingContractAddressInputVerification:
            '0x7048C39f048125eDa9d678AEbaDfB22F7900a29F',
          gatewayChainId: 55815,
          relayerUrl: 'https://relayer.testnet.zama.cloud',
        });
      }

      // Race between initialization and timeout
      this.fhevmInstance = (await Promise.race([
        initPromise,
        timeoutPromise,
      ])) as FhevmInstance;

      // Generate keypair for decryption
      this.keypair = this.fhevmInstance.generateKeypair();
      this.signatureCache.clear();

      console.log('✓ FHE instance initialized successfully');
      console.log(`✓ Generated keypair for decryption`);
      if (this.signatureStorage instanceof FileStringStorage) {
        console.log(`FHE signature cache: ${this.signatureStorage.location}`);
      }
    } catch (error) {
      console.error('Failed to initialize FHE instance:', error);
      console.log('\n⚠️  FHE decryption will not be available');
      console.log('The node can still run but will skip decryption step');
      console.log('For testing, you can set a hardcoded destination address\n');
      // Don't throw - allow the node to continue without FHE
    }
  }

  /**
   * Decrypt an encrypted Solana address from the NewRelayer contract
   * @param requestId The bridge request ID
   * @param newRelayerAddress The NewRelayer contract address
   * @returns The decrypted Solana address as a string (base58)
   */
  async decryptSolanaAddress(
    requestId: bigint,
    newRelayerAddress: string,
  ): Promise<string> {
    if (!this.fhevmInstance) {
      throw new Error('FHE instance not initialized. Call initialize() first.');
    }

    try {
      console.log(`Decrypting Solana address for request ID: ${requestId}`);

      // ABI for NewRelayer contract
      // Note: euint256 is stored as uint256 in the ABI but represents an FHE handle
      const newRelayerAbi = [
        'function bridgeRequests(uint256) view returns (address sender, address token, uint256 amount, uint256 encryptedSolanaDestination, uint256 timestamp, bool finalized, uint256 fee)',
      ];

      const newRelayer = new ethers.Contract(
        newRelayerAddress,
        newRelayerAbi,
        this.provider,
      );

      // Get the bridge request from the contract
      console.log('Fetching bridge request from contract...');
      const bridgeRequest = await newRelayer.bridgeRequests(requestId);

      console.log('Raw bridge request:', bridgeRequest);

      // Extract the encrypted handle (euint256)
      // In Solidity storage, euint256 is stored as a uint256 handle ID
      const encryptedHandle = bridgeRequest.encryptedSolanaDestination;

      console.log(`Encrypted handle obtained: ${encryptedHandle}`);
      console.log(`Encrypted handle type: ${typeof encryptedHandle}`);
      console.log(
        `Encrypted handle hex: ${typeof encryptedHandle === 'bigint' ? '0x' + encryptedHandle.toString(16) : encryptedHandle.toString()}`,
      );

      const normalizedContract = ethers.getAddress(newRelayerAddress);
      const signatureBundle = await this.ensureDecryptionSignature([
        normalizedContract,
      ]);

      console.log(
        `Using signer ${signatureBundle.userAddress} with cached FHE key`,
      );

      // Request decryption
      console.log('Requesting decryption');

      // The handle is stored directly as uint256 in the contract
      const handleToDecrypt: bigint = BigInt(encryptedHandle.toString());

      console.log(`Using handle for decryption: ${handleToDecrypt}`);

      // Convert handle to hex string with exactly 66 characters (0x + 64 hex chars)
      // The SDK expects handles to be in hex format with length 66
      const handleHex = '0x' + handleToDecrypt.toString(16).padStart(64, '0');

      console.log(`Handle in hex format: ${handleHex}`);
      console.log(`Handle hex length: ${handleHex.length}`);

      // Prepare handle-contract pairs
      const handleContractPairs = [
        {
          handle: handleHex,
          contractAddress: normalizedContract,
        },
      ];

      console.log('Calling userDecrypt');
      const startTimestamp = signatureBundle.startTimestamp.toString();
      const durationDays = signatureBundle.durationDays.toString();

      // Use userDecrypt from @zama-fhe/relayer-sdk
      const result = await this.fhevmInstance.userDecrypt(
        handleContractPairs,
        signatureBundle.privateKey,
        signatureBundle.publicKey,
        signatureBundle.signature,
        signatureBundle.contractAddresses,
        signatureBundle.userAddress,
        startTimestamp,
        durationDays,
      );

      // Result is an object where key is the handle
      const decryptedValue = result[handleHex];

      if (!decryptedValue) {
        throw new Error("Decryption failed: No result for handle");
      }

      console.log(`Decrypted value (uint256): ${decryptedValue}`);

      // Convert the decrypted uint256 to a Solana address (base58)
      const solanaAddress = this.uint256ToSolanaAddress(BigInt(decryptedValue));
      console.log(`Converted to Solana address: ${solanaAddress}`);

      return solanaAddress;
    } catch (error) {
      console.error("Error decrypting Solana address:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message);
        if ("cause" in error) {
          console.error("Error cause:", error.cause);
        }
      }
      throw error;
    }
  }

  private getSignatureCacheKey(contractAddresses: string[]): string {
    return contractAddresses
      .map((address) => ethers.getAddress(address))
      .sort((a, b) => a.localeCompare(b))
      .join('|');
  }

  private async ensureDecryptionSignature(
    contractAddresses: string[],
  ): Promise<FhevmDecryptionSignature> {
    if (!this.fhevmInstance) {
      throw new Error('FHE instance not initialized. Call initialize() first.');
    }

    const normalized = contractAddresses.map((address) =>
      ethers.getAddress(address),
    );
    const cacheKey = this.getSignatureCacheKey(normalized);

    const cached = this.signatureCache.get(cacheKey);
    if (cached) {
      if (cached.isValid()) {
        console.log('Reusing cached FHE decryption signature');
        return cached;
      }
      this.signatureCache.delete(cacheKey);
    }

    const signature = await FhevmDecryptionSignature.loadOrSign(
      this.fhevmInstance,
      normalized,
      this.wallet,
      this.signatureStorage,
      this.keypair ?? undefined,
    );

    if (!signature) {
      throw new Error('Unable to obtain FHE decryption signature');
    }

    this.keypair = {
      publicKey: signature.publicKey,
      privateKey: signature.privateKey,
    };

    console.log('Signed fresh FHE decryption authorization request');
    this.signatureCache.set(cacheKey, signature);
    return signature;
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
    const hex = value.toString(16).padStart(64, '0');

    // Convert hex string to Uint8Array
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }

    return bytes;
  }

  /**
   * Get the public key for this decryptor
   * This can be used to grant permissions in the contract
   */
  getPublicKey(): string | null {
    return this.keypair?.publicKey ?? null;
  }
}
