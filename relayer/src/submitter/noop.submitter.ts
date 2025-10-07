import { Injectable } from '@nestjs/common';
import type { Hex } from 'viem';
import { pinoLogger as logger } from 'src/common/logger';
import { Submitter } from './types';

@Injectable()
export class NoopSubmitter implements Submitter {
  async submit(_: any): Promise<Hex | null> {
    // No contract yet → just log a preview of the payload and do nothing.
    logger.info('Submitter is a NOOP. Skipping on-chain submission.');
    return null;
  }
}