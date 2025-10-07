import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';
import { ConfigService } from '@nestjs/config';
import type { EnvVars } from 'src/config/config.schema';
import { CryptoService } from 'src/crypto/crypto.service';
import { RelayerProcessor } from 'src/relayer/relayer.processor';
import { pinoLogger as logger } from 'src/common/logger';
import type { Hex } from 'viem';

type JsonRpcSub = {
  jsonrpc: '2.0';
  id: number;
  method: 'logsSubscribe';
  params: [{ mentions: string[] }, { commitment: string }];
};

type LogsNotification = {
  method: 'logsNotification';
  params: {
    result: {
      value: {
        logs: string[];
      };
    };
  };
};

@Injectable()
export class TritonService implements OnModuleInit, OnModuleDestroy {
  private ws?: WebSocket;
  private id = 1;
  private subId?: number;
  private pingIv?: NodeJS.Timeout;

  constructor(
    private readonly cfg: ConfigService<EnvVars, true>,
    private readonly crypto: CryptoService,
    private readonly processor: RelayerProcessor,
  ) {}

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    if (this.pingIv) clearInterval(this.pingIv);
    this.ws?.close();
  }

  private connect() {
    const url = this.cfg.get('TRITON_WS_URL', { infer: true });
    const programId = this.cfg.get('SOLANA_PROGRAM_ID', { infer: true });
    const commitment = this.cfg.get('CONFIRM_SOL_COMMITMENT', { infer: true });

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      logger.info({ url }, 'Whirligig connected');

      // keep-alive cada 60s (algunos providers WS cortan por idle)
      this.pingIv = setInterval(() => {
        try {
          this.ws?.ping?.();
        } catch {}
      }, 60_000);

      const sub: JsonRpcSub = {
        jsonrpc: '2.0',
        id: this.id++,
        method: 'logsSubscribe',
        params: [{ mentions: [programId] }, { commitment }],
      };
      this.ws!.send(JSON.stringify(sub));
    });

    this.ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        // ACK de suscripción
        if (msg.id && (typeof msg.result === 'number' || typeof msg.result === 'string')) {
          this.subId = Number(msg.result);
          logger.info({ subId: this.subId }, 'logsSubscribe OK');
          return;
        }

        // Notificaciones de logs
        if ((msg as LogsNotification)?.method === 'logsNotification') {
          const logs: string[] = (msg as LogsNotification).params?.result?.value?.logs || [];
          for (const line of logs) {
            // Soportamos EV1 y EVENT (fallback)
            const env = this.crypto.parseAndDecryptFromLogLine(line);
            if (!env) continue;

            // Si EV1 traía msgId, validar que coincida con el recomputado
            if (env.msgIdHex && env.msgIdHex !== env.recomputedMsgId) {
              logger.warn(
                { msgIdProvided: env.msgIdHex, recomputed: env.recomputedMsgId },
                'msgId mismatch, ignoring',
              );
              continue;
            }

            await this.processor.handleDecryptedMessage({
              kv: env.kv,
              msgId: env.recomputedMsgId as Hex, // el processor espera Hex
              m: env.message,
            });
          }
        }
      } catch (e) {
        logger.error({ err: (e as Error).message }, 'WS parse error');
      }
    });

    this.ws.on('close', () => {
      if (this.pingIv) clearInterval(this.pingIv);
      logger.warn('Whirligig closed; reconnecting in 2s...');
      setTimeout(() => this.connect(), 2000);
    });

    this.ws.on('error', (e) => {
      logger.error({ e }, 'Whirligig error');
    });
  }
}
