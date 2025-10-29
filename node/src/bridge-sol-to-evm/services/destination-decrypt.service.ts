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
   * 1) claim_request(request_id, offset, solver_x25519)
   * 2) wait MXE
   * 3) fetch resealed output
   * 4) decrypt → u256 → 20 bytes addr
   */
  async resolveEvmDestination(
    requestId: bigint,
    requestOwner: PublicKey,
    _minBondLamports: number,
  ): Promise<{ evmDestination: `0x${string}`, claimSig: string }> {
    const offset = this.reader.pickComputationOffset();

    const solverPub = this.keys.getPublicKey();
    if (!(solverPub instanceof Uint8Array) || solverPub.length !== 32) {
      throw new Error('Solver x25519 public key must be 32 bytes');
    }

    // claim + reseal
    const claimSig = await this.sol.claimRequest(
      requestId,
      requestOwner,
      offset,
      solverPub,
    );
    this.logger.log(`claim_request sig=${claimSig}`);

    await this.reader.waitFinalization(offset);

    const out = await this.reader.fetchResealOutput(offset);
    if (!out?.ctWords || out.ctWords.length !== 4) {
      throw new Error('Invalid reseal output: expected 4 ciphertext words');
    }
    if (!(out.nonce instanceof Uint8Array) || out.nonce.length !== 16) {
      throw new Error('Invalid reseal output: nonce must be 16 bytes');
    }

    // decrypt
    const mxePub = await this.reader.getMxePublicKey();
    const shared = x25519.getSharedSecret(this.keys.getPrivateKey(), mxePub);
    const cipher = new RescueCipher(shared);

    const ciphertext: number[][] = out.ctWords.map((w: Uint8Array) => Array.from(w));
    const plains = cipher.decrypt(ciphertext, out.nonce) as bigint[];
    if (!plains || plains.length < 4) throw new Error('Decrypt incomplete (expected 4 u64)');

    let evmU256 = 0n;
    for (let i = 0; i < 4; i++) {
      evmU256 |= (plains[i] & ((1n << 64n) - 1n)) << (64n * BigInt(i));
    }
    const hex = evmU256.toString(16).padStart(64, '0');
    const evmDestination = (`0x${hex.slice(24 * 2)}`) as `0x${string}`;

    return { evmDestination, claimSig };
  }
}
