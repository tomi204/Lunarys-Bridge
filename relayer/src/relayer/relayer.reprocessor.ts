import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { pinoLogger as logger } from 'src/common/logger';
import { MESSAGE_STORE, type MessageStore, MsgStatus } from './store';
import { ATTESTATION_PROVIDER, type AttestationProvider } from 'src/signer/types';
import { SUBMITTER, type Submitter } from 'src/submitter/types';
import { computeMsgId } from 'src/message/canonical';
import type { Hex } from 'viem';

@Injectable()
export class ReprocessorService implements OnModuleInit {
  constructor(
    @Inject(MESSAGE_STORE) private readonly store: MessageStore,
    @Inject(ATTESTATION_PROVIDER) private readonly signer: AttestationProvider,
    @Inject(SUBMITTER) private readonly submitter: Submitter,
  ) {}

  async onModuleInit() {
    const pending = await this.store.findByStatuses([MsgStatus.Observed, MsgStatus.Attested]);
    if (!pending.length) return;

    logger.info({ count: pending.length }, 'Reprocessing pending messages on boot');

    for (const rec of pending) {
      try {
        const msgId = computeMsgId(rec.m) as Hex;

        if (rec.status === MsgStatus.Observed) {
          const sig = await this.signer.signDigest(msgId);
          rec.sig = sig;
          rec.status = MsgStatus.Attested;
          await this.store.upsert(rec);
          logger.info({ msgId }, 'Re-attested message');
        }

        if (rec.status === MsgStatus.Attested && rec.sig) {
          const tx = await this.submitter.submit({ msgId, m: rec.m, sig: rec.sig });
          if (tx) {
            rec.status = MsgStatus.Submitted;
            await this.store.upsert(rec);
            logger.info({ msgId, tx }, 'Re-submitted message');
          }
        }
      } catch (e: any) {
        logger.warn({ msgId: rec.id, err: e?.message }, 'Failed reprocessing message');
      }
    }
  }
}
