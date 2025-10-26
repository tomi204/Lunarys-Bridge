// lib/bridge/solana/anchor-program.ts
import * as anchor from "@coral-xyz/anchor";
import type { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "@/abi/bridge.json"; // ⚠️ asegúrate que este path y nombre existen

export const BN = anchor.BN;

/** Conexión a Solana (DEVNET por defecto) */
export function getSolanaConnection(
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
) {
  const url =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.replace(/"/g, "") ||
    "https://api.devnet.solana.com";
  return new Connection(url, commitment);
}

/** Resuelve el Program ID: .env primero, si no existe usa el address del IDL */
export function getProgramId(): PublicKey {
  const fromEnv = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID?.replace(/"/g, "");
  const fromIdl = (idl as any).address as string | undefined;

  if (!fromEnv && !fromIdl) {
    throw new Error(
      "Falta Program ID: define NEXT_PUBLIC_SOLANA_PROGRAM_ID o usa un IDL con .address"
    );
  }
  if (fromEnv && fromIdl && fromEnv !== fromIdl) {
    console.warn(
      `[bridge] WARNING: .env (${fromEnv}) ≠ idl.address (${fromIdl}). Se usará el de .env.`
    );
  }
  return new PublicKey(fromEnv || fromIdl!);
}

/** Crea un AnchorProvider desde el adapter de la wallet (Phantom/AppKit). */
export function getAnchorProvider(
  wallet: any,
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): AnchorProvider {
  if (!wallet) throw new Error("Wallet Solana no encontrada.");
  const connection = getSolanaConnection(commitment);
  // Importante: pasa el adapter directamente (NO `new anchor.Wallet(wallet)` en front)
  return new anchor.AnchorProvider(connection, wallet, { commitment });
}

/** Devuelve el Program del bridge (forma explícita y determinista) */
export function getBridgeProgram(provider: AnchorProvider) {
  if (!provider) throw new Error("Provider inválido.");
  const programId = getProgramId(); // 8gk2… de tu despliegue
  return new anchor.Program(idl as anchor.Idl, provider);
}