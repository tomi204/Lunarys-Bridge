// lib/bridge/solana/wallet.ts
"use client";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export type SolanaWalletLike = {
  publicKey: PublicKey;
  signTransaction?: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAndSendTransaction: (
    tx: Transaction | VersionedTransaction,
    opts?: { connection?: Connection; skipPreflight?: boolean }
  ) => Promise<{ signature: string }>;
};

function detectRawProvider(): any {
  const w =
    (window as any)?.solana ??
    (window as any)?.phantom?.solana ??
    (window as any)?.appkit?.solana ??
    (window as any)?.appKit?.solana ??
    (window as any)?.reown?.solana;
  if (!w) throw new Error("No se encontró wallet Solana (Phantom/AppKit/Reown).");
  return w;
}

export async function getSolanaWalletLike(rpcUrl = "https://api.devnet.solana.com"): Promise<SolanaWalletLike> {
  const raw = detectRawProvider();
  if (!raw.isConnected && typeof raw.connect === "function") {
    await raw.connect();
  }
  if (!raw.publicKey) throw new Error("La wallet no está conectada.");
  // Para compatibilidad, necesitamos un Connection si el wallet no envía la tx por sí mismo
  const fallbackConn = new Connection(rpcUrl, "confirmed");

  const signAndSendTransaction = async (
    tx: Transaction | VersionedTransaction,
    opts?: { connection?: Connection; skipPreflight?: boolean }
  ) => {
    // 1) Camino rápido: la wallet envía por nosotros
    if (typeof raw.signAndSendTransaction === "function") {
      const res = await raw.signAndSendTransaction(tx);
      const signature = typeof res === "string" ? res : res?.signature;
      if (signature) return { signature };

      // Algunas wallets sólo “firman” con esa API; hacemos fallback a sendRaw
      if (!raw.signTransaction) throw new Error("La wallet no expone signTransaction.");
      const signed = await raw.signTransaction(tx);
      const wire = (signed as any).serialize();
      const conn = opts?.connection ?? fallbackConn;
      const sig = await conn.sendRawTransaction(wire, { skipPreflight: !!opts?.skipPreflight });
      return { signature: sig };
    }

    // 2) Fallback: firmar y enviar manualmente
    if (!raw.signTransaction) throw new Error("La wallet no expone signTransaction.");
    const signed = await raw.signTransaction(tx);
    const wire = (signed as any).serialize();
    const conn = opts?.connection ?? fallbackConn;
    const sig = await conn.sendRawTransaction(wire, { skipPreflight: !!opts?.skipPreflight });
    return { signature: sig };
  };

  return {
    publicKey: raw.publicKey as PublicKey,
    signTransaction: raw.signTransaction?.bind(raw),
    signAndSendTransaction,
  };
}
