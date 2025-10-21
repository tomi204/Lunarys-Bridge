// lib/bridge/solana/claim.ts
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";

// ---- Buffer polyfill (browser)
import { Buffer } from "buffer";
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

// --- ENV mínimas (program IDs + compdef reseal)
const BRIDGE_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID!);
const ARCIUM_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_ARCIUM_PROGRAM_ID!);
const COMP_DEF_RESEAL   = new PublicKey(process.env.NEXT_PUBLIC_ARCIUM_COMPDEF_RESEAL_PDA!);
const RPC_URL           = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

// seed del sign PDA de TU BRIDGE (cambiá si tu on-chain usa otro)
const SIGN_SEED = process.env.NEXT_PUBLIC_SIGN_SEED || "sign";

// --- Arcium: cuentas fijas de tu despliegue (R E L L E N Á)
const ARCIUM_ADDR = {
  mxeAccount: "FILL_ME_MXE_ACCOUNT_PDA",
  mempool:    "FILL_ME_MEMPOOL_PDA",
  execpool:   "FILL_ME_EXECPOOL_PDA",
  cluster:    "FILL_ME_CLUSTER_PDA",
  feePool:    "FILL_ME_FEEPOOL_PDA",
  clock:      "FILL_ME_CLOCK_ACCOUNT", // en tu Anchor es ARCIUM_CLOCK_ACCOUNT_ADDRESS (NO SysvarClock)
} as const;

const mustPk = (v: string, name: string) => {
  if (!v || v.startsWith("FILL_ME_")) {
    throw new Error(`Falta ${name}. Hardcodeá ${name} con la cuenta real del despliegue.`);
  }
  return new PublicKey(v);
};

// --- utils
const u64LE = (n: bigint) => {
  const out = new Uint8Array(8);
  let v = n;
  for (let i = 0; i < 8; i++) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return Buffer.from(out);
};

const ixDisc = (name: string) =>
  Buffer.from(sha256(new TextEncoder().encode(`global:${name}`)).slice(0, 8));

const pda = (seeds: Buffer[], program: PublicKey) =>
  PublicKey.findProgramAddressSync(seeds as any, program)[0];

export type SolanaWalletLike = {
  publicKey: PublicKey | { toString(): string; toBase58?: () => string };
  signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string } | string>;
};

export const randomOffsetU64 = (): bigint => {
  const a = BigInt((Math.random() * 2 ** 32) | 0);
  const b = BigInt((Math.random() * 2 ** 32) | 0);
  return (a << 32n) | b;
};

function deriveBridgeSignPda(): PublicKey {
  return pda([Buffer.from(SIGN_SEED)], BRIDGE_PROGRAM_ID);
}

export async function claimBridgeWithWallet(
  wallet: SolanaWalletLike,
  params: {
    requestId: bigint;
    requestOwner: string;       // base58
    solverX25519: Uint8Array;   // 32 bytes
    computationOffset?: bigint; // opcional
  }
): Promise<{ sig: string; offset: string }> {
  if (!wallet?.publicKey) throw new Error("Solana wallet no conectada");

  const conn = new Connection(RPC_URL, "confirmed");

  // normalizar publicKey a base58
  const pubKeyStr =
    typeof (wallet.publicKey as any)?.toBase58 === "function"
      ? (wallet.publicKey as any).toBase58()
      : String((wallet.publicKey as any).toString());
  const feePayer = new PublicKey(pubKeyStr);

  const requestOwner = new PublicKey(params.requestOwner);
  const requestId    = params.requestId;
  const offset       = params.computationOffset ?? randomOffsetU64();
  if (params.solverX25519.length !== 32) throw new Error("solverX25519 debe tener 32 bytes");

  // --- PDAs de tu bridge
  const configPda  = pda([Buffer.from("config")], BRIDGE_PROGRAM_ID);
  const requestPda = pda([Buffer.from("request"), requestOwner.toBuffer(), u64LE(requestId)], BRIDGE_PROGRAM_ID);
  const bondVault  = pda([Buffer.from("bond"), u64LE(requestId)], BRIDGE_PROGRAM_ID);
  const signPda    = deriveBridgeSignPda();

  // --- Cuentas de Arcium (hardcodeadas)
  const mxeAccount = mustPk(ARCIUM_ADDR.mxeAccount, "ARCIUM_ADDR.mxeAccount");
  const mempool    = mustPk(ARCIUM_ADDR.mempool,    "ARCIUM_ADDR.mempool");
  const execpool   = mustPk(ARCIUM_ADDR.execpool,   "ARCIUM_ADDR.execpool");
  const cluster    = mustPk(ARCIUM_ADDR.cluster,    "ARCIUM_ADDR.cluster");
  const feePool    = mustPk(ARCIUM_ADDR.feePool,    "ARCIUM_ADDR.feePool");
  const clock      = mustPk(ARCIUM_ADDR.clock,      "ARCIUM_ADDR.clock");

  // PDA de Computation para este offset (Arcium)
  const computation = pda([Buffer.from("computation"), u64LE(offset)], ARCIUM_PROGRAM_ID);

  // data: 8b discriminator + offset + request_id + solver_x25519
  const data = Buffer.concat([
    ixDisc("claim_bridge"),
    u64LE(offset),
    u64LE(requestId),
    Buffer.from(params.solverX25519),
  ]);

  const keys = [
    // signer / fee payer
    { pubkey: feePayer,    isSigner: true,  isWritable: true },

    // estado del bridge
    { pubkey: configPda,   isSigner: false, isWritable: false },
    { pubkey: requestPda,  isSigner: false, isWritable: true  },
    { pubkey: requestOwner,isSigner: false, isWritable: false },
    { pubkey: bondVault,   isSigner: false, isWritable: true  },

    // Arcium (reseal)
    { pubkey: signPda,           isSigner: false, isWritable: true  },
    { pubkey: mxeAccount,        isSigner: false, isWritable: false },
    { pubkey: mempool,           isSigner: false, isWritable: true  },
    { pubkey: execpool,          isSigner: false, isWritable: true  },
    { pubkey: computation,       isSigner: false, isWritable: true  },
    { pubkey: COMP_DEF_RESEAL,   isSigner: false, isWritable: false },
    { pubkey: cluster,           isSigner: false, isWritable: true  },
    { pubkey: feePool,           isSigner: false, isWritable: true  },
    { pubkey: clock,             isSigner: false, isWritable: false },
    { pubkey: ARCIUM_PROGRAM_ID, isSigner: false, isWritable: false },

    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer, blockhash, lastValidBlockHeight }).add(
    new TransactionInstruction({ programId: BRIDGE_PROGRAM_ID, keys, data })
  );

  const sent = await wallet.signAndSendTransaction(tx);
  const signature = typeof sent === "string" ? sent : sent.signature;

  await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return { sig: signature, offset: offset.toString() };
}
