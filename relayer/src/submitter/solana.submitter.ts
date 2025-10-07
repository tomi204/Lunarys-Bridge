// src/submitter/solana.submitter.ts
import { Injectable } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import type { Hex } from 'viem';
import { Submitter } from './types';
import { encodeCanonical } from 'src/message/canonical';
import { pinoLogger as logger } from 'src/common/logger';

/** Small helpers */
function hexToBytes(h: string): Buffer {
  return Buffer.from(h.startsWith('0x') ? h.slice(2) : h, 'hex');
}

/** Load payer from env:
 *  - SOLANA_PAYER_SECRET can be base58 (common) or a JSON array of numbers.
 */
function loadPayerFromEnv(): Keypair | null {
  const raw = (process.env.SOLANA_PAYER_SECRET || '').trim();
  if (!raw) return null;

  try {
    if (raw.startsWith('[')) {
      const arr = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    // assume base58 secret string
    const sk = bs58.decode(raw);
    return Keypair.fromSecretKey(sk);
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'Failed to parse SOLANA_PAYER_SECRET');
    return null;
  }
}

/**
 * Sends the attested message to a Solana "executor" program.
 *
 * Returns the transaction signature (base58) if submitted, otherwise null.
 * - Only runs for EVM -> SOL direction (dir = 2).
 * - Requires:
 *    SOLANA_RPC_HTTP = https://... (Helius/QuickNode/etc.)
 *    SOLANA_EXECUTOR_PROGRAM_ID = <program id base58>
 *    SOLANA_PAYER_SECRET = <base58 secret key OR JSON secret array>
 *
 * NOTE: The `keys` and `data` layout MUST match your on-chain program.
 * Below we send a single instruction with data:
 *   [ msgId(32) | payload(bytes) | v(1) | r(32) | s(32) ]
 * Replace `keys` with the actual accounts your program expects.
 */
@Injectable()
export class SolanaSubmitter implements Submitter {
  async submit(input: { msgId: Hex; m: any; sig: { v: number; r: Hex; s: Hex } }): Promise<string | null> {
    // Only submit to Solana if direction is EVM -> SOL (dir = 2).
    if (Number(input.m.dir) !== 2) return null;

    const RPC = (process.env.SOLANA_RPC_HTTP || '').trim();
    const PROGRAM_ID_STR = (process.env.SOLANA_EXECUTOR_PROGRAM_ID || '').trim();
    const payer = loadPayerFromEnv();

    if (!RPC || !PROGRAM_ID_STR || !payer) {
      logger.warn(
        'Solana submit skipped: missing SOLANA_RPC_HTTP / SOLANA_EXECUTOR_PROGRAM_ID / SOLANA_PAYER_SECRET'
      );
      return null;
    }

    const conn = new Connection(RPC, { commitment: 'confirmed' });
    const programId = new PublicKey(PROGRAM_ID_STR);

    // --- Build instruction data to match your program's interface ---
    // msgId (bytes32)
    const msgIdBytes = hexToBytes(input.msgId);
    // canonical payload as bytes
    const payloadHex = encodeCanonical(input.m);
    const payloadBytes = hexToBytes(payloadHex);
    // attestation (v/r/s)
    const v = Buffer.from([input.sig.v & 0xff]);
    const r = hexToBytes(input.sig.r);
    const s = hexToBytes(input.sig.s);
    const data = Buffer.concat([msgIdBytes, payloadBytes, v, r, s]);

    // --- Accounts expected by your executor program ---
    // TODO: Replace with your real accounts (bridge state, vault, recipient, sysvars, etc.)
    const keys = [
      // Example placeholders (must be replaced):
      // { pubkey: new PublicKey('<bridge_state>'), isSigner: false, isWritable: true },
      // { pubkey: new PublicKey('<vault_account>'), isSigner: false, isWritable: true },
      // { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false }, // placeholder so the IX compiles
    ];

    const ix = new TransactionInstruction({ keys, programId, data });
    const tx = new Transaction().add(ix);
    tx.feePayer = payer.publicKey;

    logger.info(
      { programId: PROGRAM_ID_STR, payer: payer.publicKey.toBase58() },
      'Submitting bridge message to Solana executor'
    );

    // Send + confirm. For higher throughput you can sendRawTransaction and confirm later.
    const signature = await sendAndConfirmTransaction(conn, tx, [payer], {
      commitment: 'confirmed',
    });

    logger.info({ signature }, 'Solana executor tx sent');
    return signature; // base58 signature string
  }
}
