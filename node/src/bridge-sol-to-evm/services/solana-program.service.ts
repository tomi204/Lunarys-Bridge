import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, SystemProgram, TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { NodeConfig } from '@/types/node-config';

@Injectable()
export class SolanaProgramService {
  private readonly logger = new Logger(SolanaProgramService.name);
  private readonly conn: Connection;
  private readonly wallet: Keypair;
  private readonly programId: PublicKey;

  constructor(private readonly config: ConfigService<NodeConfig, true>) {
    this.conn      = new Connection(this.config.get('solanaRpcUrl'), 'confirmed');
    this.wallet    = Keypair.fromSecretKey(this.parsePK(this.config.get('solanaPrivateKey')));
    this.programId = new PublicKey(this.config.get('solanaProgramId'));
  }

  private parsePK(input: string): Uint8Array {
    const t = input.trim();
    if (t.startsWith('[')) return Uint8Array.from(JSON.parse(t));
    return bs58.decode(t);
  }

  /** claim_request(request_id) */
  async claimRequest(requestId: bigint, requestOwner: PublicKey, minBondLamports: number): Promise<string> {
    // PDAs (ejemplo con seeds del repo)
    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], this.programId);
    const [requestPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('request'), requestOwner.toBuffer(), this.u64LE(requestId)],
      this.programId,
    );
    const [bondVault] = PublicKey.findProgramAddressSync([Buffer.from('bond'), this.u64LE(requestId)], this.programId);

    // TODO: construir la instrucción exacta leyendo tu IDL/encoder o a mano:
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // solver
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: requestPda, isSigner: false, isWritable: true },
        { pubkey: requestOwner, isSigner: false, isWritable: false },
        { pubkey: bondVault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.encodeIx('claim_request', { request_id: requestId }), // <-- implementá tu encoder o Anchor IDL
    });

    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: this.wallet.publicKey, toPubkey: bondVault, lamports: minBondLamports }),
      ix,
    );
    const sig = await sendAndConfirmTransaction(this.conn, tx, [this.wallet]);
    this.logger.log(`claim_request sig=${sig}`);
    return sig;
  }

  /** verify_and_settle_spl(request_id, destTxHash, evidenceHash) */
  async verifyAndSettleSpl(requestId: bigint, requestOwner: PublicKey, mint: PublicKey, solverToken: PublicKey, destTxHash: Uint8Array, evidenceHash: Uint8Array): Promise<string> {
    // PDAs como en tu handler
    const [configPda]   = PublicKey.findProgramAddressSync([Buffer.from('config')], this.programId);
    const [requestPda]  = PublicKey.findProgramAddressSync([Buffer.from('request'), requestOwner.toBuffer(), this.u64LE(requestId)], this.programId);
    const [bondVault]   = PublicKey.findProgramAddressSync([Buffer.from('bond'), this.u64LE(requestId)], this.programId);
    const signPda       = this.deriveSignPda(); // si usás derive_sign_pda!(), resolvelo acá

    const escrowToken = await this.findEscrowTokenForMint(mint, signPda); // implementá lookup
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true }, // relayer = owner
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: requestPda, isSigner: false, isWritable: true },
        { pubkey: requestOwner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: escrowToken, isSigner: false, isWritable: true },
        { pubkey: solverToken, isSigner: false, isWritable: true },
        { pubkey: signPda, isSigner: false, isWritable: true },
        { pubkey: bondVault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: this.encodeIx('verify_and_settle_spl', {
        request_id: requestId,
        dest_tx_hash: destTxHash,
        evidence_hash: evidenceHash,
      }),
    });

    const tx = new Transaction().add(ix);
    const sig = await sendAndConfirmTransaction(this.conn, tx, [this.wallet]);
    this.logger.log(`verify_and_settle_spl sig=${sig}`);
    return sig;
  }

  // --------- helpers a completar según tu toolchain / IDL ----------
  private encodeIx(_name: string, _args: any): Buffer {
    // TODO: usa Anchor IDL coder o borsh propio
    return Buffer.alloc(0);
  }
  private deriveSignPda(): PublicKey {
    // TODO: si tenés SIGN_PDA_SEED y bump persistido en account, calculalo acá
    return this.wallet.publicKey;
  }
  private async findEscrowTokenForMint(_mint: PublicKey, _signPda: PublicKey): Promise<PublicKey> {
    // TODO: resuelve la vault (p.ej. es ATA del signPda)
    return _signPda;
  }
  private u64LE(n: bigint): Buffer {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(n);
    return b;
  }
}
