// src/submitter/solana.contracts.ts
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { Hex } from 'viem';
import crypto from 'node:crypto';

// Anchor discriminator = sha256("global:<name>").slice(0, 8)
function discriminator(name: string): Buffer {
  const h = crypto.createHash('sha256').update(`global:${name}`).digest();
  return h.subarray(0, 8);
}

// Little-endian u64
export function u64le(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

// Convert bytes32 (as Hex) into a Solana PublicKey (32 bytes)
export function pubkeyFromBytes32(x: Hex): PublicKey {
  const bytes = Buffer.from(x.replace(/^0x/, ''), 'hex');
  if (bytes.length !== 32) throw new Error('recipient bytes32 must be exactly 32 bytes');
  return new PublicKey(bytes);
}

// Derive the PDA signer with seed "sign" (used by your program)
export function deriveSignPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('sign')], programId);
}

/**
 * Build the `release_spl` instruction of your Anchor program.
 * Accounts order exactly matches the ReleaseSpl<'info> struct you shared.
 */
export function buildReleaseSplIx(params: {
  programId: PublicKey;          // your program ID
  payer: PublicKey;              // fee payer
  mint: PublicKey;               // USDC/EUROC mint
  escrowToken: PublicKey;        // vault (owner = sign PDA)
  recipient: PublicKey;          // owner of the ATA
  compDefAccount: PublicKey;     // comp_def PDA address (plan_payout)
  arciumProgramId: PublicKey;    // Arcium program ID
  signPda: PublicKey;            // SignerAccount PDA (holds bump)
  amount: bigint;                // amount in token base units
}): { ix: TransactionInstruction; recipientAta: PublicKey } {
  const {
    programId, payer, mint, escrowToken, recipient,
    compDefAccount, arciumProgramId, signPda, amount
  } = params;

  const recipientAta = getAssociatedTokenAddressSync(mint, recipient);

  const keys = [
    { pubkey: payer,            isSigner: true,  isWritable: true  }, // payer
    { pubkey: mint,             isSigner: false, isWritable: false }, // mint
    { pubkey: escrowToken,      isSigner: false, isWritable: true  }, // escrow_token (mut)
    { pubkey: recipientAta,     isSigner: false, isWritable: true  }, // recipient_token (init_if_needed)
    { pubkey: recipient,        isSigner: false, isWritable: false }, // recipient (authority of ATA)
    { pubkey: compDefAccount,   isSigner: false, isWritable: false }, // comp_def_account
    { pubkey: arciumProgramId,  isSigner: false, isWritable: false }, // arcium_program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },     // system_program
    { pubkey: signPda,          isSigner: false, isWritable: true  }, // sign_pda_account (mut)
  ];

  const data = Buffer.concat([discriminator('release_spl'), u64le(amount)]);
  return { ix: new TransactionInstruction({ programId, keys, data }), recipientAta };
}
