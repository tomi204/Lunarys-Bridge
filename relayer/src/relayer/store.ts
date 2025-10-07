import type { Hex } from 'viem';
import type { BridgeMessage } from 'src/message/canonical';
import type { Attestation } from 'src/signer/types';

export const MESSAGE_STORE = Symbol('MESSAGE_STORE');

export enum MsgStatus {
  Observed = 'observed',
  Attested = 'attested',
  Submitted = 'submitted',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

export type MsgRecord = {
  id: Hex;
  m: BridgeMessage;
  kv: number;
  status: MsgStatus;
  sig?: Attestation;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

export interface MessageStore {
  get(id: Hex): Promise<MsgRecord | undefined>;
  upsert(rec: MsgRecord): Promise<void>;
  findByStatuses(statuses: MsgStatus[]): Promise<MsgRecord[]>;
}
