import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolToEvmRecord } from '../entities/sol-to-evm.entity';
import { BridgeStatus } from '../entities/bridge-status.enum';

@Injectable()
export class SolToEvmRepository {
  constructor(
    @InjectRepository(SolToEvmRecord)
    private readonly repo: Repository<SolToEvmRecord>,
  ) {}

  async upsertReceived(data: {
    requestId: string;
    solanaDepositSignature: string;
    solanaVault: string;
    solanaMint?: string;
    amountSol: string;
    evmRecipient: string;
    evmToken: string;
  }) {
    const existing = await this.repo.findOne({ where: { requestId: data.requestId } });
    if (existing) {
      Object.assign(existing, { ...data, status: BridgeStatus.RECEIVED });
      return this.repo.save(existing);
    }
    const created = this.repo.create({ ...data, status: BridgeStatus.RECEIVED });
    return this.repo.save(created);
  }

  async markVerified(requestId: string, patch?: Partial<SolToEvmRecord>) {
    const rec = await this.repo.findOne({ where: { requestId } });
    if (!rec) throw new Error('SolToEvmRecord not found');
    rec.status = BridgeStatus.VERIFIED;
    if (patch) Object.assign(rec, patch);
    return this.repo.save(rec);
  }

  async markSettled(requestId: string, settlementTxHash?: string, patch?: Partial<SolToEvmRecord>) {
    const rec = await this.repo.findOne({ where: { requestId } });
    if (!rec) throw new Error('SolToEvmRecord not found');
    rec.status = BridgeStatus.SETTLED;
    if (settlementTxHash) rec.settlementTxHash = settlementTxHash;
    if (patch) Object.assign(rec, patch);
    return this.repo.save(rec);
  }

  async markFailed(requestId: string, err: unknown) {
    const rec = await this.repo.findOne({ where: { requestId } });
    if (!rec) return;
    rec.status = BridgeStatus.FAILED;
    rec.lastError = err instanceof Error ? err.message : String(err);
    return this.repo.save(rec);
  }

  getByRequest(requestId: string) {
    return this.repo.findOne({ where: { requestId } });
  }
}
