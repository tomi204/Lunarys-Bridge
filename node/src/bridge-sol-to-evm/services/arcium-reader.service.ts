import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeConfig } from 'src/types/node-config';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import { awaitComputationFinalization, getComputationAccAddress } from '@arcium-hq/client';

export type ResealOutput = {
  nonce: Uint8Array; // 16 bytes
  ctWords: [Uint8Array, Uint8Array, Uint8Array, Uint8Array]; // 4×32 bytes
};

const RESEAL_LAYOUT_NONCE_LEN = 16;
const RESEAL_LAYOUT_WORDS = 4;
const RESEAL_LAYOUT_WORD_LEN = 32;
// si el cluster usa header/flags, ajustá este offset base:
const RESEAL_LAYOUT_OFFSET = 0;

@Injectable()
export class ArciumReaderService {
  private readonly logger = new Logger(ArciumReaderService.name);
  private readonly conn: Connection;
  private readonly provider: anchor.AnchorProvider;

  private readonly mxeProgramId: PublicKey;
  private readonly bridgeProgramId: PublicKey;

  constructor(private readonly cfg: ConfigService<NodeConfig, true>) {
    this.conn = new Connection(this.cfg.get('solanaRpcUrl'), 'confirmed');

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
    this.bridgeProgramId = new PublicKey(this.cfg.get('solanaProgramId')); // OJO: esto es tu programa
  }

  pickComputationOffset(): bigint {
    const a = BigInt(Math.floor(Math.random() * 2 ** 32));
    const b = BigInt(Math.floor(Math.random() * 2 ** 32));
    return (a << 32n) | b;
  }

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
   * Lee la computation PDA y extrae: nonce(16) + 4×32 bytes.
   * Si tu cluster guarda el resultado con otros offsets, ajustá las constantes RESEAL_LAYOUT_*
   */
  async fetchResealOutput(offset: bigint): Promise<ResealOutput> {
    const comp = getComputationAccAddress(this.bridgeProgramId, new anchor.BN(offset.toString()));
    const acc = await this.conn.getAccountInfo(comp, 'confirmed');
    if (!acc?.data?.length) {
      throw new Error(`Computation account not found / empty: ${comp.toBase58()}`);
    }

    const data = acc.data.subarray(RESEAL_LAYOUT_OFFSET);
    if (data.length < RESEAL_LAYOUT_NONCE_LEN + RESEAL_LAYOUT_WORDS * RESEAL_LAYOUT_WORD_LEN) {
      throw new Error(`Reseal data too short (${data.length} bytes)`);
    }

    const nonce = data.subarray(0, RESEAL_LAYOUT_NONCE_LEN);
    const words: Uint8Array[] = [];
    let p = RESEAL_LAYOUT_NONCE_LEN;
    for (let i = 0; i < RESEAL_LAYOUT_WORDS; i++) {
      words.push(data.subarray(p, p + RESEAL_LAYOUT_WORD_LEN));
      p += RESEAL_LAYOUT_WORD_LEN;
    }

    return {
      nonce,
      ctWords: [words[0], words[1], words[2], words[3]],
    };
  }

  async getMxePublicKey(): Promise<Uint8Array> {
    const injected = (this.cfg.get('arciumMxeX25519PublicKey') || '').trim();
    if (!injected) {
      throw new Error(
        'Missing ARCIUM_MXE_X25519_PUBLIC_KEY in .env (32-byte hex or base64)',
      );
    }
    const b = this.decodeKey(injected);
    if (b.length !== 32) {
      throw new Error('ARCIUM_MXE_X25519_PUBLIC_KEY must be exactly 32 bytes');
    }
    return b;
  }

  private decodeKey(s: string): Uint8Array {
    if (/^[0-9a-fA-F]{64}$/.test(s)) {
      return Uint8Array.from(s.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
    }
    return Uint8Array.from(Buffer.from(s, 'base64'));
  }
}
