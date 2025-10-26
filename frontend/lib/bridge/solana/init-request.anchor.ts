"use client";

import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Connection,
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

const deriveConfigPda = (bridge: PublicKey) => pda([Buffer.from("config")], bridge);
const deriveRequestPda = (bridge: PublicKey, owner: PublicKey, reqId: bigint) =>
  pda([Buffer.from("request"), owner.toBuffer(), u64LE(reqId)], bridge);
const deriveSignPda = (bridge: PublicKey) => pda([Buffer.from(SIGN_SEED)], bridge);
const deriveComputation = (arcium: PublicKey, offset: bigint) =>
  pda([Buffer.from("computation"), u64LE(offset)], arcium);

// u64 aleatorio (para computationAccount)
const randU64 = () => {
  const a = new Uint32Array(2);
  (crypto as any).getRandomValues?.(a);
  return (BigInt(a[0]) << 32n) | BigInt(a[1]);
};

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
  const buf32 = new Uint8Array(32);
  buf32.set(raw, 12);
  const tag = (s: string) =>
    Buffer.from(sha256(Buffer.concat([new TextEncoder().encode(s), buf32])));
  return { ct0: tag("ct0:"), ct1: tag("ct1:"), ct2: tag("ct2:"), ct3: tag("ct3:") };
};

/* ---------------- helpers de validación ---------------- */

async function mustExistAndOwnedBy(
  conn: Connection,
  label: string,
  pubkey: PublicKey,
  ownerProgram: PublicKey
) {
  const info = await conn.getAccountInfo(pubkey);
  if (!info) throw new Error(`${label} (${pubkey.toBase58()}) no existe en la red`);
  if (!info.owner.equals(ownerProgram)) {
    throw new Error(
      `${label} (${pubkey.toBase58()}) no es del programa esperado (${ownerProgram.toBase58()})`
    );
  }
}

async function mustMint(conn: Connection, mint: PublicKey) {
  const info = await conn.getAccountInfo(mint);
  if (!info) throw new Error(`Mint (${mint.toBase58()}) no existe`);
  if (!info.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error(
      `Mint (${mint.toBase58()}) no es del TOKEN_PROGRAM_ID (${TOKEN_PROGRAM_ID.toBase58()})`
    );
  }
}

/* ---------------- API principal ---------------- */

/**
 * Llama a la ix Anchor `initiate_bridge` (SPL).
 * Espera `amountLocked` en base units (USDC devnet: 6 decimales → 1 USDC = 1_000_000n).
 */
export async function initRequestWithEthAnchor(params: {
  ownerBase58: string; // = payer conectado
  requestId: bigint; // u64
  splMint: string; // p.ej. USDC devnet
  ethRecipient: string; // 0x...
  amountLocked?: bigint; // base units (bigint)
  simulateFirst?: boolean; // default true
}) {
  // 1) Wallet -> Provider -> Program
  const anyWin = window as any;
  const wallet =
    anyWin?.solana ??
    anyWin?.phantom?.solana ??
    anyWin?.appkit?.solana ??
    anyWin?.appKit?.solana;

  if (!wallet) throw new Error("No se encontró wallet Solana (Phantom/AppKit).");
  if (!wallet.isConnected) await wallet.connect();

  const provider = getAnchorProvider(wallet);
  const program = getBridgeProgram(provider);

  const payer = provider.wallet.publicKey;
  const owner = new PublicKey(params.ownerBase58);
  if (!payer.equals(owner)) {
    throw new Error("El payer conectado debe ser igual a ownerBase58");
  }

  console.debug("[initiateBridge] wallet", {
    payer: payer.toBase58(),
    cluster: ARCIUM_CLUSTER ?? "(env ARCIUM_CLUSTER?)",
    rpc: (provider as any)?.connection?._rpcEndpoint ?? "(rpc?)",
  });

  // 2) PDAs / cuentas fijas
  const bridgePk = BRIDGE_PROGRAM_ID;
  const arciumPk = ARCIUM_PROGRAM_ID;

  const mint = new PublicKey(params.splMint);
  const config = deriveConfigPda(bridgePk);
  const requestPda = deriveRequestPda(bridgePk, owner, params.requestId);
  const signPdaAccount = deriveSignPda(bridgePk);

  const mxeAccount = ARCIUM_MXE;
  const mempoolAccount = ARCIUM_MEMPOOL;
  const executingPool = ARCIUM_EXECPOOL;
  const poolAccount = ARCIUM_POOL;
  const clockAccount = ARCIUM_CLOCK;
  const compDefAccount = COMPDEF_PLAN_PAYOUT;
  const clusterAccount = ARCIUM_CLUSTER;

  // Envs Arcium
  const ARCIUM_PROGRAM_ID = new PublicKey(require("NEXT_PUBLIC_ARCIUM_PROGRAM_ID"));
  const MXE = new PublicKey(require("NEXT_PUBLIC_ARCIUM_MXE"));
  const COMPDEF_PLAN = new PublicKey(require("NEXT_PUBLIC_ARCIUM_COMPDEF_PLAN_PAYOUT_PDA"));
  // offset por tx → computationAccount
  const offset = randU64();
  const computationAccount = computationPdaExact(MXE, COMPDEF_PLAN, offset, ARCIUM_PROGRAM_ID);

  function computationPdaExact(
    mxe: PublicKey,
    compDef: PublicKey,
    offset: bigint,
    arciumProgramId: PublicKey
  ): PublicKey {
    const seeds = [
      Buffer.from("computation_account"), // ← este prefijo
      mxe.toBuffer(),                     // ← MXE
      compDef.toBuffer(),                 // ← comp_def (plan_payout)
      u64LE(offset),                      // ← offset LE
    ];
    return PublicKey.findProgramAddressSync(seeds, arciumProgramId)[0];
  }
  // 3) ATAs (nombres exactos según IDL)
  const userToken = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const escrowToken = getAssociatedTokenAddressSync(
    mint,
    signPdaAccount,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.debug("[initiateBridge] SPL context", {
    splMint: mint.toBase58(),
    owner: owner.toBase58(),
    userToken: userToken.toBase58(),
    escrowToken: escrowToken.toBase58(),
  });

  // 4) Crear ATAs si faltan
  const pre: TransactionInstruction[] = [];
  const conn = provider.connection;
  if (!(await conn.getAccountInfo(userToken))) {
    console.debug("[initiateBridge] preIx: crear ATA userToken");
    pre.push(
      createAssociatedTokenAccountInstruction(
        payer,
        userToken,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }
  if (!(await conn.getAccountInfo(escrowToken))) {
    console.debug("[initiateBridge] preIx: crear ATA escrowToken");
    pre.push(
      createAssociatedTokenAccountInstruction(
        payer,
        escrowToken,
        signPdaAccount,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }
  pre.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));

  // 5) Payload (dummy)
  const clientPub = rand(32);
  const nonce = rand(16);
  const { ct0, ct1, ct2, ct3 } = makeDummyCtsFromEth(params.ethRecipient);

  const offsetBN = new BN(offset.toString());
  const reqIdBN = new BN(params.requestId.toString());
  const amountBN = new BN((params.amountLocked ?? 0n).toString());

  console.debug("[initiateBridge] amounts", {
    amountLocked_baseUnits: amountBN.toString(),
    requestId: reqIdBN.toString(),
    offset: offsetBN.toString(),
  });

  /* ---------------- Preflight / sanity checks ---------------- */
  console.groupCollapsed("[bridge:init] preflight");
  console.table({
    payer: payer.toBase58(),
    userToken: userToken.toBase58(),
    mint: mint.toBase58(),
    escrowToken: escrowToken.toBase58(),
    tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
    config: config.toBase58(),
    requestPda: requestPda.toBase58(),
    signPdaAccount: signPdaAccount.toBase58(),
    mxeAccount: mxeAccount.toBase58(),
    mempoolAccount: mempoolAccount.toBase58(),
    executingPool: executingPool.toBase58(),
    computationAccount: computationAccount.toBase58(),
    compDefAccount: compDefAccount.toBase58(),
    clusterAccount: clusterAccount.toBase58(),
    poolAccount: poolAccount.toBase58(),
    clockAccount: clockAccount.toBase58(),
    systemProgram: SystemProgram.programId.toBase58(),
    arciumProgram: arciumPk.toBase58(),
  } as any);
  console.log("requestId:", params.requestId.toString());
  console.log("amountLocked (base units):", amountBN.toString());
  console.groupEnd();

  // Existen y están en el programa correcto
  await mustMint(conn, mint);
  await mustExistAndOwnedBy(conn, "config", config, BRIDGE_PROGRAM_ID);
  await mustExistAndOwnedBy(conn, "mxeAccount", mxeAccount, ARCIUM_PROGRAM_ID);
  await mustExistAndOwnedBy(conn, "mempoolAccount", mempoolAccount, ARCIUM_PROGRAM_ID);
  await mustExistAndOwnedBy(conn, "executingPool", executingPool, ARCIUM_PROGRAM_ID);
  await mustExistAndOwnedBy(conn, "clusterAccount", clusterAccount, ARCIUM_PROGRAM_ID);
  await mustExistAndOwnedBy(conn, "poolAccount", poolAccount, ARCIUM_PROGRAM_ID);
  await mustExistAndOwnedBy(conn, "clockAccount", clockAccount, ARCIUM_PROGRAM_ID);
  await mustExistAndOwnedBy(conn, "compDefAccount", compDefAccount, ARCIUM_PROGRAM_ID);

  // Leer config via IDL (útil para ver qué espera tu programa en devnet)
  try {
    const cfg = await (program as any).account.config.fetch(config);
    console.debug("[bridge:init] on-chain Config (IDL decoded):", cfg);
  } catch {
    console.warn(
      "[bridge:init] Config PDA existe, pero no se pudo decodificar con el IDL (¿IDL/program en sync?)."
    );
  }

  // Balances
  try {
    const ub = await conn.getTokenAccountBalance(userToken);
    const eb = await conn.getTokenAccountBalance(escrowToken).catch(() => null);
    console.debug("userToken balance (raw amount):", ub?.value?.amount);
    console.debug("escrowToken balance (raw amount):", eb?.value?.amount ?? "(no ATA aún)");
  } catch (e) {
    console.warn("No pude leer algún balance ATA:", e);
  }

  // Checks de monto
  if (amountBN.isZero()) {
    throw new Error("amountLocked debe ser > 0 (en base units)");
  }
  try {
    const bal = await provider.connection.getTokenAccountBalance(userToken);
    const ui = BigInt(bal.value.amount ?? "0");
    if (ui < BigInt(amountBN.toString())) {
      throw new Error(
        `Saldo insuficiente en userToken: tienes ${ui}, necesitas ${amountBN.toString()}`
      );
    }
  } catch {
    console.warn(
      "[initiateBridge] userToken no existe aún o sin balance; si falta ATA se creará por preInstrucciones."
    );
  }

  // 6) Llamada Anchor — nombres EXACTOS del IDL
  const method = program.methods
    .initiateBridge(
      offsetBN,
      reqIdBN,
      Buffer.from(clientPub),
      Buffer.from(nonce),
      Buffer.from(ct0),
      Buffer.from(ct1),
      Buffer.from(ct2),
      Buffer.from(ct3),
      amountBN
    )
    .accountsStrict({
      // SPL
      payer,
      userToken,
      mint,
      escrowToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    
      // Bridge
      config,
      requestPda,
      signPdaAccount,
    
      // Arcium
      mxeAccount,
      mempoolAccount,
      executingPool,
      computationAccount,
      compDefAccount,
      clusterAccount,
      poolAccount,
      clockAccount,
    
      // Programas
      systemProgram: SystemProgram.programId,
      arciumProgram: ARCIUM_PROGRAM_ID,
    })
    .preInstructions(pre);
  // Si tu IDL requiere cuentas extra, añádelas como remainingAccounts.

  // 7) Simulación con logs
  if (params.simulateFirst !== false) {
    try {
      await method.simulate();
      console.debug("[initiateBridge] simulate(): OK");
    } catch (e: any) {
      console.error("simulate error (raw):", e);
      if (e?.logs) console.error("simulate logs:\n" + e.logs.join("\n"));
      if (e?.error?.errorMessage) console.error("anchor msg:", e.error.errorMessage);

      // ❌ Antes:
      // throw new Error(e?.error?.errorMessage ?? e?.message ?? "Simulation failed");

      // ✅ Ahora: re-lanzamos el error original para no perder e.logs
      throw e;
    }
  }

  // 8) Enviar tx
  const sig = await method.rpc();
  console.debug("[initiateBridge] rpc() sig:", sig);

  return { created: true, requestPda: requestPda.toBase58(), sig, ethParts: undefined as any };
}