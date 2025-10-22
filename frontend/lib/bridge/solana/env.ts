// lib/bridge/solana/env.ts
"use client";
import { PublicKey } from "@solana/web3.js";

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

// --- Bridge (TU programa) ---
const SOLANA_PROGRAM_ID_STR = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID;
if (!SOLANA_PROGRAM_ID_STR) {
  throw new Error("Falta NEXT_PUBLIC_SOLANA_PROGRAM_ID en .env.local");
}
export const BRIDGE_PROGRAM_ID = new PublicKey(SOLANA_PROGRAM_ID_STR);

// --- Arcium program id ---
const ARCIUM_PROGRAM_ID_STR = process.env.NEXT_PUBLIC_ARCIUM_PROGRAM_ID;
if (!ARCIUM_PROGRAM_ID_STR) {
  throw new Error("Falta NEXT_PUBLIC_ARCIUM_PROGRAM_ID en .env.local");
}
export const ARCIUM_PROGRAM_ID = new PublicKey(ARCIUM_PROGRAM_ID_STR);

// --- CompDefs Arcium ---
const COMPDEF_PLAN_PAYOUT_STR = process.env.NEXT_PUBLIC_ARCIUM_COMPDEF_PLAN_PAYOUT_PDA;
if (!COMPDEF_PLAN_PAYOUT_STR) throw new Error("Falta NEXT_PUBLIC_ARCIUM_COMPDEF_PLAN_PAYOUT_PDA");
export const COMPDEF_PLAN_PAYOUT = new PublicKey(COMPDEF_PLAN_PAYOUT_STR);

const COMPDEF_RESEAL_STR = process.env.NEXT_PUBLIC_ARCIUM_COMPDEF_RESEAL_PDA;
if (!COMPDEF_RESEAL_STR) throw new Error("Falta NEXT_PUBLIC_ARCIUM_COMPDEF_RESEAL_PDA");
export const COMPDEF_RESEAL = new PublicKey(COMPDEF_RESEAL_STR);

// --- Cuentas fijas Arcium ---
const ARCIUM_MXE_STR = process.env.NEXT_PUBLIC_ARCIUM_MXE;
const ARCIUM_POOL_STR = process.env.NEXT_PUBLIC_ARCIUM_POOL;
const ARCIUM_CLOCK_STR = process.env.NEXT_PUBLIC_ARCIUM_CLOCK;
const ARCIUM_MEMPOOL_STR = process.env.NEXT_PUBLIC_ARCIUM_MEMPOOL;
const ARCIUM_EXECPOOL_STR = process.env.NEXT_PUBLIC_ARCIUM_EXECPOOL;

if (!ARCIUM_MXE_STR || !ARCIUM_POOL_STR || !ARCIUM_CLOCK_STR || !ARCIUM_MEMPOOL_STR || !ARCIUM_EXECPOOL_STR) {
  throw new Error("Faltan cuentas fijas de Arcium (MXE/POOL/CLOCK/MEMPOOL/EXECPOOL) en .env.local");
}

export const ARCIUM_MXE      = new PublicKey(ARCIUM_MXE_STR);
export const ARCIUM_POOL     = new PublicKey(ARCIUM_POOL_STR);
export const ARCIUM_CLOCK    = new PublicKey(ARCIUM_CLOCK_STR);
export const ARCIUM_MEMPOOL  = new PublicKey(ARCIUM_MEMPOOL_STR);
export const ARCIUM_EXECPOOL = new PublicKey(ARCIUM_EXECPOOL_STR);

// --- Cluster (lo tenés en .env) ---
const ARCIUM_CLUSTER_STR = process.env.NEXT_PUBLIC_ARCIUM_CLUSTER;
if (!ARCIUM_CLUSTER_STR) throw new Error("Falta NEXT_PUBLIC_ARCIUM_CLUSTER en .env.local");
export const ARCIUM_CLUSTER = new PublicKey(ARCIUM_CLUSTER_STR);

// --- extras ---
export const SIGN_SEED = (process.env.NEXT_PUBLIC_SIGN_SEED ?? "SignerAccount").trim();
export const ARCIUM_CLUSTER_OFFSET = Number(
  process.env.NEXT_PUBLIC_ARCIUM_CLUSTER_OFFSET ??
  process.env.ARCIUM_CLUSTER_OFFSET ??
  "1078779259"
);
