// lib/bridge/solana/anchor-program.ts
"use client";

import type { Idl } from "@coral-xyz/anchor";
import { AnchorProvider, BN, Program, setProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "@/abi/bridge.json";
import { RPC_URL, BRIDGE_PROGRAM_ID } from "./env";

// ---------- Wallet detection ----------
type WalletLike = {
  publicKey: PublicKey;
  signTransaction: (tx: any) => Promise<any>;
  signAllTransactions?: (txs: any[]) => Promise<any[]>;
};

function detectBrowserWallet(): WalletLike {
  const w =
    (window as any)?.solana ??
    (window as any)?.phantom?.solana ??
    (window as any)?.appkit?.solana ??
    (window as any)?.appKit?.solana ??
    (window as any)?.reown?.solana;

  if (!w) throw new Error("No Solana wallet found (Phantom/AppKit/Reown).");
  if (!w.publicKey) throw new Error("Wallet is not connected.");
  if (typeof w.signTransaction !== "function") {
    throw new Error("Wallet does not expose signTransaction (required by Anchor).");
  }
  return {
    publicKey: w.publicKey,
    signTransaction: w.signTransaction.bind(w),
    signAllTransactions: w.signAllTransactions?.bind(w),
  };
}

// ---------- Provider helpers ----------
export function getAnchorProvider(
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): AnchorProvider {
  const connection = new Connection(RPC_URL, commitment);
  const wallet = detectBrowserWallet();
  const provider = new AnchorProvider(connection, wallet as any, { commitment });
  setProvider(provider);
  return provider;
}

export async function getAnchorProviderOrConnect(
  commitment: "processed" | "confirmed" | "finalized" = "confirmed"
): Promise<AnchorProvider> {
  const raw =
    (window as any)?.solana ??
    (window as any)?.phantom?.solana ??
    (window as any)?.appkit?.solana ??
    (window as any)?.appKit?.solana ??
    (window as any)?.reown?.solana;
  if (!raw) throw new Error("No Solana wallet found (Phantom/AppKit/Reown).");
  if (!raw.publicKey && typeof raw.connect === "function") await raw.connect();
  return getAnchorProvider(commitment);
}

// ---------- Program (tipos a prueba de versiones) ----------
type AnyProgramCtor = new (
  idl: any,
  programIdOrProvider?: any,
  maybeProvider?: any
) => Program<any>;

/**
 * Devuelve el Program del bridge:
 * - Usa BRIDGE_PROGRAM_ID (PublicKey) de ./env
 * - Fuerza la signatura del ctor con cast para esquivar desalineos de @coral-xyz/anchor
 */
export function getBridgeProgram(
  opts?: { provider?: AnchorProvider; programId?: PublicKey | string }
): Program<Idl> {
  const provider = opts?.provider ?? getAnchorProvider("confirmed");
  setProvider(provider);

  const pid =
    typeof opts?.programId === "string"
      ? new PublicKey(opts!.programId)
      : (opts?.programId ?? BRIDGE_PROGRAM_ID);

  // Warn si el IDL trae otra address
  const idlAddr = (idl as any)?.metadata?.address as string | undefined;
  if (idlAddr && idlAddr !== pid.toBase58()) {
    console.warn(
      `[anchor-program] ProgramId mismatch. env=${pid.toBase58()} vs idl=${idlAddr}`
    );
  }

  // 🔧 Cast del ctor para tolerar firmas (idl, programId, provider) vs (idl, provider, programId)
  const ProgramCtor = Program as unknown as AnyProgramCtor;

  // Intento #1: (idl, pid, provider)
  try {
    return new ProgramCtor(idl as any, pid, provider) as Program<Idl>;
  } catch {
    // Intento #2: (idl, provider, pid) — por si tu @coral-xyz/anchor resuelve esa signatura
    return new ProgramCtor(idl as any, provider, pid) as Program<Idl>;
  }
}

// Re-exports útiles
export { BN, PublicKey };
