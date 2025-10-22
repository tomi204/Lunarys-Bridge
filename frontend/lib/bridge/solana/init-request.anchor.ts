// lib/bridge/solana/init-request.anchor.ts
"use client";

import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { sha256 } from "@noble/hashes/sha256";
import { Buffer } from "buffer";

import { getAnchorProvider, getBridgeProgram, BN } from "./anchor-program";
import {
  ARCIUM_PROGRAM_ID,
  ARCIUM_MXE,
  ARCIUM_MEMPOOL,
  ARCIUM_EXECPOOL,
  ARCIUM_POOL,
  ARCIUM_CLOCK,
  COMPDEF_PLAN_PAYOUT,
  SIGN_SEED,
  ARCIUM_CLUSTER_OFFSET,
  BRIDGE_PROGRAM_ID,
  ARCIUM_CLUSTER,
} from "./env";

// Polyfill Buffer (browser)
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

/* ---------------- utils / PDAs ---------------- */

const pda = (seeds: Buffer[], program: PublicKey) =>
  PublicKey.findProgramAddressSync(seeds as any, program)[0];

const u64LE = (n: bigint) => {
  const out = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return Buffer.from(out);
};

const deriveConfigPda  = (bridge: PublicKey) => pda([Buffer.from("config")], bridge);
const deriveRequestPda = (bridge: PublicKey, owner: PublicKey, reqId: bigint) =>
  pda([Buffer.from("request"), owner.toBuffer(), u64LE(reqId)], bridge);
const deriveSignPda    = (bridge: PublicKey) => pda([Buffer.from(SIGN_SEED)], bridge);
const deriveComputation= (arcium: PublicKey, offset: bigint) =>
  pda([Buffer.from("computation"), u64LE(offset)], arcium);

const rand = (n: number) => {
  const a = new Uint8Array(n);
  (crypto as any).getRandomValues?.(a) ?? a.forEach((_, i) => (a[i] = (Math.random() * 256) | 0));
  return a;
};

const makeDummyCtsFromEth = (addr: string) => {
  const h = addr.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(h)) throw new Error("Dirección EVM inválida (0x + 40 hex)");
  const raw = new Uint8Array(h.length / 2);
  for (let i = 0; i < raw.length; i++) raw[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  const buf32 = new Uint8Array(32); buf32.set(raw, 12);
  const tag = (s: string) => Buffer.from(sha256(Buffer.concat([new TextEncoder().encode(s), buf32])));
  return { ct0: tag("ct0:"), ct1: tag("ct1:"), ct2: tag("ct2:"), ct3: tag("ct3:") };
};

/* ---------------- API principal ---------------- */

/**
 * Dispara la ix Anchor `initiate_bridge` para SPL tokens.
 * Requiere:
 * - NEXT_PUBLIC_SPL_MINT (mint SPL a bloquear)
 * - variables de Arcium/Bridge en .env
 */
export async function initRequestWithEthAnchor(params: {
  ownerBase58: string;     // debe ser igual a la PK conectada (payer)
  requestId: bigint;       // u64
  splMint: string;         // mint SPL (NEXT_PUBLIC_SPL_MINT)
  ethRecipient: string;    // 0x...
  amountLocked?: bigint;   // unidades base del SPL (p.ej. USDC 6d = 10 USDC -> 10_000_000n)
  simulateFirst?: boolean; // default true
}) {
  const provider = getAnchorProvider("confirmed");
  const program  = getBridgeProgram({ provider });

  const feePayer = provider.wallet.publicKey;
  const owner    = new PublicKey(params.ownerBase58);
  if (!feePayer.equals(owner)) {
    throw new Error("El payer conectado debe ser igual a ownerBase58");
  }

  // PDAs / cuentas fijas
  const bridgePk = BRIDGE_PROGRAM_ID;
  const arciumPk = ARCIUM_PROGRAM_ID;

  const mint     = new PublicKey(params.splMint);
  const config   = deriveConfigPda(bridgePk);
  const request  = deriveRequestPda(bridgePk, owner, params.requestId);
  const signPda  = deriveSignPda(bridgePk);

  const mxe      = ARCIUM_MXE;
  const mempool  = ARCIUM_MEMPOOL;
  const execpool = ARCIUM_EXECPOOL;
  const pool     = ARCIUM_POOL;
  const clock    = ARCIUM_CLOCK;
  const compDef  = COMPDEF_PLAN_PAYOUT;
  const comp     = deriveComputation(arciumPk, BigInt(ARCIUM_CLUSTER_OFFSET));
  const cluster  = ARCIUM_CLUSTER;

  // ATAs
  const userAta   = getAssociatedTokenAddressSync(
    mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const escrowAta = getAssociatedTokenAddressSync(
    mint, signPda, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Crear ATAs si faltan
  const pre: TransactionInstruction[] = [];
  const conn = provider.connection;
  if (!(await conn.getAccountInfo(userAta))) {
    pre.push(createAssociatedTokenAccountInstruction(
      feePayer, userAta, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    ));
  }
  if (!(await conn.getAccountInfo(escrowAta))) {
    pre.push(createAssociatedTokenAccountInstruction(
      feePayer, escrowAta, signPda, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    ));
  }
  pre.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));

  // Payload (dummy)
  const clientPub = rand(32);
  const nonce     = rand(16);
  const { ct0, ct1, ct2, ct3 } = makeDummyCtsFromEth(params.ethRecipient);

  const offsetBN = new BN(ARCIUM_CLUSTER_OFFSET);
  const reqIdBN  = new BN(params.requestId.toString());
  const amountBN = new BN((params.amountLocked ?? 0n).toString());

  // 🚀 Llamada Anchor — ciphertexts como **4 argumentos separados**
  const method = program.methods
    .initiateBridge(
      offsetBN,                 // u64 offset
      reqIdBN,                  // u64 request_id
      Buffer.from(clientPub),   // [32] client_pub
      Buffer.from(nonce),       // [16] nonce
      Buffer.from(ct0),         // [32] ct0
      Buffer.from(ct1),         // [32] ct1
      Buffer.from(ct2),         // [32] ct2
      Buffer.from(ct3),         // [32] ct3
      amountBN                  // u64 amount
    )
    .accounts({
      // SPL
      signer: feePayer,
      userAta,
      mint,
      escrowAta,
      tokenProgram: TOKEN_PROGRAM_ID,

      // Bridge
      config,
      request,
      signPda,

      // Arcium
      mxe,
      mempool,
      execpool,
      computation: comp,
      compDef,
      cluster,
      pool,
      clock,

      // Programas
      systemProgram: SystemProgram.programId,
      arciumProgram: arciumPk,
    })
    .preInstructions(pre);

  if (params.simulateFirst !== false) {
    await method.simulate().catch((e: any) => {
      throw new Error(e?.error?.errorMessage ?? e?.message ?? String(e));
    });
  }

  const sig = await method.rpc();
  return { created: true, requestPda: request.toBase58(), sig, ethParts: undefined as any };
}
