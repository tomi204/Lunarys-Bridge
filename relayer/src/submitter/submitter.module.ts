// src/submitter/submitter.module.ts
import { Module } from '@nestjs/common';
import { SUBMITTER } from './types';
import { EvmSubmitter } from './evm.submitter';
import { SolanaSubmitter } from './solana.submitter';
import { CompositeSubmitter } from './composite.submitter';
import { NoopSubmitter } from './noop.submitter';

function canUseAny(): boolean {
  // EVM side (only needed if you also want SOL->EVM)
  const hasEvm = /^0x[a-fA-F0-9]{40}$/.test((process.env.EXECUTOR_ADDR || '').trim())
              && /^0x[0-9a-fA-F]{64}$/.test((process.env.EVM_RELAYER_PK || process.env.LOCAL_SIGNER_PK || '').trim());
  // Solana side (EVM->SOL release_spl)
  const hasSol = !!process.env.SOLANA_RPC_HTTP
              && !!process.env.SOLANA_PROGRAM_ID
              && !!process.env.SOLANA_PAYER_SECRET
              && !!process.env.ARCIUM_PROGRAM_ID
              && !!process.env.SOLANA_COMP_DEF_ACCOUNT
              && !!process.env.TOKEN_MAP_JSON;
  return hasEvm || hasSol;
}

@Module({
  providers: [
    EvmSubmitter,
    SolanaSubmitter,
    CompositeSubmitter,
    NoopSubmitter,
    {
      provide: SUBMITTER,
      useFactory: (comp: CompositeSubmitter, noop: NoopSubmitter) =>
        canUseAny() ? comp : noop,
      inject: [CompositeSubmitter, NoopSubmitter],
    },
  ],
  exports: [SUBMITTER],
})
export class SubmitterModule {}
