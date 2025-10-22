import "dotenv/config";
import * as fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import idl from "../target/idl/contracts.json";

// ======================= ENV / DEFAULTS =======================

// RPC (devnet by default)
const CLUSTER_URL = process.env.CLUSTER_URL || "https://api.devnet.solana.com";

// Wallet to use (ideally the same one you used in `arcium deploy`)
const WALLET_KEYPAIR_PATH = process.env.WALLET_KEYPAIR_PATH; // e.g. ~/.config/solana/id.json

// Values aligned with Solidity (fee 0.3%, claimWindow 20min, slash 50%)
// For tokens with 6 decimals (USDC/USDT):
const FEE_BPS = Number(process.env.FEE_BPS ?? 30);                  // 0.3%
const MIN_FEE = BigInt(process.env.MIN_FEE ?? "1000");              // 0.001 token
const MAX_FEE = BigInt(process.env.MAX_FEE ?? "100000000");         // 100 tokens
const CLAIM_WINDOW_SECS = BigInt(process.env.CLAIM_WINDOW_SECS ?? "1200"); // 20 min
// Minimum solver bond: 0.02 SOL in lamports
const MIN_SOLVER_BOND = BigInt(process.env.MIN_SOLVER_BOND ?? "20000000"); // 0.02 SOL
const SLASH_BPS = Number(process.env.SLASH_BPS ?? 5000);            // 50%

// ======================= HELPERS =======================

function loadKeypair(): Keypair {
  if (WALLET_KEYPAIR_PATH && fs.existsSync(WALLET_KEYPAIR_PATH)) {
    const raw = fs.readFileSync(WALLET_KEYPAIR_PATH, "utf-8");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }
  const fallback = `${process.env.HOME}/.config/solana/id.json`;
  const raw = fs.readFileSync(fallback, "utf-8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

// ======================= MAIN =======================

async function main() {
  // Provider + Program (in Anchor 0.31+ we can use `new Program(idl, provider)` if `idl.address` exists)
  const connection = new anchor.web3.Connection(CLUSTER_URL, "confirmed");
  const wallet = new anchor.Wallet(loadKeypair());
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Program instance
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const programId = new PublicKey((idl as any).address);
  console.log("Program ID:", programId.toBase58());

  // Config PDA: seeds = [b"config"]
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  console.log("Config PDA:", configPda.toBase58());

  // If it already exists, don't reinitialize
  const exists = await connection.getAccountInfo(configPda);
  if (exists) {
    console.log("ℹ️  Config already initialized; nothing to do.");
  } else {
    console.log("Initializing config...");
    const sig = await program.methods
      .initConfig(
        FEE_BPS,
        new anchor.BN(MIN_FEE.toString()),
        new anchor.BN(MAX_FEE.toString()),
        new anchor.BN(CLAIM_WINDOW_SECS.toString()),
        new anchor.BN(MIN_SOLVER_BOND.toString()),
        SLASH_BPS
      )
      .accounts({
        payer: wallet.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log("✅ init_config tx:", sig);
  }

  // (Optional) Read the account to verify stored values.
  // In Anchor, the JS name of the account is usually the same as in the IDL in camelCase.
  // If your struct in Rust is called `Config`, here it will be `program.account.config`.
  try {
    // @ts-ignore – depends on the actual name in the IDL
    const cfg = await (program.account as any).config.fetch(configPda);
    console.log("Config read:", {
      feeBps: cfg.feeBps,
      minFee: cfg.minFee.toString(),
      maxFee: cfg.maxFee.toString(),
      claimWindowSecs: cfg.claimWindowSecs.toString(),
      minSolverBond: cfg.minSolverBond.toString(),
      slashBps: cfg.slashBps,
      owner: cfg.owner?.toBase58?.() ?? cfg.owner,
      bump: cfg.bump,
    });
  } catch {
    // If deserialization fails, probably the account name in the IDL is different.
    // You can inspect: console.log((idl as any).accounts?.map((a:any)=>a.name));
    console.log("Could not deserialize the account (different name in IDL?). Still OK.");
  }

  console.log("Done ✅");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});