// hooks/bridge/useSolanaInitiate.ts
"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { solanaTxUrl } from "@/lib/bridge/utils";
import { initRequestWithEthAnchor } from "@/lib/bridge/solana/init-request.anchor";
import type { SolanaBridgePhase } from "@/types/bridge";

export type InitiateResult = {
  requestPda: string;
  sig?: string | null;
  ethParts?: [bigint, bigint, bigint, bigint];
};

/**
 * Dispara la initiate SPL (`initiate_bridge`) usando Anchor.
 * - Conecta Phantom/AppKit si hace falta
 * - Lee el SPL mint desde NEXT_PUBLIC_SPL_MINT (o permite override por param)
 * - Simula antes de enviar (por defecto) y muestra AnchorError legible si falla
 */
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
      amountLocked?: bigint;    // unidades del SPL (p.ej. 10 USDC => 10_000_000n)
      skipSim?: boolean;        // default: false (o sea simula por defecto)
      splMint?: string;         // opcional: override de NEXT_PUBLIC_SPL_MINT
    }): Promise<InitiateResult> => {
      setLoading(true);
      setError(null);
      setLastSig(null);
      setLastRequestPda(null);
      setPhase("locking");

      try {
        // Asegurar wallet conectada (Phantom/AppKit)
        const anyWin = window as any;
        const w =
          anyWin?.solana ??
          anyWin?.phantom?.solana ??
          anyWin?.appkit?.solana ??
          anyWin?.appKit?.solana;

        if (!w) throw new Error("No se encontró wallet Solana (Phantom/AppKit).");
        if (!w.isConnected) {
          await w.connect();
        }

        const ownerBase58 =
          typeof w.publicKey?.toBase58 === "function"
            ? w.publicKey.toBase58()
            : String(w.publicKey);

        const splMint = params.splMint ?? process.env.NEXT_PUBLIC_SPL_MINT;
        if (!splMint) throw new Error("Falta NEXT_PUBLIC_SPL_MINT en .env.local");

        const res = await initRequestWithEthAnchor({
          ownerBase58,
          requestId: params.requestId ?? 0n,
          splMint,
          ethRecipient: params.ethRecipient,
          amountLocked: params.amountLocked ?? 0n,
          simulateFirst: params.skipSim ? false : true,
        });

        setLastRequestPda(res.requestPda);
        if (res.sig) setLastSig(res.sig);
        setPhase("burning");

        toast.success("Initiate submitted", {
          description: res.sig
            ? `Tx: ${res.sig.slice(0, 8)}…`
            : res.requestPda.slice(0, 8) + "…",
          action: res.sig
            ? {
                label: "Open",
                onClick: () =>
                  window.open(
                    solanaTxUrl(res.sig!),
                    "_blank",
                    "noopener,noreferrer"
                  ),
              }
            : undefined,
        });

        return {
          requestPda: res.requestPda,
          sig: res.sig ?? null,
          ethParts: undefined as any, // mantener forma por compatibilidad
        };
      } catch (e: any) {
        const msg = e?.error?.errorMessage ?? e?.message ?? String(e);
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
