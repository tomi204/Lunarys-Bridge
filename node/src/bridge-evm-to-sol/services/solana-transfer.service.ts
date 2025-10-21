import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeConfig } from 'src/types/node-config';
import {
  Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer } from '@solana/spl-token';
import bs58 from 'bs58';
import { SolanaTransferResult } from 'src/bridge-evm-to-sol/types';

@Injectable()
export class SolanaTransferService {
  private readonly logger = new Logger(SolanaTransferService.name);
  private readonly connection: Connection;
  private readonly wallet: Keypair;

  constructor(private readonly config: ConfigService<NodeConfig, true>) {
    this.connection = new Connection(this.config.get('solanaRpcUrl'), 'confirmed');
    this.wallet = Keypair.fromSecretKey(this.parsePrivateKey(this.config.get('solanaPrivateKey')));
    this.logger.log(`Solana wallet: ${this.wallet.publicKey.toBase58()}`);
  }

  private parsePrivateKey(input: string): Uint8Array {
    const trimmed = input.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const arr = JSON.parse(trimmed);
      if (!Array.isArray(arr) || arr.length !== 64) throw new Error('Invalid Solana JSON key length (expected 64)');
      return Uint8Array.from(arr);
    }
    return bs58.decode(trimmed);
  }

  async transferSOL(destinationAddress: string, lamports: bigint): Promise<SolanaTransferResult> {
    const dest = new PublicKey(destinationAddress);
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: this.wallet.publicKey, toPubkey: dest, lamports: Number(lamports) }),
    );
    const sig = await sendAndConfirmTransaction(this.connection, tx, [this.wallet], { commitment: 'confirmed' });
    this.logger.log(`SOL transfer sig=${sig}`);
    return { signature: sig, success: true };
  }

  async transferSPLToken(mintAddress: string, destinationAddress: string, amount: bigint): Promise<SolanaTransferResult> {
    const mint = new PublicKey(mintAddress);
    const dest = new PublicKey(destinationAddress);

    const srcAta = await getOrCreateAssociatedTokenAccount(this.connection, this.wallet, mint, this.wallet.publicKey);
    const dstAta = await getOrCreateAssociatedTokenAccount(this.connection, this.wallet, mint, dest);

    const sig = await transfer(this.connection, this.wallet, srcAta.address, dstAta.address, this.wallet.publicKey, Number(amount));
    this.logger.log(`SPL transfer sig=${sig}`);
    return { signature: sig, success: true };
  }

  getAddress(): string {
    return this.wallet.publicKey.toBase58();
  }

  async getBalanceSol(): Promise<number> {
    const bal = await this.connection.getBalance(this.wallet.publicKey);
    return bal / LAMPORTS_PER_SOL;
  }
}
