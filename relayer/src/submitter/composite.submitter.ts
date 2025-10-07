import { Injectable } from '@nestjs/common';
import type { Hex } from 'viem';
import type { BridgeMessage } from 'src/message/canonical';
import type { Attestation } from 'src/signer/types';
import { Submitter } from './types';
import { EvmSubmitter } from './evm.submitter';
import { SolanaSubmitter } from './solana.submitter';

@Injectable()
export class CompositeSubmitter implements Submitter {
  constructor(
    private readonly evm: EvmSubmitter,
    private readonly sol: SolanaSubmitter,
  ) {}

  submit(input: { msgId: Hex; m: BridgeMessage; sig: Attestation }): Promise<string | null> {
    const dir = Number(input.m.dir);
    if (dir === 1) return this.evm.submit(input);   // SOL -> EVM
    if (dir === 2) return this.sol.submit(input);   // EVM -> SOL
    return Promise.resolve(null);
  }
}
