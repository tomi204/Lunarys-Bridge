import "dotenv/config";
import * as fs from "fs";
import bs58 from "bs58";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import idl from "../target/idl/contracts.json";

// Arcium helpers
import {
  getMXEAccAddress,
  getCompDefAccAddress,
  getCompDefAccOffset,
} from "@arcium-hq/client";

/* ================== ENV / CONFIG ================== */

const CLUSTER_URL = process.env.CLUSTER_URL || "https://api.devnet.solana.com";
const WALLET_KEYPAIR_PATH = process.env.WALLET_KEYPAIR_PATH; // e.g.: /Users/you/.config/solana/id.json
const SOLANA_PRIVATE_KEY_B58 = process.env.SOLANA_PRIVATE_KEY || "";

// Your deployed Program ID
const PROGRAM_ID = new PublicKey("8gk2T4FJYaPUWHDzm5aKccu8HJSpEXYu3rFAoeb7FDE7");
// Arcium program on devnet
const ARCIUM_PROGRAM_ID = new PublicKey("BKck65TgoKRokMjQM3datB9oRwJ8rAj2jxPXvHXUvcL6");

/* ============== Load wallet / provider ============== */

function loadKeypair(): Keypair {
  if (WALLET_KEYPAIR_PATH && fs.existsSync(WALLET_KEYPAIR_PATH)) {
    const raw = fs.readFileSync(WALLET_KEYPAIR_PATH, "utf-8");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }
  if (SOLANA_PRIVATE_KEY_B58) {
    return Keypair.fromSecretKey(bs58.decode(SOLANA_PRIVATE_KEY_B58));
  }
  const fallback = `${process.env.HOME}/.config/solana/id.json`;
  const raw = fs.readFileSync(fallback, "utf-8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

async function main() {
  const connection = new anchor.web3.Connection(CLUSTER_URL, "confirmed");
  const kp = loadKeypair();
  const wallet = new anchor.Wallet(kp);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // 👇 In Anchor 0.31+ this constructor works without weird casts:
  const program = new anchor.Program(
    idl as anchor.Idl,
    provider
  );

  // === Arcium PDAs ===
  const mxeAccount = getMXEAccAddress(PROGRAM_ID);
  const planPayoutOffset = Buffer.from(getCompDefAccOffset("plan_payout")).readUInt32LE();
  const resealOffset = Buffer.from(getCompDefAccOffset("reseal_destination")).readUInt32LE();
  const planPayoutCompDef = getCompDefAccAddress(PROGRAM_ID, planPayoutOffset);
  const resealCompDef = getCompDefAccAddress(PROGRAM_ID, resealOffset);

  console.log("MXE PDA:", mxeAccount.toBase58());
  console.log("plan_payout comp_def PDA:", planPayoutCompDef.toBase58());
  console.log("reseal_destination comp_def PDA:", resealCompDef.toBase58());

  // === Idempotency: if the comp_def already exists, skip ===
  const planExists = await connection.getAccountInfo(planPayoutCompDef);
  if (!planExists) {
    const sig = await program.methods
      .initPlanPayoutCompDef()
      .accounts({
        payer: wallet.publicKey,
        mxeAccount,
        compDefAccount: planPayoutCompDef,
        arciumProgram: ARCIUM_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });
    console.log("✅ init_plan_payout_comp_def tx:", sig);
  } else {
    console.log("ℹ️ plan_payout comp_def already initialized; skip.");
  }
  const resealExists = await connection.getAccountInfo(resealCompDef);
  if (!resealExists) {
    const sig = await program.methods
      .initResealCompDef()
      .accounts({
        payer: wallet.publicKey,
        mxeAccount,
        compDefAccount: resealCompDef,
        arciumProgram: ARCIUM_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });
    console.log("✅ init_reseal_comp_def tx:", sig);
  } else {
    console.log("ℹ️ reseal_destination comp_def already initialized; skip.");
  }

  console.log("Done ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});