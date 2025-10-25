// scripts/dev-initiate-3usdc.ts
import "dotenv/config";
import * as fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { BN } from "bn.js";
import idl from "../target/idl/contracts.json";
import { createHash, webcrypto } from "crypto";

import {
  getArciumProgAddress,
  getMXEAccAddress,
  getMempoolAccAddress,
  getExecutingPoolAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
  getComputationAccAddress,
} from "@arcium-hq/client";

/* ============ utils ============ */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Falta env ${name}`);
  return v.trim().replace(/^"|"$/g, "");
}

function loadKeypair(): Keypair {
  const kpPath =
    process.env.WALLET_KEYPAIR_PATH ||
    `${process.env.HOME}/.config/solana/id.json`;
  const raw = fs.readFileSync(kpPath, "utf-8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

function u64LE(n: bigint) {
  const out = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return Buffer.from(out);
}

function randU64(): bigint {
  const a = new Uint32Array(2);
  webcrypto.getRandomValues(a);
  return (BigInt(a[0]) << 32n) | BigInt(a[1]);
}

function randBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  webcrypto.getRandomValues(a);
  return a;
}

function sha256(data: Uint8Array): Uint8Array {
  return createHash("sha256").update(data).digest();
}

function hexToBytes32FromEth(addr: string): Buffer {
  const h = addr.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(h))
    throw new Error("Dirección EVM inválida (0x + 40 hex)");
  const raw = Buffer.from(h, "hex"); // 20 bytes
  const buf32 = Buffer.alloc(32);
  raw.copy(buf32, 12); // left-pad 12 bytes
  return buf32;
}

function makeDummyCtsFromEth(ethRecipient: string) {
  const base = hexToBytes32FromEth(ethRecipient);
  const tag = (s: string) =>
    Buffer.from(sha256(Buffer.concat([Buffer.from(s), base])));
  return { ct0: tag("ct0:"), ct1: tag("ct1:"), ct2: tag("ct2:"), ct3: tag("ct3:") };
}

function parseRightAddrFromLogs(logs?: string[]): string | null {
  if (!logs) return null;
  for (let i = 0; i < logs.length; i++) {
    const line = logs[i];

    // Formato que imprime tu programa
    let m = line.match(/right\(expected\)=\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i);
    if (m) return m[1];

    // Formato clásico de Anchor
    if (line.includes("Right:")) {
      const same = line.match(/Right:\s+([1-9A-HJ-NP-Za-km-z]{32,44})/);
      if (same) return same[1];
      for (let j = i + 1; j < Math.min(i + 6, logs.length); j++) {
        const n = logs[j].match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
        if (n) return n[1];
      }
    }
  }
  return null;
}

// Derivar cluster PDA desde el offset (devnet = 1078779259)
function clusterPdaFromOffset(
  mxe: PublicKey,
  clusterOffset: number, // 1078779259 en devnet
  arciumProgramId: PublicKey
): PublicKey {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(clusterOffset, 0);
  const seeds = [Buffer.from("cluster"), mxe.toBuffer(), buf];
  return PublicKey.findProgramAddressSync(seeds, arciumProgramId)[0];
}

/* ============ main ============ */

(async () => {
  const CLUSTER_URL = process.env.CLUSTER_URL || "https://api.devnet.solana.com";
  const connection = new anchor.web3.Connection(CLUSTER_URL, "confirmed");
  const wallet = new anchor.Wallet(loadKeypair());
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = new anchor.Program(idl as anchor.Idl, provider);
  const programId = new PublicKey((idl as any).address);
  console.log("Program ID:", programId.toBase58());

  // === Entradas ===
  const ETH_RECIPIENT =
    process.argv[2] || "0x000000000000000000000000000000000000dead";

  // === SPL / Bridge locals ===
  const MINT = new PublicKey(requireEnv("NEXT_PUBLIC_SPL_MINT"));
  const SIGN_SEED_STR = process.env.NEXT_PUBLIC_SIGN_SEED || "SignerAccount";
  const SIGN_SEED = Buffer.from(SIGN_SEED_STR);

  // === Arcium (derivaciones oficiales vía SDK) ===
  const ARCIUM_PROGRAM_ID = getArciumProgAddress(); // Program<Arcium>
  const MXE      = getMXEAccAddress(programId);
  const MEMPOOL  = getMempoolAccAddress(programId);
  const EXECPOOL = getExecutingPoolAccAddress(programId);

  // comp_def "plan_payout"
  const planOffsetU32 = Buffer
    .from(getCompDefAccOffset("plan_payout"))
    .readUInt32LE();
  const COMPDEF_PLAN  = getCompDefAccAddress(programId, planOffsetU32);

  // Cluster derivado por offset fijo de devnet
  const CLUSTER = new PublicKey(requireEnv("NEXT_PUBLIC_ARCIUM_CLUSTER"));

  // Fee pool y clock (mantén por .env mientras no uses helper)
  const FEE_POOL = new PublicKey(requireEnv("NEXT_PUBLIC_ARCIUM_POOL"));
  const CLOCK    = new PublicKey(requireEnv("NEXT_PUBLIC_ARCIUM_CLOCK"));

  const PAYER = wallet.publicKey;

  // PDAs bridge (propios del programa)
  const [CONFIG_PDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  const requestId = BigInt(Date.now() % 2 ** 32);
  const [REQUEST_PDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("request"), PAYER.toBuffer(), u64LE(requestId)],
    programId
  );
  const [SIGN_PDA] = PublicKey.findProgramAddressSync([SIGN_SEED], programId);

  // offset para computation_account
  const offset = randU64();
  const offsetBn = new BN(offset.toString());

  function computationPdaExact(
    mxe: PublicKey,
    compDef: PublicKey,
    offset: bigint,
    arciumProgramId: PublicKey
  ): PublicKey {
    const seeds = [
      Buffer.from("computation_account"),
      mxe.toBuffer(),
      compDef.toBuffer(),
      u64LE(offset),
    ];
    return PublicKey.findProgramAddressSync(seeds, arciumProgramId)[0];
  }
  
  // úsalo así:
  const computationPda = getComputationAccAddress(programId, offsetBn);
  console.log("computation(derived):", computationPda.toBase58());
  // ATAs
  const userToken = getAssociatedTokenAddressSync(
    MINT, PAYER, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const escrowToken = getAssociatedTokenAddressSync(
    MINT, SIGN_PDA, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Pre-instrucciones: compute + crear ATAs si faltan
  const pre: anchor.web3.TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
  ];
  if (!(await connection.getAccountInfo(userToken))) {
    pre.push(
      createAssociatedTokenAccountInstruction(
        PAYER, userToken, PAYER, MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }
  if (!(await connection.getAccountInfo(escrowToken))) {
    pre.push(
      createAssociatedTokenAccountInstruction(
        PAYER, escrowToken, SIGN_PDA, MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // Chequeos previos
  console.log("\n[preflight]");
  const cfgAcc = await connection.getAccountInfo(CONFIG_PDA);
  console.log("config exists:", !!cfgAcc, CONFIG_PDA.toBase58());
  try {
    // @ts-ignore – nombre puede variar en IDL
    const cfg = await (program.account as any).bridgeConfig.fetch(CONFIG_PDA);
    console.log("config read:", {
      feeBps: cfg.feeBps,
      minFee: cfg.minFee.toString(),
      maxFee: cfg.maxFee.toString(),
    });
  } catch {
    console.log("config deserialization skipped (ok)");
  }
  try {
    const ub = await connection.getTokenAccountBalance(userToken);
    console.log("user ATA balance (raw):", ub.value.amount);
  } catch {
    console.log("user ATA no existe aún (se creará si falta)");
  }

  // Payload
  const amount = 3_000_000n; // 3 USDC (6 decimales)
  const clientPub = randBytes(32);
  const nonce = randBytes(16);
  const { ct0, ct1, ct2, ct3 } = makeDummyCtsFromEth(ETH_RECIPIENT);

  // Volcado
  console.log("\n[accounts]");
  console.table({
    payer: PAYER.toBase58(),
    userToken: userToken.toBase58(),
    mint: MINT.toBase58(),
    escrowToken: escrowToken.toBase58(),
    config: CONFIG_PDA.toBase58(),
    requestPda: REQUEST_PDA.toBase58(),
    signPdaAccount: SIGN_PDA.toBase58(),
    mxeAccount: MXE.toBase58(),
    mempoolAccount: MEMPOOL.toBase58(),
    executingPool: EXECPOOL.toBase58(),
    computationAccount: computationPda.toBase58(),
    compDefAccount: COMPDEF_PLAN.toBase58(),
    clusterAccount: CLUSTER.toBase58(),
    poolAccount: FEE_POOL.toBase58(),
    clockAccount: CLOCK.toBase58(),
    tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
    arciumProgram: ARCIUM_PROGRAM_ID.toBase58(),
  });
  console.log(
    "\n[params]",
    JSON.stringify(
      {
        offset: offset.toString(),
        requestId: requestId.toString(),
        amount: amount.toString(),
        ethRecipient: ETH_RECIPIENT,
      },
      null,
      2
    )
  );

  // Método
  const buildMethod = (compPk: PublicKey) =>
    program.methods
      .initiateBridge(
        new BN(offset.toString()),
        new BN(requestId.toString()),
        Buffer.from(clientPub),
        Buffer.from(nonce),
        Buffer.from(ct0),
        Buffer.from(ct1),
        Buffer.from(ct2),
        Buffer.from(ct3),
        new BN(amount.toString())
      )
      .accountsStrict({
        // SPL
        payer: PAYER,
        userToken,
        mint: MINT,
        escrowToken,
        tokenProgram: TOKEN_PROGRAM_ID,

        // Bridge
        config: CONFIG_PDA,
        requestPda: REQUEST_PDA,
        signPdaAccount: SIGN_PDA,

        // Arcium
        mxeAccount: MXE,
        mempoolAccount: MEMPOOL,
        executingPool: EXECPOOL,
        computationAccount: compPk,
        compDefAccount: COMPDEF_PLAN,
        clusterAccount: CLUSTER,
        poolAccount: FEE_POOL,
        clockAccount: CLOCK,

        // Programas
        systemProgram: SystemProgram.programId,
        arciumProgram: ARCIUM_PROGRAM_ID,
      })
      .preInstructions(pre);

  let method = buildMethod(computationPda);

  // Simular con fallback (solo si imprime Right:)
    console.log("\n[simulate]");
  try {
    await method.simulate();
    console.log("[simulate] OK");
  } catch (e: any) {
    const logs: string[] =
      e?.simulationResponse?.logs ??
      e?.logs ??
      [];
    if (logs.length) console.error(logs.join("\n"));

    // ❌ NO hacer fallback a “Right(expected)”
    // Esto provocaba el mismatch en el CPI.
    throw e;
  }

  // Enviar
  const sig = await method.rpc();
  console.log("\n✅ sent. sig:", sig);
  console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});