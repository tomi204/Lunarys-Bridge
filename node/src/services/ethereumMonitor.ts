import { ethers } from "ethers";
import { BridgeRequest, NodeConfig } from "../types/index.js";

export class EthereumMonitor {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private newRelayer: ethers.Contract;
  private config: NodeConfig;
  private lastProcessedBlock: number = 0;
  private pendingClaims: Map<string, { txHash: string; timestamp: number }> = new Map();

  // NewRelayer contract ABI for event listening
  private readonly newRelayerAbi = [
    "event BridgeInitiated(uint256 indexed requestId, address indexed sender, address token, uint256 amountAfterFee)",
    "event BridgeClaimed(uint256 indexed requestId, address indexed solver, uint256 bond, uint64 deadline)",
    "function bridgeRequests(uint256) view returns (address sender, address token, uint256 amount, uint256 encryptedSolanaDestination, uint256 timestamp, bool finalized, uint256 fee)",
    "function requestClaim(uint256) view returns (address solver, uint64 claimedAt, uint64 deadline, uint256 bond)",
    "function claimBridge(uint256 requestId) payable",
    "function authorizedNodes(address) view returns (bool)",
  ];

  constructor(config: NodeConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.ethereumRpcUrl);
    this.wallet = new ethers.Wallet(config.ethereumPrivateKey, this.provider);
    this.newRelayer = new ethers.Contract(
      config.newRelayerAddress,
      this.newRelayerAbi,
      this.wallet
    );
  }

  /**
   * Initialize the monitor by getting the current block
   */
  async initialize(): Promise<void> {
    this.lastProcessedBlock = await this.provider.getBlockNumber();
    console.log(
      `Ethereum monitor initialized at block: ${this.lastProcessedBlock}`
    );

    // Check if this node is authorized
    const isAuthorized = await this.newRelayer.authorizedNodes(
      this.wallet.address
    );
    if (!isAuthorized) {
      console.warn(
        `WARNING: Node address ${this.wallet.address} is not authorized!`
      );
      console.warn("Contact the contract owner to authorize this node.");
    } else {
      console.log(
        `Node ${this.wallet.address} is authorized to claim bridge requests`
      );
    }
  }

  /**
   * Start monitoring for new BridgeInitiated events
   * @param onBridgeInitiated Callback function when a new bridge request is detected
   */
  async startMonitoring(
    onBridgeInitiated: (request: BridgeRequest) => Promise<void>
  ): Promise<void> {
    console.log("Starting Ethereum event monitoring...");

    // Listen for new BridgeInitiated events
    this.newRelayer.on(
      "BridgeInitiated",
      async (
        requestId: bigint,
        sender: string,
        token: string,
        amount: bigint,
        encryptedDestination: string,
        event: ethers.Log
      ) => {
        console.log("\n=================================");
        console.log("New Bridge Request Detected!");
        console.log("=================================");
        console.log(`Request ID: ${requestId}`);
        console.log(`Sender: ${sender}`);
        console.log(`Token: ${token}`);
        console.log(`Amount: ${ethers.formatEther(amount)} tokens`);
        if (event?.blockNumber) {
          console.log(`Block: ${event.blockNumber}`);
        }
        if (event?.transactionHash) {
          console.log(`Tx Hash: ${event.transactionHash}`);
        }
        console.log("=================================\n");

        // Get full bridge request details
        const bridgeRequest: BridgeRequest = {
          requestId,
          sender,
          token,
          amount,
          timestamp: BigInt(Date.now()),
          encryptedSolanaDestination: encryptedDestination,
        };

        // Call the callback to process this request
        try {
          await onBridgeInitiated(bridgeRequest);
        } catch (error) {
          console.error(`Error processing bridge request ${requestId}:`, error);
        }
      }
    );

    console.log(
      `Monitoring NewRelayer contract at: ${this.config.newRelayerAddress}`
    );
    console.log(`Node address: ${this.wallet.address}\n`);
  }

  /**
   * Poll for historical events (optional, for catching up on missed events)
   */
  async pollForEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<BridgeRequest[]> {
    console.log(`Polling for events from block ${fromBlock} to ${toBlock}...`);

    const filter = this.newRelayer.filters.BridgeInitiated();
    const events = await this.newRelayer.queryFilter(
      filter,
      fromBlock,
      toBlock
    );

    const requests: BridgeRequest[] = [];

    for (const event of events) {
      // Type assertion for ethers v6 EventLog
      if ("args" in event && event.args) {
        const request: BridgeRequest = {
          requestId: event.args.requestId,
          sender: event.args.sender,
          token: event.args.token,
          amount: event.args.amount,
          timestamp: BigInt(Date.now()),
          encryptedSolanaDestination:
            event.args.encryptedSolanaDestination || "0x",
        };
        requests.push(request);
      }
    }

    console.log(`Found ${requests.length} bridge requests`);
    return requests;
  }

  /**
   * Check if a request has already been claimed
   */
  async isRequestClaimed(requestId: bigint): Promise<boolean> {
    const claim = await this.newRelayer.requestClaim(requestId);
    // Check if there's an active claim (solver != address(0) and not expired)
    if (claim.solver !== ethers.ZeroAddress) {
      const now = Math.floor(Date.now() / 1000);
      return now < Number(claim.deadline); // Still active if before deadline
    }
    return false;
  }

  /**
   * Claim a bridge request by sending the required bond
   */
  async claimBridgeRequest(requestId: bigint): Promise<string> {
    console.log(`Attempting to claim bridge request ${requestId}...`);

    const requestIdStr = requestId.toString();

    // Check if we already have a pending claim for this request
    const pendingClaim = this.pendingClaims.get(requestIdStr);
    if (pendingClaim) {
      console.log(`Found existing claim transaction: ${pendingClaim.txHash}`);
      console.log("Checking transaction status...");

      try {
        // Try to get the transaction receipt
        const receipt = await this.provider.getTransactionReceipt(pendingClaim.txHash);

        if (receipt) {
          // Transaction was mined
          this.pendingClaims.delete(requestIdStr);

          if (receipt.status === 1) {
            console.log(`✓ Bridge request ${requestId} was already claimed successfully!`);
            console.log(`Transaction: ${pendingClaim.txHash}`);
            return pendingClaim.txHash;
          } else {
            console.log("Previous transaction failed, will retry...");
            // Continue to send new transaction
          }
        } else {
          // Transaction still pending
          const now = Date.now();
          const elapsed = (now - pendingClaim.timestamp) / 1000; // seconds

          // If transaction is older than 2 minutes, assume it's stuck and retry
          if (elapsed < 120) {
            console.log(`Transaction still pending (${elapsed.toFixed(0)}s ago), waiting...`);
            console.log("Monitoring transaction status...");

            // Wait for the transaction to be mined
            const receipt = await this.provider.waitForTransaction(pendingClaim.txHash, 1, 120000); // 2 min timeout

            if (receipt) {
              this.pendingClaims.delete(requestIdStr);

              if (receipt.status === 1) {
                console.log(`✓ Bridge request ${requestId} claimed successfully!`);
                console.log(`Transaction: ${pendingClaim.txHash}`);
                return pendingClaim.txHash;
              } else {
                throw new Error(`Claim transaction failed for request ${requestId}`);
              }
            } else {
              console.log("Transaction timeout, will retry with higher gas...");
              // Continue to send replacement transaction
            }
          } else {
            console.log(`Transaction has been pending for ${elapsed.toFixed(0)}s, will send replacement...`);
            // Continue to send replacement transaction
          }
        }
      } catch (error) {
        console.error("Error checking pending transaction:", error);
        // Continue to send new transaction
      }
    }

    // Check if already claimed by another node
    const isClaimed = await this.isRequestClaimed(requestId);
    if (isClaimed) {
      throw new Error(`Request ${requestId} has already been claimed`);
    }

    // Parse bond amount
    const bondAmount = ethers.parseEther(this.config.bondAmount);

    console.log(`Sending bond of ${this.config.bondAmount} ETH...`);

    try {
      // Send claim transaction
      const tx = await this.newRelayer.claimBridge(requestId, {
        value: bondAmount,
      });

      console.log(`Claim transaction sent: ${tx.hash}`);
      console.log("Waiting for confirmation...");

      // Store in pending claims
      this.pendingClaims.set(requestIdStr, {
        txHash: tx.hash,
        timestamp: Date.now(),
      });

      const receipt = await tx.wait();

      // Remove from pending claims once confirmed
      this.pendingClaims.delete(requestIdStr);

      if (receipt?.status === 1) {
        console.log(`✓ Bridge request ${requestId} claimed successfully!`);
        console.log(`Transaction: ${tx.hash}`);
        return tx.hash;
      } else {
        throw new Error(`Claim transaction failed for request ${requestId}`);
      }
    } catch (error: any) {
      // Handle "already known" error - transaction was already sent
      if (error?.code === 'UNKNOWN_ERROR' && error?.error?.message === 'already known') {
        console.log("Transaction already in mempool, monitoring for confirmation...");

        // Get the transaction hash from the raw transaction
        if (error?.payload?.params?.[0]) {
          const rawTx = error.payload.params[0];
          const txHash = ethers.keccak256(rawTx);

          console.log(`Monitoring existing transaction: ${txHash}`);

          // Store in pending claims
          this.pendingClaims.set(requestIdStr, {
            txHash: txHash,
            timestamp: Date.now(),
          });

          try {
            // Wait for the existing transaction
            const receipt = await this.provider.waitForTransaction(txHash, 1, 120000);

            this.pendingClaims.delete(requestIdStr);

            if (receipt?.status === 1) {
              console.log(`✓ Bridge request ${requestId} claimed successfully!`);
              console.log(`Transaction: ${txHash}`);
              return txHash;
            } else {
              throw new Error(`Claim transaction failed for request ${requestId}`);
            }
          } catch (waitError) {
            console.error("Error waiting for transaction:", waitError);
            throw error; // Re-throw original error
          }
        }
      }

      // Handle "nonce too low" error - transaction was already mined
      if (error?.code === 'NONCE_EXPIRED' || error?.message?.includes('nonce too low')) {
        console.log("Transaction may have already been mined, checking claim status...");

        const isClaimed = await this.isRequestClaimed(requestId);
        if (isClaimed) {
          // Check if we claimed it
          const claim = await this.newRelayer.requestClaim(requestId);
          if (claim.solver.toLowerCase() === this.wallet.address.toLowerCase()) {
            console.log("✓ Bridge request was already claimed by this node");
            // Try to find the transaction hash from recent blocks
            const currentBlock = await this.provider.getBlockNumber();
            const events = await this.newRelayer.queryFilter(
              this.newRelayer.filters.BridgeClaimed(requestId),
              currentBlock - 100,
              currentBlock
            );

            if (events.length > 0 && 'transactionHash' in events[0]) {
              return events[0].transactionHash;
            }

            throw new Error("Bridge already claimed by this node, but transaction hash not found");
          }
        }
      }

      throw error;
    }
  }

  /**
   * Get wallet address for this node
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.newRelayer.removeAllListeners("BridgeInitiated");
    console.log("Stopped monitoring Ethereum events");
  }
}
