import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeConfig } from 'src/types/node-config';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import { awaitComputationFinalization } from '@arcium-hq/client';

export type ResealOutput = {
  /** 16-byte Rescue-CTR nonce */
  nonce: Uint8Array;
  /** 4 ciphertext words (each serialized as [u8;32]) */
  ctWords: [Uint8Array, Uint8Array, Uint8Array, Uint8Array];
};

@Injectable()
export class ArciumReaderService {
  private readonly logger = new Logger(ArciumReaderService.name);
  private readonly conn: Connection;
  private readonly provider: anchor.AnchorProvider;
  private readonly mxeProgramId: PublicKey;

  constructor(private readonly cfg: ConfigService<NodeConfig, true>) {
    this.conn = new Connection(this.cfg.get('solanaRpcUrl'), 'confirmed');

    // Lightweight provider used only by Arcium helpers
    const dummyWallet: anchor.Wallet = {
      publicKey: anchor.web3.Keypair.generate().publicKey,
      signAllTransactions: async (txs) => txs,
      signTransaction: async (tx) => tx,
      payer: anchor.web3.Keypair.generate(),
    } as any;

    this.provider = new anchor.AnchorProvider(this.conn, dummyWallet, {
      preflightCommitment: 'confirmed',
    });
    this.mxeProgramId = new PublicKey(this.cfg.get('arciumMxeProgramId'));
  }

  /** Generate a random u64 offset (matches derive_comp_pda!(offset)) */
  pickComputationOffset(): bigint {
    const a = BigInt(Math.floor(Math.random() * 2 ** 32));
    const b = BigInt(Math.floor(Math.random() * 2 ** 32));
    return (a << 32n) | b;
  }

  /** Wait for MXE to finalize the computation for the given offset */
  async waitFinalization(offset: bigint): Promise<string> {
    const sig = await awaitComputationFinalization(
      this.provider as any,
      new anchor.BN(offset.toString()),
      this.mxeProgramId,
      'confirmed',
    );
    this.logger.log(`Arcium finalized (offset=${offset}) finalizeSig=${sig}`);
    return sig as string;
  }

  /**
   * Fetch the MXE x25519 public key used for ECDH.
   * Source: ARCIUM_MXE_X25519_PUBLIC_KEY (.env) as hex/base64 (32 bytes).
   */
  async getMxePublicKey(): Promise<Uint8Array> {
    const injected = (this.cfg.get('arciumMxeX25519PublicKey') || '').trim();
    if (!injected) {
      throw new Error(
        'Missing ARCIUM_MXE_X25519_PUBLIC_KEY in .env (provide 32-byte hex or base64 MXE x25519 pubkey).'
      );
    }
    const b = this.decodeKey(injected);
    if (b.length !== 32) {
      throw new Error('ARCIUM_MXE_X25519_PUBLIC_KEY must be exactly 32 bytes');
    }
    return b;
  }

  // TODO: implement with your SDK: return nonce(16) + 4×ciphertext [u8;32]
  async fetchResealOutput(_offset: bigint): Promise<ResealOutput> {
    throw new Error(
      'TODO(fetchResealOutput): read nonce + 4×ciphertext [u8;32] from your SDK/finalization artifacts'
    );
  }

  // ---- helpers ----
  private decodeKey(s: string): Uint8Array {
    // Accept 32-byte hex or base64
    if (/^[0-9a-fA-F]{64}$/.test(s)) {
      return Uint8Array.from(s.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
    }
    return Uint8Array.from(Buffer.from(s, 'base64'));
  }
}
