import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';

export type VerifyTransferParams = {
  signature: string;      // tx signature
  recipient: string;      // recipient base58 (for EVM->SOL leg)
  amount: bigint;         // expected delta in smallest unit
  mint?: string;          // undefined => SOL native; else SPL mint
};

export type VerifyDepositParams = {
  signature: string;      // deposit tx signature (SOL->EVM leg)
  vault: string;          // program vault account that must increase
  amount: bigint;         // expected delta in smallest unit
  mint?: string;          // undefined => SOL native; else SPL mint
  programId?: string;     // optional: assert your program id was invoked
};

@Injectable()
export class SolService {
  private readonly conn: Connection;

  constructor(cfg: ConfigService) {
    const rpc = cfg.get<string>('SOLANA_RPC_URL', 'https://api.devnet.solana.com');
    this.conn = new Connection(rpc, 'confirmed');
  }

  async getTx(signature: string): Promise<ParsedTransactionWithMeta> {
    const tx = await this.conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx) throw new Error('Solana tx not found');
    return tx;
  }

  async verifyTransfer(p: VerifyTransferParams) {
    const tx = await this.getTx(p.signature);
    const recipient = new PublicKey(p.recipient).toBase58();

    if (!p.mint) {
      const idx = tx.transaction.message.accountKeys.findIndex((k) => {
        const key = 'pubkey' in k ? k.pubkey : k;
        return key.toBase58() === recipient;
      });
      if (idx < 0) throw new Error('Recipient not in message keys');

      const pre = BigInt(tx.meta?.preBalances?.[idx] ?? 0);
      const post = BigInt(tx.meta?.postBalances?.[idx] ?? 0);
      const delta = post - pre;
      if (delta < p.amount) {
        throw new Error(`SOL delta ${delta} < expected ${p.amount}`);
      }
      return { ok: true, tx };
    }

    const pre = tx.meta?.preTokenBalances?.find(
      (b) => b.owner === recipient && b.mint === p.mint,
    );
    const post = tx.meta?.postTokenBalances?.find(
      (b) => b.owner === recipient && b.mint === p.mint,
    );

    const preAmt = BigInt(pre?.uiTokenAmount?.amount ?? '0');
    const postAmt = BigInt(post?.uiTokenAmount?.amount ?? '0');
    const delta = postAmt - preAmt;
    if (delta < p.amount) {
      throw new Error(`SPL delta ${delta} < expected ${p.amount}`);
    }
    return { ok: true, tx };
  }

  async verifyDeposit(p: VerifyDepositParams) {
    const tx = await this.getTx(p.signature);
    if (p.programId) {
      const invoked = tx.transaction.message.accountKeys.some((k) => {
        const key = 'pubkey' in k ? k.pubkey : k;
        return key.toBase58() === p.programId;
      });
      if (!invoked) throw new Error('Bridge program not invoked in this tx');
    }

    // Check vault delta (SOL or SPL)
    const vault = new PublicKey(p.vault).toBase58();

    if (!p.mint) {
      const idx = tx.transaction.message.accountKeys.findIndex((k) => {
        const key = 'pubkey' in k ? k.pubkey : k;
        return key.toBase58() === vault;
      });
      if (idx < 0) throw new Error('Vault not in message keys');
      const pre = BigInt(tx.meta?.preBalances?.[idx] ?? 0);
      const post = BigInt(tx.meta?.postBalances?.[idx] ?? 0);
      const delta = post - pre;
      if (delta < p.amount) {
        throw new Error(`Vault SOL delta ${delta} < expected ${p.amount}`);
      }
      return { ok: true, tx };
    }

    const pre = tx.meta?.preTokenBalances?.find(
      (b) => b.owner === vault && b.mint === p.mint,
    );
    const post = tx.meta?.postTokenBalances?.find(
      (b) => b.owner === vault && b.mint === p.mint,
    );
    const preAmt = BigInt(pre?.uiTokenAmount?.amount ?? '0');
    const postAmt = BigInt(post?.uiTokenAmount?.amount ?? '0');
    const delta = postAmt - preAmt;
    if (delta < p.amount) {
      throw new Error(`Vault SPL delta ${delta} < expected ${p.amount}`);
    }
    return { ok: true, tx };
  }
}
