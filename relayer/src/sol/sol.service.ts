import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  Finality,
} from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import * as fs from 'fs';
import * as anchor from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bridgeIdl from 'src/abi/bridge.json';


export type VerifyTransferParams = {
  signature: string;   // tx signature
  recipient: string;   // owner base58 (destination)
  amount: bigint;      // expected delta in SPL base units (mint decimals)
  mint?: string;       // undefined => SOL native; else SPL mint
};

export type VerifyDepositParams = {
  signature: string;
  vault: string;       // owner that must increase
  amount: bigint;
  mint?: string;
  programId?: string;
};

export type VerifyAndSettleOnSolanaParams = {
  requestId: bigint | string | number;
  evmTransferTxHash: `0x${string}`;   // 32 bytes hex
  evidenceHash?: `0x${string}`;      // opcional, 32 bytes hex
  accounts: {
    payer: string;        // signer/fee payer
    escrowOwner: string;  // PDA owner del vault
    escrowToken: string;  // ATA del vault (SPL)
    mint: string;         // SPL mint
    mxeAccount: string;   // tus PDAs auxiliares
    feePool: string;
    clock: string;
    tokenProgram?: string;   // override opcional
    systemProgram?: string;  // override opcional
  };
};


@Injectable()
export class SolService {
  private readonly conn: Connection;
  private readonly logger = new Logger(SolService.name);

  constructor(cfg: ConfigService) {
    const rpc = cfg.get<string>('SOLANA_RPC_URL', 'https://api.devnet.solana.com');
    this.conn = new Connection(rpc, 'confirmed');
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Retry wrapper to make sure meta is available (avoids false delta=0 right after submission). */
  private async getTxWithRetry(sig: string, tries = 6, commitment: Finality = 'confirmed') {
    let last: ParsedTransactionWithMeta | null = null;

    for (let i = 0; i < tries; i++) {
      last = await this.conn.getParsedTransaction(sig, {
        maxSupportedTransactionVersion: 0,
        commitment,
      });

      if (last?.meta) {
        // If the transaction actually failed, say it loudly.
        if (last.meta.err) {
          this.logger.warn(`[getTxWithRetry] tx failed with meta.err=${JSON.stringify(last.meta.err)}`);
          throw new BadRequestException(`Solana tx failed: ${JSON.stringify(last.meta.err)}`);
        }
        return last;
      }
      await this.sleep(400 * (i + 1));
    }

    if (!last) throw new BadRequestException('Solana tx not found');
    if (!last.meta) throw new BadRequestException('Solana tx meta not available yet');
    return last;
  }

  /** Sums balances for a given owner+mint across all token accounts in pre/post arrays. */
  private sumOwnerMint(balances: any[] | null | undefined, owner: string, mint: string): bigint {
    const arr = (balances ?? []) as any[];
    return arr
      .filter((b) => b?.owner === owner && b?.mint === mint)
      .map((b) => BigInt(b?.uiTokenAmount?.amount ?? '0'))
      .reduce((a, b) => a + b, 0n);
  }

  async verifyTransfer(p: VerifyTransferParams) {
    const owner = new PublicKey(p.recipient).toBase58();
    const tx = await this.getTxWithRetry(p.signature, 6, 'confirmed');

    // Native SOL
    if (!p.mint) {
      const idx = tx.transaction.message.accountKeys.findIndex((k) => {
        const key = 'pubkey' in k ? k.pubkey : k;
        return key.toBase58() === owner;
      });
      if (idx < 0) throw new BadRequestException('Recipient not in message keys');

      const pre  = BigInt(tx.meta?.preBalances?.[idx] ?? 0);
      const post = BigInt(tx.meta?.postBalances?.[idx] ?? 0);
      const delta = post - pre;

      this.logger.log(`[verifyTransfer:SOL] pre=${pre} post=${post} delta=${delta} expect=${p.amount}`);

      if (delta < p.amount) {
        throw new BadRequestException(`SOL delta ${delta} < expected ${p.amount}`);
      }
      return { ok: true, tx };
    }

    // SPL token: sum across all token accounts for this owner+mint.
    const mint = new PublicKey(p.mint).toBase58();

    // Just for diagnostics: canonical ATA (not required for the sum)
    const ata = await getAssociatedTokenAddress(new PublicKey(mint), new PublicKey(owner), false);
    this.logger.log(
      `[verifyTransfer:SPL] owner=${owner} mint=${mint} ata=${ata.toBase58()} expect=${p.amount}`,
    );

    const preSum  = this.sumOwnerMint(tx.meta?.preTokenBalances,  owner, mint);
    const postSum = this.sumOwnerMint(tx.meta?.postTokenBalances, owner, mint);
    const delta   = postSum - preSum;

    this.logger.log(`[verifyTransfer:SPL] preSum=${preSum} postSum=${postSum} delta=${delta}`);

    if (delta < p.amount) {
      const pDbg = (tx.meta?.preTokenBalances ?? [])
        .filter((b: any) => b?.owner === owner && b?.mint === mint)
        .map((b: any) => ({ idx: b.accountIndex, amt: b?.uiTokenAmount?.amount }));
      const qDbg = (tx.meta?.postTokenBalances ?? [])
        .filter((b: any) => b?.owner === owner && b?.mint === mint)
        .map((b: any) => ({ idx: b.accountIndex, amt: b?.uiTokenAmount?.amount }));

      this.logger.warn(
        `[verifyTransfer:SPL] delta ${delta} < expected ${p.amount} | pre=${JSON.stringify(pDbg)} post=${JSON.stringify(qDbg)}`
      );
      throw new BadRequestException(`SPL delta ${delta} < expected ${p.amount}`);
    }

    return { ok: true, tx };
  }

  async verifyDeposit(p: VerifyDepositParams) {
    const tx = await this.getTxWithRetry(p.signature, 6, 'confirmed');

    if (p.programId) {
      const invoked = tx.transaction.message.accountKeys.some((k) => {
        const key = 'pubkey' in k ? k.pubkey : k;
        return key.toBase58() === p.programId;
      });
      if (!invoked) throw new BadRequestException('Bridge program not invoked in this tx');
    }

    const vault = new PublicKey(p.vault).toBase58();

    // Native SOL
    if (!p.mint) {
      const idx = tx.transaction.message.accountKeys.findIndex((k) => {
        const key = 'pubkey' in k ? k.pubkey : k;
        return key.toBase58() === vault;
      });
      if (idx < 0) throw new BadRequestException('Vault not in message keys');

      const pre  = BigInt(tx.meta?.preBalances?.[idx] ?? 0);
      const post = BigInt(tx.meta?.postBalances?.[idx] ?? 0);
      const delta = post - pre;

      this.logger.debug(`[verifyDeposit:SOL] pre=${pre} post=${post} delta=${delta} expect=${p.amount}`);

      if (delta < p.amount) {
        throw new BadRequestException(`Vault SOL delta ${delta} < expected ${p.amount}`);
      }
      return { ok: true, tx };
    }

    // SPL
    const mint = new PublicKey(p.mint).toBase58();
    const preSum  = this.sumOwnerMint(tx.meta?.preTokenBalances,  vault, mint);
    const postSum = this.sumOwnerMint(tx.meta?.postTokenBalances, vault, mint);
    const delta   = postSum - preSum;

    this.logger.debug(`[verifyDeposit:SPL] preSum=${preSum} postSum=${postSum} delta=${delta} expect=${p.amount}`);

    if (delta < p.amount) {
      throw new BadRequestException(`Vault SPL delta ${delta} < expected ${p.amount}`);
    }
    return { ok: true, tx };
  }
  // === NUEVO: helpers privados para verify_and_settle ===
  private hex32ToBytes(hex: string): Uint8Array {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (h.length !== 64) {
      throw new BadRequestException(`expected 32-byte hex, got len=${h.length}`);
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  private toBNu128(x: bigint | string | number): anchor.BN {
    const b = typeof x === 'bigint' ? x : BigInt(x);
    if (b < 0n || b > (1n << 128n) - 1n) {
      throw new BadRequestException('requestId out of u128 range');
    }
    return new anchor.BN(b.toString());
  }

  private getAnchorCtx() {
    const programIdStr = process.env.SOLANA_PROGRAM_ID;
    if (!programIdStr) throw new Error('SOLANA_PROGRAM_ID missing');

    const keypairPath =
      process.env.SOLANA_RELAYER_KEYPAIR_PATH ??
      `${process.env.HOME}/.config/solana/id.json`;

    const raw = fs.readFileSync(keypairPath, 'utf8');
    const kp = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    const wallet = new anchor.Wallet(kp);
    const provider = new anchor.AnchorProvider(this.conn, wallet, { commitment: 'confirmed' });

    const programId = new PublicKey(programIdStr);
    const idl = bridgeIdl as Idl;
    const program = new anchor.Program(idl, provider);

    // sanity: la instrucción puede estar camel o snake según Anchor
    const hasCamel = typeof (program.methods as any)['verifyAndSettle'] === 'function';
    const hasSnake = typeof (program.methods as any)['verify_and_settle'] === 'function';
    if (!hasCamel && !hasSnake) {
      throw new Error('verify_and_settle not found in IDL/program.methods');
    }
    return { provider, program };
  }

  // === NUEVO: llama a verify_and_settle del programa Anchor ===
  async verifyAndSettleOnSolana(p: VerifyAndSettleOnSolanaParams) {
    const { provider, program } = this.getAnchorCtx();

    const requestIdBn = this.toBNu128(p.requestId);
    const evmTxHash = this.hex32ToBytes(p.evmTransferTxHash);
    const evidence = p.evidenceHash ? this.hex32ToBytes(p.evidenceHash) : new Uint8Array(32);

    const accounts = {
      payer: new PublicKey(p.accounts.payer),
      escrowOwner: new PublicKey(p.accounts.escrowOwner),
      escrowToken: new PublicKey(p.accounts.escrowToken),
      mint: new PublicKey(p.accounts.mint),
      mxeAccount: new PublicKey(p.accounts.mxeAccount),
      feePool: new PublicKey(p.accounts.feePool),
      clock: new PublicKey(p.accounts.clock),
      tokenProgram: new PublicKey(p.accounts.tokenProgram ?? TOKEN_PROGRAM_ID.toBase58()),
      systemProgram: new PublicKey(p.accounts.systemProgram ?? SystemProgram.programId.toBase58()),
    };

    this.logger.log(
      `[verifyAndSettleOnSolana] req=${requestIdBn.toString()} evmTx=${p.evmTransferTxHash} evidence=${p.evidenceHash ?? '0x00..'}`
    );

    // preferimos camelCase; si no está, usamos snake_case
    const m =
      (program.methods as any)['verifyAndSettle'] ??
      (program.methods as any)['verify_and_settle'];

    try {
      const sig: string = await m(requestIdBn, Array.from(evmTxHash), Array.from(evidence))
        .accounts(accounts)
        .rpc();

      this.logger.log(`[verifyAndSettleOnSolana] submitted: ${sig}`);

      const conf = await provider.connection.confirmTransaction(sig, 'confirmed');
      if (conf.value.err) {
        this.logger.warn(`[verifyAndSettleOnSolana] tx err: ${JSON.stringify(conf.value.err)}`);
        throw new BadRequestException(`verify_and_settle failed: ${JSON.stringify(conf.value.err)}`);
      }

      return { ok: true, signature: sig };
    } catch (e: any) {
      this.logger.error(`[verifyAndSettleOnSolana] error: ${e?.message ?? e}`);
      throw new BadRequestException(e?.message ?? String(e));
    }
  }
}
