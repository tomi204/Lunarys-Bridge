// src/bridge-sol-to-evm/services/solana-program.service.ts
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
} from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import bs58 from 'bs58';
import { createHash } from 'crypto';
import { NodeConfig } from 'src/types/node-config';
import { getArciumEnv } from '@arcium-hq/client';

@Injectable()
export class SolanaProgramService {
  private readonly logger = new Logger(SolanaProgramService.name);
  private readonly conn: Connection;
  private readonly wallet: Keypair;

  // Bridge (your program) + Arcium program ids
  private readonly bridgeProgramId: PublicKey;
  private readonly arciumProgramId: PublicKey;

  // Comp-def PDA for reseal (provided by you)
  private readonly compDefResealPda: PublicKey;

  // Cached Arcium env lookups
  private arciumResolved:
    | {
        mxeAccount: PublicKey; // derive_mxe_pda!()
        mempool: PublicKey;
        execpool: PublicKey;
        cluster: PublicKey;
        feePool: PublicKey;
        clock: PublicKey;
        signPda: PublicKey; // derive_sign_pda!()
      }
    | null = null;

  constructor(private readonly cfg: ConfigService<NodeConfig, true>) {
    this.conn = new Connection(cfg.get('solanaRpcUrl'), 'confirmed');
    this.wallet = Keypair.fromSecretKey(this.parsePK(cfg.get('solanaPrivateKey')));

    // Program ids
    this.bridgeProgramId = new PublicKey(cfg.get('solanaProgramId'));
    this.arciumProgramId = new PublicKey(cfg.get('arciumProgramId')); // BKck...

    // Comp-def PDA (reseal_destination)
    this.compDefResealPda = new PublicKey(cfg.get('arciumCompDefResealPda'));
  }

  /**
   * claim_bridge(computation_offset_reseal, request_id, solver_x25519)
   * Matches your Anchor entrypoint signature and Accounts in `ClaimRequest`.
   */
  async claimRequest(
    requestId: bigint,
    requestOwner: PublicKey,
    computationOffsetReseal: bigint,
    solverX25519: Uint8Array, // 32 bytes
  ): Promise<string> {
    if (solverX25519.length !== 32) throw new Error('solver_x25519 must be 32 bytes');

    // Bridge PDAs (config / request / bond)
    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], this.bridgeProgramId);
    const [requestPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('request'), requestOwner.toBuffer(), this.u64LE(requestId)],
      this.bridgeProgramId,
    );
    const [bondVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('bond'), this.u64LE(requestId)],
      this.bridgeProgramId,
    );

    // Arcium accounts (resolved once from SDK)
    const arc = await this.resolveArciumAccounts();
    const computation = this.deriveArciumComputationPda(computationOffsetReseal);

    // Anchor discriminator + args (u64, u64, [u8;32])
    const data = Buffer.concat([
      this.anchorIxDisc('claim_bridge'),
      this.u64LE(computationOffsetReseal),
      this.u64LE(requestId),
      Buffer.from(solverX25519),
    ]);

    // Account metas in the exact order your Accounts struct requires
    const keys = [
      // --- solver / bridge state ---
      { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // solver
      { pubkey: configPda,             isSigner: false, isWritable: false },
      { pubkey: requestPda,            isSigner: false, isWritable: true },
      { pubkey: requestOwner,          isSigner: false, isWritable: false },
      { pubkey: bondVault,             isSigner: false, isWritable: true },

      // --- Arcium (reseal) ---
      { pubkey: arc.signPda,           isSigner: false, isWritable: true  },
      { pubkey: arc.mxeAccount,        isSigner: false, isWritable: false },
      { pubkey: arc.mempool,           isSigner: false, isWritable: true  },
      { pubkey: arc.execpool,          isSigner: false, isWritable: true  },
      { pubkey: computation,           isSigner: false, isWritable: true  },
      { pubkey: this.compDefResealPda, isSigner: false, isWritable: false },
      { pubkey: arc.cluster,           isSigner: false, isWritable: true  },
      { pubkey: arc.feePool,           isSigner: false, isWritable: true  },
      { pubkey: arc.clock,             isSigner: false, isWritable: false },
      { pubkey: this.arciumProgramId,  isSigner: false, isWritable: false },

      // --- System ---
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const ix = new TransactionInstruction({
      programId: this.bridgeProgramId,
      keys,
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(this.conn, tx, [this.wallet]);
    this.logger.log(`claim_bridge sent: ${sig}`);
    return sig;
  }

  // ----------------- helpers -----------------

  /** Anchor 8-byte discriminator: sha256("global:<name>")[0..8] */
  private anchorIxDisc(name: string): Buffer {
    return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
  }

  /** u64 (LE) encoder for bigint */
  private u64LE(n: bigint): Buffer {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(n);
    return b;
  }

  /** Allows base58 secret or JSON array form */
  private parsePK(input: string): Uint8Array {
    const t = (input || '').trim();
    if (t.startsWith('[')) return Uint8Array.from(JSON.parse(t));
    return bs58.decode(t);
  }

  /**
   * Pull Arcium PDAs from SDK env (no args in current client).
   * If the shape differs, log `env` and adjust the field mapping.
   */
  private async resolveArciumAccounts(): Promise<{
    mxeAccount: PublicKey;
    mempool: PublicKey;
    execpool: PublicKey;
    cluster: PublicKey;
    feePool: PublicKey;
    clock: PublicKey;
    signPda: PublicKey;
  }> {
    if (this.arciumResolved) return this.arciumResolved;

    const env: any = await getArciumEnv(); // no arguments with the current SDK

    const toPk = (v: unknown): PublicKey | null => {
      if (typeof v === 'string') {
        try { return new PublicKey(v); } catch { return null; }
      }
      return null;
    };

    const pick = (...paths: string[]) => {
      for (const p of paths) {
        const v = p.split('.').reduce<any>((acc, k) => (acc ? acc[k] : undefined), env);
        const pk = toPk(v);
        if (pk) return pk;
      }
      return null;
    };

    const mxeAccount =
      pick('mxeAccount', 'accounts.mxe', 'mxe') ??
      this.fail('Arcium MXE account not found in env');
    const mempool =
      pick('mempoolPda', 'mempool', 'accounts.mempool') ??
      this.fail('Arcium mempool PDA not found in env');
    const execpool =
      pick('execpoolPda', 'executingPoolPda', 'accounts.execpool') ??
      this.fail('Arcium execpool PDA not found in env');
    const cluster =
      pick('clusterPda', 'cluster', 'accounts.cluster') ??
      this.fail('Arcium cluster PDA not found in env');
    const feePool =
      pick('feePool', 'feePoolPda', 'accounts.feePool') ??
      this.fail('Arcium fee pool account not found in env');
    const clock =
      pick('clock', 'clockAccount', 'accounts.clock') ??
      this.fail('Arcium clock account not found in env');
    const signPda =
      pick('signPda', 'signerPda', 'accounts.signer') ??
      this.fail('Arcium sign PDA not found in env');

    this.arciumResolved = { mxeAccount, mempool, execpool, cluster, feePool, clock, signPda };
    return this.arciumResolved;
  }

  private fail(msg: string): never {
    throw new Error(
      `${msg}. If your SDK exposes different keys, log getArciumEnv() and remap here.`
    );
  }

  /**
   * Derivation used by your program: #[account(mut, address = derive_comp_pda!(offset))]
   * If your macro uses different seeds, adjust the tag or seeds below.
   */
  private deriveArciumComputationPda(offset: bigint): PublicKey {
    const seedTag = Buffer.from('computation'); // default tag used by many Arcium templates
    const [pda] = PublicKey.findProgramAddressSync(
      [seedTag, this.u64LE(offset)],
      this.arciumProgramId,
    );
    return pda;
  }
}
