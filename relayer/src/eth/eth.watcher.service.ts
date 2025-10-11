// src/eth/eth-watcher.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  webSocket,
  parseAbiItem,
  Hex,
  isAddress,
} from 'viem';
import { pinoLogger as logger } from 'src/common/logger';

// Exact event signature from your contract:
// event BridgeInitiated(uint256 indexed requestId, address indexed sender, address token, uint256 amount);
const BridgeInitiatedEvt = parseAbiItem(
  'event BridgeInitiated(uint256 indexed requestId, address indexed sender, address token, uint256 amount)'
);

@Injectable()
export class EthWatcherService implements OnModuleInit, OnModuleDestroy {
  private unwatch?: () => void;

  constructor(private readonly cfg: ConfigService) {}

  async onModuleInit() {
    await this.start();
  }

  onModuleDestroy() {
    try { this.unwatch?.(); } catch {}
  }

  private async start() {
    // Required env vars:
    // ETH_RPC_WSS: Sepolia WSS endpoint
    // ETH_CHAIN_ID: 11155111
    // RELAYER_ADDR: your deployed Relayer address
    // ETH_TAIL_BLOCKS: optional, how far back to start to avoid missing logs on restart
    const ETH_RPC_WSS = this.cfg.get<string>('ETH_RPC_WSS', { infer: true })!;
    const ETH_CHAIN_ID = Number(this.cfg.get<string>('ETH_CHAIN_ID', { infer: true }) ?? '11155111');
    const RAW_ADDRESS = (this.cfg.get<string>('ETH_LOCKER_ADDR', { infer: true }) ?? '').trim();
    const TAIL = Number(this.cfg.get<string>('ETH_TAIL_BLOCKS', { infer: true }) ?? '0');

    // Create a public client over WebSocket
    const client = createPublicClient({
      transport: webSocket(ETH_RPC_WSS),
      chain: {
        id: ETH_CHAIN_ID,
        name: 'sepolia',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [], webSocket: [] } },
      },
    });

    // Optional address filter; if missing/invalid, we subscribe by topic only
    const address = isAddress(RAW_ADDRESS as Hex) ? (RAW_ADDRESS as Hex) : undefined;
    if (!address) {
      logger.warn('RELAYER_ADDR missing/invalid; listening by topic only (no address filter).');
    }

    // Start slightly behind the head to avoid missing logs across restarts
    let fromBlock: bigint | undefined;
    try {
      const latest = await client.getBlockNumber();
      fromBlock = latest > BigInt(TAIL) ? latest - BigInt(TAIL) : 0n;
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'Could not fetch latest block; defaulting to "latest".');
    }

    // Subscribe to BridgeInitiated
    this.unwatch = await client.watchEvent({
      address,
      event: BridgeInitiatedEvt,
      ...(fromBlock ? { fromBlock } : {}),
      onLogs: (logs) => {
        for (const { args, transactionHash, blockNumber } of logs) {
          // Strongly-typed args according to the event
          const { requestId, sender, token, amount } = args as {
            requestId: bigint;
            sender: `0x${string}`;
            token: `0x${string}`;
            amount: bigint;
          };

          logger.info(
            {
              chainId: ETH_CHAIN_ID,
              blockNumber,
              txHash: transactionHash,
              requestId: requestId.toString(),
              sender,
              token,
              amount: amount.toString(),
            },
            'BridgeInitiated'
          );

          // 👉 Kick off your off-chain flow here:
          // 1) Read the encrypted destination handle from the contract (if you expose a getter)
          // 2) Request decryption (fhEVM) using ACL permissions
          // 3) Execute the Solana leg
          // 4) Call finalizeBridge(requestId) back on EVM
          //
          // await this.processor.handleEvmBridgeInitiated({ requestId, sender, token, amount, txHash: transactionHash });
        }
      },
      onError: (e) =>
        logger.error({ err: (e as any)?.message ?? e }, 'ETH WS error (BridgeInitiated)'),
    });

    logger.info(
      { chainId: ETH_CHAIN_ID, address: address ?? '(topic only)', fromBlock: String(fromBlock ?? 'latest') },
      'ETH watcher started (BridgeInitiated only)'
    );
  }
}
