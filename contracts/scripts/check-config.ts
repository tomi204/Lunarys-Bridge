// contracts/scripts/check-config.ts
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "../idl-onchain.json"; // <- el que acabas de bajar

// Helper: pasa "bridge_config" o "BridgeConfig" a "bridgeConfig"
function toCamel(name: string) {
  return name.replace(/[_-](\w)/g, (_, c) => c.toUpperCase())
             .replace(/^\w/, c => c.toLowerCase());
}

(async () => {
  const url = "https://api.devnet.solana.com";
  const connection = new anchor.web3.Connection(url, "confirmed");
  // wallet dummy (solo lectura)
  const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const programId = new PublicKey((idl as any).address ?? "8gk2T4FJYaPUWHDzm5aKccu8HJSpEXYu3rFAoeb7FDE7");
  const program   = new anchor.Program(idl as anchor.Idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  console.log("Program ID:", programId.toBase58());
  console.log("Config PDA :", configPda.toBase58());

  // Descubre el nombre del account "config" dentro del IDL
  const accounts = (idl as any).accounts || [];
  console.log("IDL accounts:", accounts.map((a: any) => a.name));

  // busca algo que contenga "config" (case-insensitive)
  const accMeta =
    accounts.find((a: any) => String(a.name).toLowerCase().includes("config")) || accounts[0];

  const accNameCamel = toCamel(accMeta.name); // p.ej. "bridgeConfig" o "config"
  console.log("Usando account decoder:", accNameCamel);

  try {
    const cfg = await (program.account as any)[accNameCamel].fetch(configPda);
    console.log("✅ Config decodificada OK:");
    console.log({
      feeBps: cfg.feeBps,
      minFee: cfg.minFee?.toString?.() ?? String(cfg.minFee),
      maxFee: cfg.maxFee?.toString?.() ?? String(cfg.maxFee),
      claimWindowSecs: cfg.claimWindowSecs?.toString?.() ?? String(cfg.claimWindowSecs),
      minSolverBond: cfg.minSolverBond?.toString?.() ?? String(cfg.minSolverBond),
      slashBps: cfg.slashBps,
      bump: cfg.bump,
      // owner si existiera en tu struct:
      owner: cfg.owner?.toBase58?.() ?? cfg.owner ?? "(no owner field)",
    });
  } catch (e) {
    console.error("❌ No pude deserializar config con este IDL:", e);
    process.exit(1);
  }
})();