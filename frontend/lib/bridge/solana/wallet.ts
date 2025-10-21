// lib/bridge/solana/wallet.ts
import type { SolanaWalletLike } from "@/types/bridge";

export async function getSolanaWalletLike(): Promise<SolanaWalletLike> {
  const anyWin = window as any;

  // Phantom
  if (anyWin?.solana?.isPhantom) {
    const provider = anyWin.solana;
    if (!provider.publicKey) await provider.connect();
    return {
      publicKey: provider.publicKey,
      signAndSendTransaction: (tx: any) => provider.signAndSendTransaction(tx),
    };
  }

  // Reown/AppKit (ajustá si tu integración difiere)
  const reown = anyWin?.appkit?.solana || anyWin?.appKit?.solana || anyWin?.reown?.solana;
  const w = reown?.wallet || reown?.getWallet?.();
  if (w) {
    if (!w.publicKey) await w.connect?.();
    if (!w.publicKey || !w.signAndSendTransaction) {
      throw new Error("Solana wallet does not expose signAndSendTransaction");
    }
    return {
      publicKey: w.publicKey,
      signAndSendTransaction: (tx: any) => w.signAndSendTransaction(tx),
    };
  }

  throw new Error("No Solana wallet found. Please install Phantom or connect via AppKit.");
}
