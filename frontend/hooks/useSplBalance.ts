// hooks/bridge/useSplBalance.ts
"use client";

import { useEffect, useState } from "react";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

type SplBalance = {
  uiAmountString: string | null; // "1.2345"
  rawAmount: bigint;             // base units
  loading: boolean;
  error?: string | null;
};

export function useSplBalance(mintBase58?: string): SplBalance {
  const [state, setState] = useState<SplBalance>({
    uiAmountString: null,
    rawAmount: 0n,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!mintBase58) {
          setState({ uiAmountString: null, rawAmount: 0n, loading: false, error: null });
          return;
        }

        const anyWin = window as any;
        const w = anyWin?.solana ?? anyWin?.phantom?.solana ?? anyWin?.appkit?.solana ?? anyWin?.appKit?.solana;
        if (!w || !w.isConnected) {
          setState(s => ({ ...s, loading: false, error: "Wallet Solana no conectada" }));
          return;
        }

        const owner = new PublicKey(w.publicKey.toString());
        const mint = new PublicKey(mintBase58);

        const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
        const conn = new Connection(rpc, "confirmed");

        const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

        const info = await conn.getTokenAccountBalance(ata).catch(() => null);
        if (!info) {
          if (!cancelled) setState({ uiAmountString: "0", rawAmount: 0n, loading: false, error: null });
          return;
        }

        const raw = BigInt(info.value.amount ?? "0");
        const ui = info.value.uiAmountString ?? String(info.value.uiAmount ?? 0);
        if (!cancelled) setState({ uiAmountString: ui, rawAmount: raw, loading: false, error: null });
      } catch (e: any) {
        if (!cancelled) setState({ uiAmountString: null, rawAmount: 0n, loading: false, error: e?.message ?? String(e) });
      }
    })();

    return () => { cancelled = true; };
  }, [mintBase58]);

  return state;
}