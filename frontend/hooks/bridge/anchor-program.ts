// lib/bridge/solana/anchor-program.ts
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "../../abi/bridge.json";

export const BN = anchor.BN;

/** Conexión a Solana (usa DEVNET por defecto) */
export function getSolanaConnection() {
  const url =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
  return new Connection(url, "confirmed");
}

/** Resuelve el Program ID: .env primero, si no existe usa el address del IDL */
export function getProgramId(): PublicKey {
  const fromEnv = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID?.replace(/"/g, "");
  const fromIdl = (idl as any).address as string | undefined;

  if (!fromEnv && !fromIdl) {
    throw new Error(
      "No hay Program ID: define NEXT_PUBLIC_SOLANA_PROGRAM_ID o asegúrate que el IDL tenga .address"
    );
  }

  if (fromEnv && fromIdl && fromEnv !== fromIdl) {
    console.warn(
      `[bridge] WARNING: NEXT_PUBLIC_SOLANA_PROGRAM_ID (${fromEnv}) y idl.address (${fromIdl}) difieren. Se usará el de .env.`
    );
  }

  return new PublicKey(fromEnv || fromIdl!);
}

/** Crea un AnchorProvider desde la wallet del navegador (Phantom/AppKit). */
export function getAnchorProvider(wallet: any) {
  if (!wallet) throw new Error("Wallet Solana no encontrada.");
  const connection = getSolanaConnection();

  // ⚠️ Importante: NO usar `new anchor.Wallet(wallet)` aquí.
  // Para front, pasa el adapter (Phantom/AppKit) directamente.
  return new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
}

/** Devuelve el Program de Anchor (idl, programId, provider) */
export function getBridgeProgram(provider: anchor.AnchorProvider) {
  if (!provider) throw new Error("Provider inválido.");
  const programId = getProgramId(); // 8gk2T4FJ...
  return new anchor.Program(idl as anchor.Idl, provider);
}