import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Connection, PublicKey } from '@solana/web3.js';
import { NodeConfig } from '@/types/node-config';

export interface SolBridgeInitiated {
  requestId: bigint;
  payer: string;
  mint: string;
  amountAfterFee: bigint;
  // si querés, podés incluir amount_commitment / recipient_hash que ya emitis
}

@Injectable()
export class SolanaMonitorService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(SolanaMonitorService.name);
  private readonly conn: Connection;
  private readonly programId: PublicKey;
  private subId: number | null = null;

  constructor(
    private readonly config: ConfigService<NodeConfig, true>,
    private readonly events: EventEmitter2,
  ) {
    this.conn = new Connection(this.config.get('solanaRpcUrl'), 'confirmed');
    this.programId = new PublicKey(this.config.get('solanaProgramId'));
  }

  async onModuleInit() {
    await this.start();
  }

  onApplicationShutdown() {
    if (this.subId != null) this.conn.removeOnLogsListener(this.subId).catch(() => {});
  }

  private async start() {
    this.logger.log(`Monitoring Solana program: ${this.programId.toBase58()}`);
    this.subId = this.conn.onLogs(this.programId, ({ logs, err }) => {
      if (err) return;
      const ev = this.tryParseBridgeInitiated(logs);
      if (ev) {
        this.logger.log(`BridgeInitiated (Sol): req=${ev.requestId} mint=${ev.mint} amt=${ev.amountAfterFee}`);
        this.events.emit('sol.bridge.initiated', ev);
      }
    }, 'confirmed');
  }

  private tryParseBridgeInitiated(logs: string[]): SolBridgeInitiated | null {
    // Estrategia B (fallback): buscar línea "Program log: BridgeInitiated: {...}"
    const line = logs.find(l => l.includes('BridgeInitiated:'));
    if (!line) return null;
    try {
      const jsonStr = line.split('BridgeInitiated:')[1].trim();
      const data = JSON.parse(jsonStr);
      return {
        requestId: BigInt(data.request_id ?? data.requestId),
        payer: String(data.payer),
        mint: String(data.token_mint ?? data.mint),
        amountAfterFee: BigInt(data.amount_after_fee ?? data.amountAfterFee),
      };
    } catch {
      return null;
    }
  }
}
