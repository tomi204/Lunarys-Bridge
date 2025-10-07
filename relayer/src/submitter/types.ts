import type { Hex } from 'viem';
import type { BridgeMessage } from 'src/message/canonical';
import type { Attestation } from 'src/signer/types';

export const SUBMITTER = Symbol('SUBMITTER');

export interface Submitter {
  submit(input: { msgId: Hex; m: BridgeMessage; sig: Attestation }): Promise<string | null>;
}
