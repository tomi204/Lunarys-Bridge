// lib/bridge/solana/init-request.ts
"use client";

import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import { ethAddressTo4U64, encode4U64LE, u64LE } from "./evm";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const SOLANA_PROGRAM_ID_STR = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID;
if (!SOLANA_PROGRAM_ID_STR) throw new Error("Falta NEXT_PUBLIC_SOLANA_PROGRAM_ID");
const BRIDGE_PROGRAM_ID = new PublicKey(SOLANA_PROGRAM_ID_STR);

// --- utils
const ixDisc = (name: string) =>
  Buffer.from(sha256(new TextEncoder().encode(`global:${name}`)).slice(0, 8));

const i64LE = (n: bigint) => {
  const MOD = 1n << 64n;
  const val = (n % MOD + MOD) % MOD;
  return u64LE(val);
};

const optPubkey = (pk?: PublicKey | null) =>
  pk ? Buffer.concat([Buffer.from([1]), pk.toBuffer()]) : Buffer.from([0]);

const optI64 = (v?: bigint | number | null) =>
  v === null || v === undefined
    ? Buffer.from([0])
    : Buffer.concat([Buffer.from([1]), i64LE(BigInt(v))]);

// --- PDA
const requestPda = (owner: PublicKey, requestId: bigint) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("request"), owner.toBuffer(), u64LE(requestId)],
    BRIDGE_PROGRAM_ID
  )[0];

export type SolanaWalletLike = {
  publicKey: PublicKey | { toString(): string; toBase58?: () => string };
  signAndSendTransaction: (tx: Transaction | VersionedTransaction) => Promise<{ signature: string } | string>;
};

export type InitRequestParams = {
  requestId: bigint;
  ownerBase58: string;
  ethRecipient: string;       // "0x..."
  endian?: "be" | "le";       // default "be"
  tokenMint?: string;         // WSOL por default
  amountLocked?: bigint;      // 0n ok para dev
  feeLocked?: bigint;         // 0n ok para dev
  solver?: string | null;     // optional
  claimDeadline?: bigint | number | null; // optional
  simulateFirst?: boolean;    // default true
};

export async function initRequestWithEth(wallet: SolanaWalletLike, p: InitRequestParams) {
  const conn = new Connection(RPC_URL, "confirmed");

  const owner = new PublicKey(p.ownerBase58);
  const reqPda = requestPda(owner, p.requestId);

  // Si ya existe, devolvemos "ya estaba"
  const info = await conn.getAccountInfo(reqPda, "confirmed");
  if (info) {
    return { created: false, requestPda: reqPda.toBase58() };
  }

  // 0x… → 4×u64 → bytes LE
  const parts = ethAddressTo4U64(p.ethRecipient, p.endian ?? "be");
  const partsBytes = encode4U64LE(parts);

  const tokenMint = new PublicKey(p.tokenMint ?? "So11111111111111111111111111111111111111112"); // WSOL
  const amountLocked = p.amountLocked ?? 0n;
  const feeLocked = p.feeLocked ?? 0n;
  const solverPk = p.solver ? new PublicKey(p.solver) : undefined;
  const claimDeadline = p.claimDeadline ?? null;

  // ⚠️ DATA LAYOUT (ajustá si tu on-chain difiere):
  // 8b disc + request_id(u64) + token_mint(32) + amount(u64) + fee(u64)
  // + solver(Option<Pubkey>) + claim_deadline(Option<i64>) + eth_addr_4*u64
  const data = Buffer.concat([
    ixDisc("init_request"),
    u64LE(p.requestId),
    tokenMint.toBuffer(),
    u64LE(amountLocked),
    u64LE(feeLocked),
    optPubkey(solverPk),
    optI64(claimDeadline === null ? null : BigInt(claimDeadline)),
    partsBytes,
  ]);

  // payer = owner (si tus seeds lo piden; si no, podés quitar esta validación)
  const payerStr =
    (wallet.publicKey as any)?.toBase58?.() ?? String((wallet.publicKey as any).toString());
  const feePayer = new PublicKey(payerStr);
  if (feePayer.toBase58() !== p.ownerBase58) {
    throw new Error("El payer conectado DEBE ser igual a ownerBase58 para que las seeds coincidan");
  }

  const keys = [
    { pubkey: feePayer, isSigner: true, isWritable: true },
    { pubkey: reqPda,   isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  // Tx + simulación (web3.js v2)
  const bh = await conn.getLatestBlockhash("processed");
  const tx = new Transaction({
    feePayer,
    blockhash: bh.blockhash,
    lastValidBlockHeight: bh.lastValidBlockHeight,
  }).add(new TransactionInstruction({ programId: BRIDGE_PROGRAM_ID, keys, data }));

  if (p.simulateFirst !== false) {
    tx.instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
    const msgV0 = new TransactionMessage({
      payerKey: feePayer,
      recentBlockhash: bh.blockhash,
      instructions: tx.instructions,
    }).compileToV0Message();
    const vtx = new VersionedTransaction(msgV0);
    const sim = await conn.simulateTransaction(vtx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "processed",
    });
    if (sim.value.err) {
      const logs = sim.value.logs ?? [];
      console.group("[init_request] Simulation failed");
      console.log("err:", sim.value.err);
      console.log(logs.join("\n"));
      console.groupEnd();
      throw new Error(`init_request failed: ${JSON.stringify(sim.value.err)}`);
    }
  }

  const bh2 = await conn.getLatestBlockhash("processed");
  tx.recentBlockhash = bh2.blockhash;
  (tx as any).lastValidBlockHeight = bh2.lastValidBlockHeight;

  const sent = await wallet.signAndSendTransaction(tx);
  const signature = typeof sent === "string" ? sent : sent.signature;

  await conn.confirmTransaction(
    { signature, blockhash: bh2.blockhash, lastValidBlockHeight: bh2.lastValidBlockHeight },
    "confirmed"
  );

  return { created: true, requestPda: reqPda.toBase58(), sig: signature, ethParts: parts };
}
