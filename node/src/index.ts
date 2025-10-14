console.log("=== Bridge Node Starting ===");
console.log("Loading modules...");

import { getConfig } from "./config/config.js";
import { EthereumMonitor } from "./services/ethereumMonitor.js";
import { SolanaTransferService } from "./services/solanaTransfer.js";
import { RelayerApiClient } from "./services/relayerApi.js";
import { FHEDecryptor } from "./utils/fheDecryption.js";
import { BridgeRequest } from "./types/index.js";
import { ethers } from "ethers";

console.log("All modules loaded successfully");

class BridgeNode {
  private config = getConfig();
  private ethereumMonitor: EthereumMonitor;
  private solanaTransfer: SolanaTransferService;
  private relayerApi: RelayerApiClient;
  private fheDecryptor: FHEDecryptor | null = null;
  private processing = new Set<string>(); // Track requests being processed

  constructor() {
    this.ethereumMonitor = new EthereumMonitor(this.config);
    this.solanaTransfer = new SolanaTransferService(this.config);
    this.relayerApi = new RelayerApiClient();
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    console.log("\n========================================");
    console.log("   Bridge Node Initializing");
    console.log("========================================\n");

    // Initialize Ethereum monitor
    await this.ethereumMonitor.initialize();

    // Initialize FHE decryptor
    const provider = new ethers.JsonRpcProvider(this.config.ethereumRpcUrl);

    // Use relayer private key if available (relayer has FHE permissions in contract)
    // Otherwise use node's own private key
    const decryptionPrivateKey =
      this.config.relayerPrivateKey || this.config.ethereumPrivateKey;
    const wallet = new ethers.Wallet(decryptionPrivateKey, provider);

    if (this.config.relayerPrivateKey) {
      console.log(
        `Using relayer identity for FHE decryption: ${wallet.address}`
      );
    } else {
      console.log(`Using node identity for FHE decryption: ${wallet.address}`);
    }

    this.fheDecryptor = new FHEDecryptor(this.config, provider, wallet);
    await this.fheDecryptor.initialize();
    const decryptorPublicKey = this.fheDecryptor.getPublicKey();
    if (decryptorPublicKey) {
      console.log(`FHE decryptor ready. Public key: ${decryptorPublicKey}`);
    } else {
      console.log(
        "FHE decryptor not fully available; TEST_SOLANA_DESTINATION fallback may be required"
      );
    }

    // Check Solana balance
    const solBalance = await this.solanaTransfer.getBalance();
    console.log(`Solana wallet balance: ${solBalance} SOL`);

    console.log("\n========================================");
    console.log("   Node Configuration");
    console.log("========================================");
    console.log(`Ethereum Node: ${this.ethereumMonitor.getWalletAddress()}`);
    console.log(`Solana Node: ${this.solanaTransfer.getWalletAddress()}`);
    console.log(`Bond Amount: ${this.config.bondAmount} ETH`);
    console.log(`NewRelayer: ${this.config.newRelayerAddress}`);
    console.log("========================================\n");

    // Check relayer API health
    const apiHealthy = await this.relayerApi.healthCheck();
    if (!apiHealthy) {
      console.warn("⚠ WARNING: Relayer API is not responding");
      console.warn(
        "The node will continue, but verification submissions may fail\n"
      );
    }

    console.log("✓ All services initialized successfully!\n");
  }

  /**
   * Start the bridge node
   */
  async start(): Promise<void> {
    await this.initialize();

    console.log("========================================");
    console.log("   Bridge Node Started");
    console.log("========================================");
    console.log("Listening for bridge requests...\n");

    // Start monitoring for bridge events
    await this.ethereumMonitor.startMonitoring(
      async (request: BridgeRequest) => {
        await this.processBridgeRequest(request);
      }
    );

    // Keep the process alive
    process.on("SIGINT", () => {
      console.log("\n\nShutting down bridge node...");
      this.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("\n\nShutting down bridge node...");
      this.stop();
      process.exit(0);
    });
  }

  /**
   * Process a bridge request
   */
  private async processBridgeRequest(request: BridgeRequest): Promise<void> {
    const requestIdStr = request.requestId.toString();

    // Prevent duplicate processing
    if (this.processing.has(requestIdStr)) {
      console.log(
        `Request ${requestIdStr} is already being processed, skipping...`
      );
      return;
    }

    this.processing.add(requestIdStr);

    try {
      console.log(`\n>>> Processing bridge request ${requestIdStr}...`);

      // Step 1: Check if already claimed
      const isClaimed = await this.ethereumMonitor.isRequestClaimed(
        request.requestId
      );
      if (isClaimed) {
        console.log(
          `Request ${requestIdStr} has already been claimed by another node`
        );
        return;
      }

      // Step 2: Claim the bridge request
      console.log(`\n[1/4] Claiming bridge request on Ethereum...`);
      const claimTxHash = await this.ethereumMonitor.claimBridgeRequest(
        request.requestId
      );

      // Step 3: Decrypt the Solana destination address
      console.log(`\n[2/4] Decrypting Solana destination address...`);
      let solanaDestination: string;

      try {
        if (!this.fheDecryptor) {
          throw new Error("FHE decryptor not initialized");
        }
        solanaDestination = await this.fheDecryptor.decryptSolanaAddress(
          request.requestId,
          this.config.newRelayerAddress
        );
        console.log(`Decrypted destination: ${solanaDestination}`);
      } catch (error) {
        console.error("FHE decryption error:", error);

        // TEMPORARY SOLUTION: Use hardcoded destination for testing
        // TODO: Remove once the decryptor succeeds against the gateway in all environments
        const testDestination = process.env.TEST_SOLANA_DESTINATION;

        if (testDestination) {
          console.log(
            `\n⚠️  Using TEST destination address: ${testDestination}`
          );
          console.log("   (Set TEST_SOLANA_DESTINATION in .env for testing)");
          solanaDestination = testDestination;
        } else {
          console.log(
            "\n⚠ FHE decryption failed and no TEST_SOLANA_DESTINATION set"
          );
          console.log(
            "Set TEST_SOLANA_DESTINATION in .env to continue testing"
          );
          console.log(
            "Example: TEST_SOLANA_DESTINATION=YourSolanaAddressHere\n"
          );

          throw new Error(
            "FHE decryption not available - set TEST_SOLANA_DESTINATION for testing"
          );
        }
      }

      // Step 4: Transfer tokens to Solana
      console.log(`\n[3/4] Transferring tokens on Solana...`);

      // Import token mapping utilities
      const { getTokenMapping, isNativeToken } = await import(
        "./config/tokenMapping.js"
      );

      let transferResult;

      // Check if it's a native token (ETH)
      if (isNativeToken(request.token)) {
        console.log("Detected native token (ETH) - transferring SOL on Solana");
        transferResult = await this.solanaTransfer.transferSOL(
          solanaDestination,
          request.amount
        );
      } else {
        // It's an ERC20 token, find the SPL equivalent
        const tokenMapping = getTokenMapping(
          request.token,
          this.config.fhevmChainId
        );

        if (!tokenMapping) {
          throw new Error(
            `No token mapping found for ERC20 token: ${request.token}`
          );
        }

        console.log(
          `Detected ${tokenMapping.name} token - transferring to SPL mint: ${tokenMapping.solanaAddress}`
        );

        // Convert amount based on decimals difference
        let convertedAmount = request.amount;
        if (tokenMapping.decimals.evm !== tokenMapping.decimals.solana) {
          // Convert from EVM decimals to Solana decimals
          const decimalsDiff =
            tokenMapping.decimals.solana - tokenMapping.decimals.evm;
          if (decimalsDiff > 0) {
            convertedAmount = request.amount * BigInt(10 ** decimalsDiff);
          } else {
            convertedAmount =
              request.amount / BigInt(10 ** Math.abs(decimalsDiff));
          }
          console.log(
            `Amount converted: ${request.amount} (EVM) -> ${convertedAmount} (Solana)`
          );
        }

        transferResult = await this.solanaTransfer.transferSPLToken(
          tokenMapping.solanaAddress,
          solanaDestination,
          convertedAmount
        );
      }

      if (!transferResult.success) {
        throw new Error(`Solana transfer failed: ${transferResult.error}`);
      }

      console.log(`✓ Solana transfer successful: ${transferResult.signature}`);

      // Step 5: Submit verification to relayer API
      console.log(`\n[4/4] Submitting verification to relayer API...`);
      const verificationResult = await this.relayerApi.submitVerification({
        requestId: requestIdStr,
        ethClaimTxHash: claimTxHash,
        solanaTransferSignature: transferResult.signature,
        solanaDestination: solanaDestination,
        amount: request.amount.toString(),
        token: request.token,
      });

      if (verificationResult.success) {
        console.log(
          `\n✓✓✓ Bridge request ${requestIdStr} processed successfully! ✓✓✓`
        );
        console.log(`Ethereum claim: ${claimTxHash}`);
        console.log(`Solana transfer: ${transferResult.signature}`);
      } else {
        console.warn(
          `\n⚠ Verification submission failed: ${verificationResult.message}`
        );
        console.warn(
          "The transfer was completed, but the relayer was not notified"
        );
      }
    } catch (error) {
      console.error(
        `\n✗ Error processing bridge request ${requestIdStr}:`,
        error
      );

      if (error instanceof Error) {
        console.error(`Error message: ${error.message}`);
      }

      console.log("\nThe node will continue monitoring for new requests...");
    } finally {
      this.processing.delete(requestIdStr);
    }
  }

  /**
   * Stop the bridge node
   */
  stop(): void {
    this.ethereumMonitor.stopMonitoring();
    console.log("Bridge node stopped");
  }
}

// Main entry point
async function main() {
  try {
    console.log("Starting bridge node...");
    const node = new BridgeNode();
    console.log("BridgeNode instance created");
    await node.start();
  } catch (error) {
    console.error("Fatal error starting bridge node:", error);
    process.exit(1);
  }
}

// Run the node
console.log("Node module loaded, calling main()...");
main();
