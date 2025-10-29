import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import bs58 from 'bs58';
import { createHash } from 'crypto';
import { NodeConfig } from 'src/types/node-config';

// Arcium helpers
import {
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
} from '@arcium-hq/client';

@Injectable()
export class SolanaProgramService {
  private readonly logger = new Logger(SolanaProgramService.name);
  private readonly conn: Connection;
  private readonly wallet: Keypair;

  private readonly bridgeProgramId: PublicKey;
  private readonly arciumProgramId: PublicKey;

  // PDAs fijos de cluster (env)
  private readonly arciumCluster: PublicKey;
  private readonly arciumFeePool: PublicKey;
  private readonly arciumClock: PublicKey;

  // seed para signer PDA del bridge
  private readonly signSeed: string;

  constructor(private readonly cfg: ConfigService<NodeConfig, true>) {
    this.conn = new Connection(cfg.get('solanaRpcUrl'), 'confirmed');
    this.wallet = Keypair.fromSecretKey(this.parsePK(cfg.get('solanaPrivateKey')));

    this.bridgeProgramId = new PublicKey(cfg.get('solanaProgramId'));
    this.arciumProgramId = new PublicKey(cfg.get('arciumProgramId'));

    // 🧩 ahora los keys coinciden con NodeConfig + .env
    this.arciumCluster = new PublicKey(cfg.get('arciumClusterPda'));
    this.arciumFeePool = new PublicKey(cfg.get('arciumFeePool'));
    this.arciumClock   = new PublicKey(cfg.get('arciumClock'));

    this.signSeed = (cfg.get('solanaSignSeed') || 'SignerAccount').trim();
  }

  /**
   * claim_bridge(computation_offset_reseal, request_id, solver_x25519)
   */
  async claimRequest(
    requestId: bigint,
    requestOwner: PublicKey,
    computationOffsetReseal: bigint,
    solverX25519: Uint8Array, // 32 bytes
  ): Promise<string> {
    if (solverX25519.length !== 32) throw new Error('solver_x25519 must be 32 bytes');

    // --- PDAs del bridge ---
    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], this.bridgeProgramId);
    const [requestPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('request'), requestOwner.toBuffer(), this.u64LE(requestId)],
      this.bridgeProgramId,
    );
    const [bondVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('bond'), this.u64LE(requestId)],
      this.bridgeProgramId,
    );
    const [signPda] = PublicKey.findProgramAddressSync([Buffer.from(this.signSeed)], this.bridgeProgramId);

    // --- PDAs de Arcium (helpers)
    const mxeAccount = getMXEAccAddress(this.bridgeProgramId);
    const mempool    = getMempoolAccAddress(this.bridgeProgramId);
    const execpool   = getExecutingPoolAccAddress(this.bridgeProgramId);
    const computation = getComputationAccAddress(
      this.bridgeProgramId,
      new anchor.BN(computationOffsetReseal.toString()),
    );

    // ✅ offset para comp-def reseal
    const resealOffsetRaw = getCompDefAccOffset('reseal_destination');
    const resealOffsetU32 = this.toU32FromSdkOffset(resealOffsetRaw);
    const compDefResealPda = getCompDefAccAddress(this.bridgeProgramId, resealOffsetU32);

    // --- instruction data ---
    const data = Buffer.concat([
      this.anchorIxDisc('claim_bridge'),
      this.u64LE(computationOffsetReseal),
      this.u64LE(requestId),
      Buffer.from(solverX25519),
    ]);

    const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

    const keys = [
      // solver / state
      { pubkey: this.wallet.publicKey, isSigner: true,  isWritable: true  },
      { pubkey: configPda,             isSigner: false, isWritable: false },
      { pubkey: requestPda,            isSigner: false, isWritable: true  },
      { pubkey: requestOwner,          isSigner: false, isWritable: false },
      { pubkey: bondVault,             isSigner: false, isWritable: true  },

      // Arcium (reseal)
      { pubkey: signPda,               isSigner: false, isWritable: true  },
      { pubkey: mxeAccount,            isSigner: false, isWritable: false },
      { pubkey: mempool,               isSigner: false, isWritable: true  },
      { pubkey: execpool,              isSigner: false, isWritable: true  },
      { pubkey: computation,           isSigner: false, isWritable: true  },
      { pubkey: compDefResealPda,      isSigner: false, isWritable: false },
      { pubkey: this.arciumCluster,    isSigner: false, isWritable: true  },
      { pubkey: this.arciumFeePool,    isSigner: false, isWritable: true  },
      { pubkey: this.arciumClock,      isSigner: false, isWritable: false },
      { pubkey: this.arciumProgramId,  isSigner: false, isWritable: false }, // program Arcium

      // system
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const ix = new TransactionInstruction({ programId: this.bridgeProgramId, keys, data });
    const tx = new Transaction().add(cu, ix);
    const sig = await sendAndConfirmTransaction(this.conn, tx, [this.wallet]);
    this.logger.log(`claim_bridge sent: ${sig}`);
    return sig;
  }

  // ----------------- helpers -----------------

  private anchorIxDisc(name: string): Buffer {
    return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
  }
  private u64LE(n: bigint): Buffer {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(n);
    return b;
  }
  private parsePK(input: string): Uint8Array {
    const t = (input || '').trim();
    if (t.startsWith('[')) return Uint8Array.from(JSON.parse(t));
    return bs58.decode(t);
  }
  // ✅ normaliza offset SDK a u32
  private toU32FromSdkOffset(off: number | Uint8Array): number {
    if (typeof off === 'number') return off >>> 0;
    if (!(off instanceof Uint8Array) || off.byteLength < 4) {
      throw new Error('Invalid comp-def offset: expected number or Uint8Array with >=4 bytes');
    }
    return new DataView(off.buffer, off.byteOffset, 4).getUint32(0, true);
  }
}
