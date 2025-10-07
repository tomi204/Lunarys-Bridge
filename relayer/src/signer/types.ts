import type { Hex } from 'viem';

export type Attestation = { v: number; r: Hex; s: Hex };

export interface AttestationProvider {
  /** Signs a 32-byte digest (keccak256 of canonical message). */
  signDigest(digest: Hex): Promise<Attestation>;
}

export const ATTESTATION_PROVIDER = Symbol('ATTESTATION_PROVIDER');
