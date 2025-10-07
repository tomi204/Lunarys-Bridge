import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import type { Hex } from 'viem';
import type { BridgeMessage } from 'src/message/canonical';
import { MessageEntity } from 'src/common/entities/message.entity';
import { MsgStatus, type MessageStore, type MsgRecord } from './store';

@Injectable()
export class TypeormMessageStore implements MessageStore {
  constructor(@InjectRepository(MessageEntity) private readonly repo: Repository<MessageEntity>) {}

  async get(id: Hex): Promise<MsgRecord | undefined> {
    const row = await this.repo.findOne({ where: { msgId: id.toLowerCase() } });
    if (!row) return undefined;
    return this.toRecord(row);
  }

  async upsert(rec: MsgRecord): Promise<void> {
    const row = this.toRow(rec);
    await this.repo.save(row);
  }

  async findByStatuses(statuses: MsgStatus[]): Promise<MsgRecord[]> {
    const rows = await this.repo.find({ where: { status: In(statuses) } });
    return rows.map((r) => this.toRecord(r));
  }

  private toRow(r: MsgRecord): MessageEntity {
    const e = new MessageEntity();
    e.msgId = r.id.toLowerCase();
    e.kv = r.kv;
    e.version = r.m.version;
    e.dir = r.m.dir;
    e.srcChainId = r.m.srcChainId.toString();
    e.dstChainId = r.m.dstChainId.toString();
    e.srcTxId = r.m.srcTxId;
    e.originToken = r.m.originToken;
    e.amount = r.m.amount.toString();
    e.recipient = r.m.recipient;
    e.nonce = r.m.nonce.toString();
    e.expiry = r.m.expiry.toString();
    e.status = r.status;
    e.sigV = r.sig?.v ?? null;
    e.sigR = r.sig?.r ?? null;
    e.sigS = r.sig?.s ?? null;
    e.error = r.error ?? null;
    return e;
  }

  private toRecord(e: MessageEntity): MsgRecord {
    const m: BridgeMessage = {
      version: e.version,
      dir: e.dir,
      srcChainId: BigInt(e.srcChainId),
      dstChainId: BigInt(e.dstChainId),
      srcTxId: e.srcTxId as Hex,
      originToken: e.originToken as Hex,
      amount: BigInt(e.amount),
      recipient: e.recipient as Hex,
      nonce: BigInt(e.nonce),
      expiry: BigInt(e.expiry),
    };
    return {
      id: e.msgId as Hex,
      kv: e.kv,
      m,
      status: e.status as MsgRecord['status'],
      sig: e.sigR && e.sigS && typeof e.sigV === 'number'
        ? { v: e.sigV, r: e.sigR as Hex, s: e.sigS as Hex }
        : undefined,
      error: e.error ?? undefined,
      createdAt: e.createdAt?.getTime?.() ?? Date.now(),
      updatedAt: e.updatedAt?.getTime?.() ?? Date.now(),
    };
  }
}
