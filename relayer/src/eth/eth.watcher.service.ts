import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  webSocket,
  parseAbiItem,
  Hex,
  padHex,
  isAddress,
} from 'viem';
import { EnvVars } from 'src/config/config.schema';
import { RelayerProcessor } from 'src/relayer/relayer.processor';
import { pinoLogger as logger } from 'src/common/logger';
import { BridgeMessageSchema } from 'src/config/config.schema';
import { computeMsgId } from 'src/message/canonical';

const DepositEvent = parseAbiItem(
  'event Deposit(address indexed token, address indexed from, bytes32 solanaRecipient, uint256 amount, uint256 nonce, uint256 dstChainId)',
);

@Injectable()
export class EthWatcherService implements OnModuleInit, OnModuleDestroy {
  private unwatch?: () => void;

  constructor(
    private readonly cfg: ConfigService<EnvVars, true>,
    private readonly processor: RelayerProcessor,
  ) {}

  onModuleInit() { this.start(); }
  onModuleDestroy() { this.unwatch?.(); }

  private async start() {
    const ETH_RPC_WSS = this.cfg.get('ETH_RPC_WSS', { infer: true });
    const ETH_CHAIN_ID = this.cfg.get('ETH_CHAIN_ID', { infer: true });
    const RAW_LOCKER = (this.cfg.get('ETH_LOCKER_ADDR', { infer: true }) ?? '').trim();

    const client = createPublicClient({
      transport: webSocket(ETH_RPC_WSS),
      chain: {
        id: ETH_CHAIN_ID,
        name: 'sepolia',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [], webSocket: [] } },
      },
    });

    const address = isAddress(RAW_LOCKER as Hex) ? (RAW_LOCKER as Hex) : undefined;
    if (!address) {
      logger.warn('ETH_LOCKER_ADDR ausente o inválido; suscribiendo por topic del evento (sin address).');
    }

    this.unwatch = await client.watchEvent({
      address,
      event: DepositEvent,
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            const { token, solanaRecipient, amount, nonce, dstChainId } = log.args as any;
            const srcTxId = log.transactionHash as Hex;

            const mInput = {
              version: 1,
              dir: 2, // EVM -> SOL
              srcChainId: String(ETH_CHAIN_ID),
              dstChainId: String(dstChainId),
              srcTxId,
              originToken: padHex(token as Hex, { size: 32 }), // address -> bytes32
              amount: (amount as bigint).toString(),
              recipient: solanaRecipient as Hex,               // bytes32 en el evento
              nonce: (nonce as bigint).toString(),
              expiry: String(Math.floor(Date.now() / 1000) + 3600),
            };

            const m = BridgeMessageSchema.parse(mInput);
            const msgId = computeMsgId(m) as Hex;

            await this.processor.handleDecryptedMessage({
              kv: 1,
              msgId,
              m,
            });
          } catch (e) {
            logger.warn(
              { err: (e as Error).message, tx: log?.transactionHash },
              'Failed to process EVM log',
            );
          }
        }
      },
      onError: (e) => logger.error({ err: (e as any)?.message ?? e }, 'ETH WS error'),
    });

    logger.info('ETH watcher started');
  }
}
