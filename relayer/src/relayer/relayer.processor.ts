// src/relayer/relayer.processor.ts
import { Inject, Injectable } from '@nestjs/common';
import type { Hex } from 'viem';
import { pinoLogger as logger } from 'src/common/logger';
import { computeMsgId, type BridgeMessage } from 'src/message/canonical';
import { ATTESTATION_PROVIDER, type AttestationProvider } from 'src/signer/types';
import { MESSAGE_STORE, MsgStatus, type MessageStore, type MsgRecord } from './store';
import { SUBMITTER, type Submitter } from 'src/submitter/types';

type DecryptedMsg = { kv: number; msgId: Hex; m: BridgeMessage };

@Injectable()
export class RelayerProcessor {
  constructor(
    @Inject(ATTESTATION_PROVIDER) private readonly signer: AttestationProvider,
    @Inject(MESSAGE_STORE) private readonly store: MessageStore,
    @Inject(SUBMITTER) private readonly submitter: Submitter,
  ) {}

  async handleDecryptedMessage(d: DecryptedMsg) {
    // 1) Recompute & verify msgId
    const again = computeMsgId(d.m);
    if (again.toLowerCase() !== d.msgId.toLowerCase()) {
      logger.warn({ msgId: d.msgId, again }, 'msgId recompute mismatch, dropping');
      return;
    }

    // 2) Expiry
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (d.m.expiry <= now) {
      await this.upsertStatus(d, MsgStatus.Failed, 'expired');
      logger.warn({ msgId: d.msgId, expiry: d.m.expiry.toString() }, 'message expired, dropping');
      return;
    }

    // 3) Idempotencia
    const existing = await this.store.get(d.msgId);
    if (existing && [MsgStatus.Attested, MsgStatus.Submitted, MsgStatus.Confirmed].includes(existing.status)) {
      logger.debug({ msgId: d.msgId, status: existing.status }, 'duplicate message, skipping');
      return;
    }

    // 4) Mark observed
    await this.upsertStatus(d, MsgStatus.Observed);

    // 5) Attestation
    let sig: { v: number; r: Hex; s: Hex };
    try {
      sig = await this.signer.signDigest(d.msgId);
      await this.upsertStatus(d, MsgStatus.Attested, undefined, sig);
      logger.info({ msgId: d.msgId, v: sig.v, r: sig.r, s: sig.s }, 'message attested');
    } catch (e: any) {
      await this.upsertStatus(d, MsgStatus.Failed, e?.message ?? 'attestation error');
      logger.error({ msgId: d.msgId, err: e?.message }, 'attestation failed');
      return;
    }

    // 6) Submit (solo EVM si dir=1; si no, esperar submitter de Solana)
    if (Number(d.m.dir) !== 1) {
      logger.info({ msgId: d.msgId, dir: d.m.dir }, 'non-EVM direction: skipping EVM submit for now');
      return;
    }

    try {
      const tx = await this.submitter.submit({ msgId: d.msgId, m: d.m, sig });
      if (tx) {
        await this.upsertStatus(d, MsgStatus.Submitted, undefined, sig);
        logger.info({ msgId: d.msgId, tx }, 'message submitted');
      } else {
        logger.info({ msgId: d.msgId }, 'submitter returned null (noop or disabled)');
      }
    } catch (e: any) {
      await this.upsertStatus(d, MsgStatus.Failed, e?.message ?? 'submit error', sig);
      logger.error({ msgId: d.msgId, err: e?.message }, 'submit failed');
    }
  }

  private async upsertStatus(
    d: DecryptedMsg,
    status: MsgStatus,
    error?: string,
    sig?: { v: number; r: Hex; s: Hex },
  ) {
    const rec: MsgRecord = {
      id: d.msgId,
      kv: d.kv,
      m: d.m,
      status,
      error,
      sig,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.store.upsert(rec);
  }
}
