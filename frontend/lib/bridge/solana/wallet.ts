"use client";
import type { SolanaWalletLike } from "./init-request";
import { VersionedTransaction, Transaction } from "@solana/web3.js";

export async function getSolanaWalletLike(): Promise<SolanaWalletLike> {
  const provider = (window as any)?.solana ?? (window as any)?.phantom?.solana;
  if (!provider) throw new Error("No se encontró wallet Solana (Phantom/Solflare).");
  if (!provider.isConnected) await provider.connect();

  const signAndSendTransaction = async (tx: Transaction | VersionedTransaction) => {
    const res = await provider.signAndSendTransaction(tx);
    return typeof res === "string" ? res : { signature: res.signature };
    // si tu wallet usa sendRawTransaction: serializá primero
  };
  return { publicKey: provider.publicKey, signAndSendTransaction };
}
