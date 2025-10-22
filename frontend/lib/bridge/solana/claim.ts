// lib/bridge/solana/claim.ts
// -----------------------------------------------------------------------------
// Front-safe utils para claimear en tu Bridge (Solana) usando Arcium.
// - Lee TODO via process.env.NEXT_PUBLIC_* (ACCESO ESTÁTICO → Next lo inyecta)
// - Offset fijo (no random) → cluster/computation coherentes
// - Simulación (web3.js v2) con logs y decoder de errores Anchor
// -----------------------------------------------------------------------------

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
import { getClusterAccAddress } from "@arcium-hq/client";

// Polyfill Buffer (browser)
import { Buffer } from "buffer";
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

// ===== ENV (acceso estático) =================================================

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

const SOLANA_PROGRAM_ID_STR = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID;
const ARCIUM_PROGRAM_ID_STR = process.env.NEXT_PUBLIC_ARCIUM_PROGRAM_ID;

const COMP_DEF_RESEAL_STR = process.env.NEXT_PUBLIC_ARCIUM_COMPDEF_RESEAL_PDA;

const ARCIUM_MXE_STR = process.env.NEXT_PUBLIC_ARCIUM_MXE;
const ARCIUM_POOL_STR = process.env.NEXT_PUBLIC_ARCIUM_POOL;
const ARCIUM_CLOCK_STR = process.env.NEXT_PUBLIC_ARCIUM_CLOCK;
const ARCIUM_MEMPOOL_STR = process.env.NEXT_PUBLIC_ARCIUM_MEMPOOL;
const ARCIUM_EXECPOOL_STR = process.env.NEXT_PUBLIC_ARCIUM_EXECPOOL;

const SIGN_SEED =
  process.env.NEXT_PUBLIC_SIGN_SEED?.trim() || "SignerAccount";

const ARCIUM_CLUSTER_OFFSET = Number(
  process.env.NEXT_PUBLIC_ARCIUM_CLUSTER_OFFSET ??
    process.env.ARCIUM_CLUSTER_OFFSET ??
    "1078779259"
);

// Derivamos el cluster una vez desde el offset fijo (coherente con Arcium)
const CLUSTER_PK = getClusterAccAddress(
  Number.isFinite(ARCIUM_CLUSTER_OFFSET) ? ARCIUM_CLUSTER_OFFSET : 1078779259
);

// ===== Utils =================================================================

function resolvePk(label: string, v?: string) {
  if (!v || v.trim().length === 0) {
    throw new Error(
      `Falta ${label}. Revisá tu .env.local (NEXT_PUBLIC_*) y reiniciá el dev server`
    );
  }
  return new PublicKey(v);
}

const u64LE = (n: bigint) => {
  const out = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return Buffer.from(out);
};

const ixDisc = (name: string) =>
  Buffer.from(sha256(new TextEncoder().encode(`global:${name}`)).slice(0, 8));

const pda = (seeds: Buffer[], program: PublicKey) =>
  PublicKey.findProgramAddressSync(seeds as any, program)[0];

function deriveBridgeConfigPda(programId: PublicKey) {
  // si tu IDL usa otro seed para config, cámbialo acá
  return pda([Buffer.from("config")], programId);
}

function deriveBridgeSignPda(programId: PublicKey) {
  return pda([Buffer.from(SIGN_SEED)], programId);
}

function deriveRequestPda(
  programId: PublicKey,
  owner: PublicKey,
  requestId: bigint
) {
  return pda(
    [Buffer.from("request"), owner.toBuffer(), u64LE(requestId)],
    programId
  );
}

function deriveBondVaultPda(programId: PublicKey, requestId: bigint) {
  return pda([Buffer.from("bond"), u64LE(requestId)], programId);
}

function deriveComputationPda(arciumProgramId: PublicKey, offset: bigint) {
  return pda([Buffer.from("computation"), u64LE(offset)], arciumProgramId);
}

// ---------- Simulación y decoder de errores (web3.js v2) ---------------------

function prettyAnchorError(err: unknown, logs: string[] = []) {
  // 1) Anchor suele loguear "AnchorError: ..." con el código y el nombre
  const anchorLine = logs.find((l) => l.includes("AnchorError"));
  if (anchorLine) return anchorLine;

  // 2) Mensaje genérico "custom program error: 0xNNN"
  const custom = logs.find((l) => l.includes("custom program error:"));
  if (custom) {
    const hex = custom.split("custom program error:")[1].trim();
    const code = parseInt(hex, 16);
    // En Anchor, custom errors suelen empezar en 6000 (0x1770)
    if (Number.isFinite(code)) {
      if (code >= 6000 && code < 8000) {
        const idx = code - 6000;
        return `Anchor custom error ${code} (0x${code.toString(
          16
        )}) — index ${idx} en tu enum ErrorCode (errors.rs).`;
      }
      return `Custom program error ${code} (0x${code.toString(16)})`;
    }
  }

  return `Simulation failed: ${JSON.stringify(err)}`;
}

async function simulateOrExplain(
  conn: Connection,
  tx: Transaction,
  label = "claim_bridge"
) {
  // Subimos compute (útil en devnet)
  tx.instructions.unshift(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })
  );

  // web3.js v2: simulamos con VersionedTransaction para poder pasar config
  const msgV0 = new TransactionMessage({
    payerKey: tx.feePayer!,
    recentBlockhash: tx.recentBlockhash!,
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
    console.group(`[${label}] Simulation failed`);
    console.log("err:", sim.value.err);
    console.log(logs.join("\n"));
    console.groupEnd();
    throw new Error(prettyAnchorError(sim.value.err, logs));
  }
}

// ===== Tipos =================================================================

export type SolanaWalletLike = {
  publicKey: PublicKey | { toString(): string; toBase58?: () => string };
  signAndSendTransaction: (
    tx: Transaction | VersionedTransaction
  ) => Promise<{ signature: string } | string>;
};

export type ClaimParams = {
  requestId: bigint; // id del request en tu bridge
  requestOwner: string; // base58 del owner del request
  solverX25519: Uint8Array; // 32 bytes (clave pública X25519 del solver)
  computationOffset?: bigint; // opcional: por defecto usa el offset fijo del cluster
  simulateFirst?: boolean; // default: true (conviene para ver logs si falla)
};

// ===== API principal ==========================================================

/**
 * Envía la ix `claim_bridge` de tu programa.
 * Requisitos:
 * - Wallet Solana conectada (fee-payer)
 * - Variables NEXT_PUBLIC_* completas en build
 * - requestId, requestOwner, solverX25519 válidos
 */
export async function claimBridgeWithWallet(
  wallet: SolanaWalletLike,
  params: ClaimParams
): Promise<{ sig: string; offset: string }> {
  // Validaciones iniciales
  if (!wallet?.publicKey) throw new Error("Solana wallet no conectada");
  if (params.solverX25519.length !== 32) {
    throw new Error("solverX25519 debe tener exactamente 32 bytes");
  }
  if (!Number.isFinite(ARCIUM_CLUSTER_OFFSET)) {
    throw new Error(
      "ARCIUM_CLUSTER_OFFSET inválido (definí NEXT_PUBLIC_ARCIUM_CLUSTER_OFFSET)"
    );
  }

  // Resolver claves públicas desde strings (runtime)
  const BRIDGE_PROGRAM_ID = resolvePk(
    "NEXT_PUBLIC_SOLANA_PROGRAM_ID",
    SOLANA_PROGRAM_ID_STR
  );
  const ARCIUM_PROGRAM_ID = resolvePk(
    "NEXT_PUBLIC_ARCIUM_PROGRAM_ID",
    ARCIUM_PROGRAM_ID_STR
  );
  const COMP_DEF_RESEAL = resolvePk(
    "NEXT_PUBLIC_ARCIUM_COMPDEF_RESEAL_PDA",
    COMP_DEF_RESEAL_STR
  );

  const ARCIUM_MXE = resolvePk("NEXT_PUBLIC_ARCIUM_MXE", ARCIUM_MXE_STR);
  const ARCIUM_POOL = resolvePk("NEXT_PUBLIC_ARCIUM_POOL", ARCIUM_POOL_STR);
  const ARCIUM_CLOCK = resolvePk("NEXT_PUBLIC_ARCIUM_CLOCK", ARCIUM_CLOCK_STR);
  const MEMPOOL = resolvePk("NEXT_PUBLIC_ARCIUM_MEMPOOL", ARCIUM_MEMPOOL_STR);
  const EXECPOOL = resolvePk("NEXT_PUBLIC_ARCIUM_EXECPOOL", ARCIUM_EXECPOOL_STR);

  // Normalizar payer (browser wallets)
  const payerStr =
    typeof (wallet.publicKey as any)?.toBase58 === "function"
      ? (wallet.publicKey as any).toBase58()
      : String((wallet.publicKey as any).toString());
  const feePayer = new PublicKey(payerStr);

  const requestOwner = new PublicKey(params.requestOwner);
  const offset = params.computationOffset ?? BigInt(ARCIUM_CLUSTER_OFFSET);

  const conn = new Connection(RPC_URL, "confirmed");

  // ===== Derivaciones PDAs
  const configPda = deriveBridgeConfigPda(BRIDGE_PROGRAM_ID);
  const requestPda = deriveRequestPda(
    BRIDGE_PROGRAM_ID,
    requestOwner,
    params.requestId
  );
  const bondVault = deriveBondVaultPda(BRIDGE_PROGRAM_ID, params.requestId);
  const signPda = deriveBridgeSignPda(BRIDGE_PROGRAM_ID);

  const computation = deriveComputationPda(ARCIUM_PROGRAM_ID, offset);
  const clusterPk = CLUSTER_PK; // derivado del offset fijo

  // ===== Data ix: 8b disc + offset + request_id + solver_x25519
  const data = Buffer.concat([
    ixDisc("claim_bridge"),
    u64LE(offset),
    u64LE(params.requestId),
    Buffer.from(params.solverX25519),
  ]);

  const keys = [
    // payer
    { pubkey: feePayer, isSigner: true, isWritable: true },

    // estado del bridge
    { pubkey: configPda, isSigner: false, isWritable: false },
    { pubkey: requestPda, isSigner: false, isWritable: true },
    { pubkey: requestOwner, isSigner: false, isWritable: false },
    { pubkey: bondVault, isSigner: false, isWritable: true },

    // Arcium (reseal)
    { pubkey: signPda, isSigner: false, isWritable: true },
    { pubkey: ARCIUM_MXE, isSigner: false, isWritable: false },
    { pubkey: MEMPOOL, isSigner: false, isWritable: true },
    { pubkey: EXECPOOL, isSigner: false, isWritable: true },
    { pubkey: computation, isSigner: false, isWritable: true },
    { pubkey: COMP_DEF_RESEAL, isSigner: false, isWritable: false },
    { pubkey: clusterPk, isSigner: false, isWritable: true },
    { pubkey: ARCIUM_POOL, isSigner: false, isWritable: true },
    { pubkey: ARCIUM_CLOCK, isSigner: false, isWritable: false },
    { pubkey: ARCIUM_PROGRAM_ID, isSigner: false, isWritable: false },

    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  // ===== Blockhash inicial
  const bh1 = await conn.getLatestBlockhash("processed");

  // Armamos tx legacy (más compatible con wallets), con compute budget al simular
  const tx = new Transaction({
    feePayer,
    blockhash: bh1.blockhash,
    lastValidBlockHeight: bh1.lastValidBlockHeight,
  }).add(
    new TransactionInstruction({
      programId: BRIDGE_PROGRAM_ID,
      keys,
      data,
    })
  );

  // Simular primero (default true). Si falla, abortamos y mostramos logs.
  if (params.simulateFirst !== false) {
    await simulateOrExplain(conn, tx, "claim_bridge");
  }

  // Refrescamos blockhash (por si expiró durante la simulación)
  const bh2 = await conn.getLatestBlockhash("processed");
  tx.recentBlockhash = bh2.blockhash;
  (tx as any).lastValidBlockHeight = bh2.lastValidBlockHeight;

  // Enviamos (tu wallet wrapper debe soportar Transaction o VersionedTransaction)
  const sent = await wallet.signAndSendTransaction(tx);
  const signature = typeof sent === "string" ? sent : sent.signature;

  await conn.confirmTransaction(
    { signature, blockhash: bh2.blockhash, lastValidBlockHeight: bh2.lastValidBlockHeight },
    "confirmed"
  );

  return { sig: signature, offset: offset.toString() };
}

// ===== helper opcional para debug ============================================

export function dumpArciumEnv() {
  return {
    RPC_URL,
    SOLANA_PROGRAM_ID_STR,
    ARCIUM_PROGRAM_ID_STR,
    COMP_DEF_RESEAL_STR,
    ARCIUM_MXE_STR,
    ARCIUM_POOL_STR,
    ARCIUM_CLOCK_STR,
    ARCIUM_MEMPOOL_STR,
    ARCIUM_EXECPOOL_STR,
    ARCIUM_CLUSTER_OFFSET,
    CLUSTER: CLUSTER_PK.toBase58(),
    SIGN_SEED,
  };
}
