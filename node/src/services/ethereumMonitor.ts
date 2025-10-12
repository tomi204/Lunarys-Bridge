import { ethers } from "ethers";
import { BridgeRequest, NodeConfig } from "../types";

export class EthereumMonitor {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private newRelayer: ethers.Contract;
  private config: NodeConfig;
  private lastProcessedBlock: number = 0;

  // NewRelayer contract ABI for event listening
  private readonly newRelayerAbi = [
    "event BridgeInitiated(uint256 indexed requestId, address indexed sender, address token, uint256 amountAfterFee)",
    "event BridgeClaimed(uint256 indexed requestId, address indexed solver, uint256 bond, uint64 deadline)",
    "function bridgeRequests(uint256) view returns (address sender, address token, uint256 amount, tuple(uint256, bytes) encryptedSolanaDestination, uint256 timestamp, bool finalized, uint256 fee)",
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

    // Check if already claimed
    const isClaimed = await this.isRequestClaimed(requestId);
    if (isClaimed) {
      throw new Error(`Request ${requestId} has already been claimed`);
    }

    // Parse bond amount
    const bondAmount = ethers.parseEther(this.config.bondAmount);

    console.log(`Sending bond of ${this.config.bondAmount} ETH...`);

    // Send claim transaction
    const tx = await this.newRelayer.claimBridge(requestId, {
      value: bondAmount,
    });

    console.log(`Claim transaction sent: ${tx.hash}`);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();

    if (receipt?.status === 1) {
      console.log(`✓ Bridge request ${requestId} claimed successfully!`);
      console.log(`Transaction: ${tx.hash}`);
      return tx.hash;
    } else {
      throw new Error(`Claim transaction failed for request ${requestId}`);
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
