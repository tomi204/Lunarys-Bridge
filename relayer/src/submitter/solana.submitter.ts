// src/submitter/solana.submitter.ts
import { Injectable } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import type { Hex } from 'viem';
import { Submitter } from './types';
import { pinoLogger as logger } from 'src/common/logger';
import {
  buildReleaseSplIx,
  deriveSignPda,
  pubkeyFromBytes32,
} from './solana.contracts';
import {
  parseTokenMapFromEnv,
  type TokenMapEntry,
} from 'src/config/config.schema';

/** Load payer from env:
 *  - SOLANA_PAYER_SECRET may be a base58 secret string or a JSON array of numbers.
 */
function loadPayerFromEnv(): Keypair | null {
  const raw = (process.env.SOLANA_PAYER_SECRET || '').trim();
  if (!raw) return null;

  try {
    if (raw.startsWith('[')) {
      const arr = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    const sk = bs58.decode(raw);
    return Keypair.fromSecretKey(sk);
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'Failed to parse SOLANA_PAYER_SECRET');
    return null;
  }
}

function findTokenMapping(map: TokenMapEntry[], origin: Hex): Extract<TokenMapEntry, {type: 'spl'}> | null {
  const hit = map.find(t => t.type === 'spl' && t.origin.toLowerCase() === origin.toLowerCase());
  return (hit ?? null) as any;
}

function toU64AmountOrThrow(v: bigint): bigint {
  // On-chain handler expects u64. Guard here.
  if (v < 0n || v > 0xFFFF_FFFF_FFFF_FFFFn) {
    throw new Error(`amount does not fit into u64: ${v.toString()}`);
  }
  return v;
}

/**
 * Solana submitter adapted to your Anchor program:
 * - Direction 2 (EVM -> SOL) only.
 * - Builds and sends `release_spl` with the exact accounts your program expects.
 * - Uses TOKEN_MAP_JSON to resolve which SPL mint/escrow to release from.
 */
@Injectable()
export class SolanaSubmitter implements Submitter {
  async submit(input: { msgId: Hex; m: any; sig: { v: number; r: Hex; s: Hex } }): Promise<string | null> {
    // Only submit for EVM -> SOL
    if (Number(input.m.dir) !== 2) return null;

    const RPC = (process.env.SOLANA_RPC_HTTP || '').trim();
    const PROGRAM_ID_STR = (process.env.SOLANA_PROGRAM_ID || '').trim();
    const payer = loadPayerFromEnv();

    // Required runtime config
    const ARCIUM_PROGRAM_ID_STR = (process.env.ARCIUM_PROGRAM_ID || '').trim();
    const COMP_DEF_ACCOUNT_STR  = (process.env.SOLANA_COMP_DEF_ACCOUNT || '').trim();
    const SIGN_PDA_OVERRIDE     = (process.env.SOLANA_SIGN_PDA || '').trim() || undefined;

    const tokenMap = parseTokenMapFromEnv(process.env.TOKEN_MAP_JSON);

    if (!RPC || !PROGRAM_ID_STR || !payer || !ARCIUM_PROGRAM_ID_STR || !COMP_DEF_ACCOUNT_STR || tokenMap.length === 0) {
      logger.warn('Solana submit skipped: please set SOLANA_RPC_HTTP, SOLANA_PROGRAM_ID, SOLANA_PAYER_SECRET, ARCIUM_PROGRAM_ID, SOLANA_COMP_DEF_ACCOUNT and TOKEN_MAP_JSON.');
      return null;
    }

    // Resolve token mapping for this originToken (bytes32)
    const mapping = findTokenMapping(tokenMap, input.m.originToken as Hex);
    if (!mapping) {
      logger.warn({ originToken: input.m.originToken }, 'No SPL mapping found for originToken; skipping');
      return null;
    }

    const conn        = new Connection(RPC, { commitment: 'confirmed' });
    const programId   = new PublicKey(PROGRAM_ID_STR);
    const arciumId    = new PublicKey(ARCIUM_PROGRAM_ID_STR);
    const compDefPk   = new PublicKey(COMP_DEF_ACCOUNT_STR);
    const mintPk      = new PublicKey(mapping.mint);
    const escrowPk    = new PublicKey(mapping.escrow);
    const recipientPk = pubkeyFromBytes32(input.m.recipient as Hex);

    // Resolve Sign PDA (your program uses seed "sign"). If not given, derive it.
    const signPdaPk = SIGN_PDA_OVERRIDE ? new PublicKey(SIGN_PDA_OVERRIDE)
                                        : deriveSignPda(programId)[0];

    // Amount guard (u64)
    const amount = toU64AmountOrThrow(BigInt(input.m.amount));

    // Build release_spl ix (program will init ATA if needed)
    const { ix } = buildReleaseSplIx({
      programId,
      payer: payer.publicKey,
      mint: mintPk,
      escrowToken: escrowPk,
      recipient: recipientPk,
      compDefAccount: compDefPk,
      arciumProgramId: arciumId,
      signPda: signPdaPk,
      amount,
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = payer.publicKey;

    logger.info(
      {
        programId: PROGRAM_ID_STR,
        payer: payer.publicKey.toBase58(),
        msgId: input.msgId,
        mint: mapping.mint,
        escrow: mapping.escrow,
      },
      'Submitting release_spl'
    );

    const signature = await sendAndConfirmTransaction(conn, tx, [payer], {
      commitment: 'confirmed',
    });

    logger.info({ signature, msgId: input.msgId }, 'release_spl sent');
    return signature; // base58 tx signature
  }
}
