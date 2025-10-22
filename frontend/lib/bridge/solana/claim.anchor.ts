// lib/bridge/solana/claim.anchor.ts
"use client";

import { SystemProgram, ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { getAnchorProvider, getBridgeProgram, BN } from "./anchor-program";
import {
  ARCIUM_PROGRAM_ID,
  ARCIUM_MXE,
  ARCIUM_MEMPOOL,
  ARCIUM_EXECPOOL,
  ARCIUM_POOL,
  ARCIUM_CLOCK,
  COMPDEF_RESEAL,
  SIGN_SEED,
  ARCIUM_CLUSTER_OFFSET,
  BRIDGE_PROGRAM_ID,
  ARCIUM_CLUSTER,
} from "./env";

// Polyfill Buffer (browser)
import { Buffer } from "buffer";
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

const pda = (seeds: Buffer[], program: PublicKey) =>
  PublicKey.findProgramAddressSync(seeds as any, program)[0];

const u64LE = (n: bigint) => {
  const out = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return Buffer.from(out);
};

const deriveConfigPda  = (bridge: PublicKey) => pda([Buffer.from("config")], bridge);
const deriveRequestPda = (bridge: PublicKey, owner: PublicKey, reqId: bigint) =>
  pda([Buffer.from("request"), owner.toBuffer(), u64LE(reqId)], bridge);
const deriveSignPda    = (bridge: PublicKey) => pda([Buffer.from(SIGN_SEED)], bridge);
const deriveBondPda    = (bridge: PublicKey, reqId: bigint) =>
  pda([Buffer.from("bond"), u64LE(reqId)], bridge);
const deriveComputation= (arcium: PublicKey, offset: bigint) =>
  pda([Buffer.from("computation"), u64LE(offset)], arcium);

export async function claimBridgeAnchor(params: {
  requestId: bigint;
  requestOwner: string;   // base58
  solverX25519: Uint8Array; // 32 bytes
  simulateFirst?: boolean;
}) {
  if (params.solverX25519.length !== 32) throw new Error("solverX25519 debe tener 32 bytes");

  const provider = getAnchorProvider("confirmed");
  const program  = getBridgeProgram({ provider }); // usa helper robusto

  const payer    = provider.wallet.publicKey;
  const ownerPk  = new PublicKey(params.requestOwner);

  const bridgePk = BRIDGE_PROGRAM_ID;
  const arciumPk = ARCIUM_PROGRAM_ID;

  const config   = deriveConfigPda(bridgePk);
  const request  = deriveRequestPda(bridgePk, ownerPk, params.requestId);
  const bond     = deriveBondPda(bridgePk, params.requestId);
  const signPda  = deriveSignPda(bridgePk);

  const mxe      = ARCIUM_MXE;
  const mempool  = ARCIUM_MEMPOOL;
  const execpool = ARCIUM_EXECPOOL;
  const pool     = ARCIUM_POOL;
  const clock    = ARCIUM_CLOCK;
  const compDef  = COMPDEF_RESEAL;
  const comp     = deriveComputation(arciumPk, BigInt(ARCIUM_CLUSTER_OFFSET));
  const cluster  = ARCIUM_CLUSTER;

  const method = program.methods
    .claimBridge(
      new BN(ARCIUM_CLUSTER_OFFSET),
      new BN(params.requestId.toString()),
      Buffer.from(params.solverX25519)
    )
    .accounts({
      payer,
      // Bridge
      config,
      request,
      requestOwner: ownerPk,
      bondVault: bond,
      signPda,

      // Arcium reseal
      mxe,
      mempool,
      execpool,
      computation: comp,
      compDef,
      cluster,
      pool,
      clock,

      arciumProgram: arciumPk,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })]);

  if (params.simulateFirst !== false) {
    await method.simulate().catch((e: any) => {
      throw new Error(e?.error?.errorMessage ?? e?.message ?? String(e));
    });
  }

  const sig = await method.rpc();
  return { sig, offset: String(ARCIUM_CLUSTER_OFFSET) };
}
