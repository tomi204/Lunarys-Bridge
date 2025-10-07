import { Module } from '@nestjs/common';
import { SUBMITTER } from './types';
import { NoopSubmitter } from './noop.submitter';

@Module({
  providers: [{ provide: SUBMITTER, useClass: NoopSubmitter }],
  exports: [SUBMITTER],
})
export class SubmitterModule {}