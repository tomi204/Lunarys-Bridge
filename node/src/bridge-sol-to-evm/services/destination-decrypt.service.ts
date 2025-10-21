// src/bridge-sol-to-evm/services/destination-decrypt.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PublicKey } from '@solana/web3.js';
import { ArciumReaderService } from './arcium-reader.service';
import { SolverKeyService } from './solver-key.service';
import { SolanaProgramService } from './solana-program.service';
import { RescueCipher, x25519 } from '@arcium-hq/client';

@Injectable()
export class DestinationDecryptService {
  private readonly logger = new Logger(DestinationDecryptService.name);

  constructor(
    private readonly reader: ArciumReaderService,
    private readonly keys: SolverKeyService,
    private readonly sol: SolanaProgramService,
  ) {}

  /**
   * Flow:
   * 1) claim_request(request_id, offset, solver_x25519)
   * 2) wait for MXE finalization
   * 3) fetch resealed output (nonce + 4 ciphertext words)
   * 4) ECDH + RescueCipher.decrypt → 4×u64 → rebuild u256 → EVM address
   */
  async resolveEvmDestination(
    requestId: bigint,
    requestOwner: PublicKey,
    _minBondLamports: number, // kept in signature for compatibility with caller, but not used
  ): Promise<`0x${string}`> {
    // 1) choose offset and attach solver pubkey
    const offset = this.reader.pickComputationOffset();

    const solverPub = this.keys.getPublicKey();
    if (!(solverPub instanceof Uint8Array) || solverPub.length !== 32) {
      throw new Error('Solver x25519 public key must be a 32-byte Uint8Array');
    }

    // 2) queue reseal via claim_request
    // NOTE: SolanaProgramService.claimRequest expects (requestId, requestOwner, offset, solverPub)
    const sig = await this.sol.claimRequest(
      requestId,
      requestOwner,
      offset,
      solverPub,
    );
    this.logger.log(`claim_request sig=${sig}`);

    // 3) wait MXE finalization
    await this.reader.waitFinalization(offset);

    // 4) fetch resealed output (nonce: Uint8Array(16), ctWords: 4×Uint8Array(32))
    const out = await this.reader.fetchResealOutput(offset);

    if (!out?.ctWords || out.ctWords.length !== 4) {
      throw new Error('Invalid reseal output: expected 4 ciphertext words');
    }
    if (!(out.nonce instanceof Uint8Array) || out.nonce.length !== 16) {
      throw new Error('Invalid reseal output: nonce must be 16-byte Uint8Array');
    }

    // 5) shared secret + decrypt
    const mxePub = await this.reader.getMxePublicKey();
    const shared = x25519.getSharedSecret(this.keys.getPrivateKey(), mxePub);
    const cipher = new RescueCipher(shared);

    // RescueCipher.decrypt types (per current @arcium-hq/client typings):
    // - ctWords: number[][]
    // - nonce:  Uint8Array
    const ciphertext: number[][] = out.ctWords.map((w: Uint8Array) => Array.from(w));
    const nonce: Uint8Array = out.nonce;

    // Decrypt → 4 u64 (BigInt) in LE
    const plains = cipher.decrypt(ciphertext, nonce) as bigint[];
    if (!plains || plains.length < 4) {
      throw new Error('Decrypt incomplete (expected 4 u64)');
    }

    // Rebuild u256 from 4×u64 (LE) and take the lowest 20 bytes for EVM address
    let evmU256 = 0n;
    for (let i = 0; i < 4; i++) {
      evmU256 |= (plains[i] & ((1n << 64n) - 1n)) << (64n * BigInt(i));
    }
    const hex = evmU256.toString(16).padStart(64, '0');
    const addr = `0x${hex.slice(24 * 2)}` as `0x${string}`;
    return addr;
  }
}
