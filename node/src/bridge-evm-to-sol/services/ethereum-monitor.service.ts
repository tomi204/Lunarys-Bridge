import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ethers } from 'ethers';
import { BridgeRequest } from 'src/bridge-evm-to-sol/types';
import { NodeConfig } from 'src/types/node-config';

@Injectable()
export class EthereumMonitorService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(EthereumMonitorService.name);
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private newRelayer: ethers.Contract;

  private readonly abi = [
    'event BridgeInitiated(uint256 indexed requestId, address indexed sender, address token, uint256 amountAfterFee)',
    'event BridgeClaimed(uint256 indexed requestId, address indexed solver, uint256 bond, uint64 deadline)',
    'function bridgeRequests(uint256) view returns (address sender, address token, uint256 amount, uint256 encryptedSolanaDestination, uint256 timestamp, bool finalized, uint256 fee)',
    'function requestClaim(uint256) view returns (address solver, uint64 claimedAt, uint64 deadline, uint256 bond)',
    'function claimBridge(uint256 requestId) payable',
    'function authorizedNodes(address) view returns (bool)',
  ];

  constructor(
    private readonly config: ConfigService<NodeConfig, true>,
    private readonly events: EventEmitter2,
  ) {
    const rpc = this.config.get('ethereumRpcUrl');
    const pk = this.config.get('ethereumPrivateKey');
    const relayer = this.config.get('newRelayerAddress');

    this.provider = new ethers.JsonRpcProvider(rpc);
    this.wallet = new ethers.Wallet(pk, this.provider);
    this.newRelayer = new ethers.Contract(relayer, this.abi, this.wallet);
  }

  async onModuleInit() {
    await this.initialize();
    await this.start();
  }

  onApplicationShutdown() {
    this.newRelayer.removeAllListeners('BridgeInitiated');
  }

  private async initialize() {
    const block = await this.provider.getBlockNumber();
    this.logger.log(`Initialized at block ${block}`);
    const isAuth = await this.newRelayer.authorizedNodes(this.wallet.address);
    if (!isAuth) this.logger.warn(`Node ${this.wallet.address} is NOT authorized to claim`);
    else this.logger.log(`Node ${this.wallet.address} is authorized`);
  }

  private async start() {
    const relayerAddr = this.config.get('newRelayerAddress');
    this.logger.log(`Monitoring NewRelayer: ${relayerAddr} | Node: ${this.wallet.address}`);

    this.newRelayer.on(
      'BridgeInitiated',
      async (
        requestId: bigint,
        sender: string,
        token: string,
        amountAfterFee: bigint,
        event: ethers.Log
      ) => {
        this.logger.log(`BridgeInitiated #${requestId} token=${token} amount=${amountAfterFee}`);
        let encrypted = '0x';
        try {
          const br = await this.newRelayer.bridgeRequests(requestId);
          const h = BigInt(br.encryptedSolanaDestination ?? 0n);
          encrypted = '0x' + h.toString(16).padStart(64, '0');
        } catch (e) {
          this.logger.warn(`No pude leer bridgeRequests(${requestId}): ${e}`);
        }

        const req: BridgeRequest = {
          requestId,
          sender,
          token,
          amount: amountAfterFee,
          timestamp: BigInt(Date.now()),
          encryptedSolanaDestination: encrypted,
        };

        this.events.emit('bridge.initiated', req);
      },
    );
  }

  async isRequestClaimed(requestId: bigint): Promise<boolean> {
    const claim = await this.newRelayer.requestClaim(requestId);
    if (claim.solver !== ethers.ZeroAddress) {
      const now = Math.floor(Date.now() / 1000);
      return now < Number(claim.deadline);
    }
    return false;
  }

  async claimBridgeRequest(requestId: bigint): Promise<string> {
    const bond = this.config.get('bondAmount');
    const value = ethers.parseEther(bond);
    const tx = await this.newRelayer.claimBridge(requestId, { value });
    this.logger.log(`Claim tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`Claim failed #${requestId}`);
    this.logger.log(`Claim confirmed: ${tx.hash}`);
    return tx.hash;
  }
}