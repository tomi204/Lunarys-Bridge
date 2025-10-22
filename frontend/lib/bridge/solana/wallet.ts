// lib/bridge/solana/wallet.ts
"use client";

import type { SolanaWalletLike } from "./claim";
import { VersionedTransaction, Transaction } from "@solana/web3.js";

/**
 * Wrapper mínimo para Phantom/Solflare que devuelva SolanaWalletLike:
 * - Conecta si hace falta
 * - Usa signAndSendTransaction del provider (acepta Transaction o VersionedTransaction)
 */
export async function getSolanaWalletLike(): Promise<SolanaWalletLike> {
  const provider = (window as any)?.solana ?? (window as any)?.phantom?.solana;

  if (!provider) throw new Error("No se encontró wallet Solana (Phantom/Solflare).");

  if (!provider.isConnected) {
    // Phantom/solflare: connect() abre pop-up
    await provider.connect();
  }

  const signAndSendTransaction = async (tx: Transaction | VersionedTransaction) => {
    // La mayoría de wallets exponen signAndSendTransaction que acepta ambos tipos
    const res = await provider.signAndSendTransaction(tx);
    // Phantom devuelve { signature, publicKey }, algunos devuelven string
    return typeof res === "string" ? res : { signature: res.signature };
  };

  return {
    publicKey: provider.publicKey,
    signAndSendTransaction,
  };
}
