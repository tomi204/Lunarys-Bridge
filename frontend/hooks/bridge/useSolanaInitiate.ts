// hooks/bridge/useSolanaInitiate.ts
"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { solanaTxUrl } from "@/lib/bridge/utils";
import { getSolanaWalletLike } from "@/lib/bridge/solana/wallet";
import { initRequestWithEth } from "@/lib/bridge/solana/init-request";
import type { SolanaBridgePhase } from "@/types/bridge";

export type InitiateResult = { requestPda: string; sig?: string | null; ethParts?: [bigint, bigint, bigint, bigint] };

export function useSolanaInitiate() {
  const [phase, setPhase] = useState<SolanaBridgePhase>("idle");
  const [loading, setLoading] = useState(false);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [lastRequestPda, setLastRequestPda] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initiate = useCallback(
    async (params: {
      requestId?: bigint;
      ethRecipient: string;     // "0x..."
      amountLocked?: bigint;    // lamports o SPL según tu programa
      feeLocked?: bigint;
      endian?: "be" | "le";
      skipSim?: boolean;
    }): Promise<InitiateResult> => {
      setLoading(true);
      setError(null);
      setLastSig(null);
      setLastRequestPda(null);
      setPhase("locking");

      try {
        const wallet = await getSolanaWalletLike();
        const ownerBase58 =
          (wallet as any).publicKey?.toBase58?.() ?? String((wallet as any).publicKey);
        const requestId = params.requestId ?? 0n;

        const res = await initRequestWithEth(wallet, {
          requestId,
          ownerBase58,
          ethRecipient: params.ethRecipient,
          endian: params.endian ?? "be",
          amountLocked: params.amountLocked ?? 0n,
          feeLocked: params.feeLocked ?? 0n,
          tokenMint: "So11111111111111111111111111111111111111112", // WSOL default
          solver: null,
          claimDeadline: null,
          simulateFirst: params.skipSim ? false : true,
        });

        setLastRequestPda(res.requestPda);
        if (res.sig) setLastSig(res.sig);
        setPhase("burning");

        toast.success(res.created ? "Request creada" : "Request ya existía", {
          description: res.sig ? `Tx: ${res.sig.slice(0, 8)}…` : res.requestPda.slice(0, 8) + "…",
          action: res.sig
            ? { label: "Abrir", onClick: () => window.open(solanaTxUrl(res.sig!), "_blank", "noopener,noreferrer") }
            : undefined,
        });

        return { requestPda: res.requestPda, sig: res.sig ?? null, ethParts: res.ethParts as any };
      } catch (e: any) {
        const msg = e?.message || String(e);
        setError(msg);
        setPhase("idle");
        toast.error(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { initiate, loading, phase, error, lastSig, lastRequestPda };
}
