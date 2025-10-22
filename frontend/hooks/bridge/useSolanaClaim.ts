// hooks/bridge/useSolanaClaim.ts
"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { hexToBytes, solanaTxUrl } from "@/lib/bridge/utils";
import { getSolanaWalletLike } from "@/lib/bridge/solana/wallet";
import { claimBridgeWithWallet } from "@/lib/bridge/solana/claim";
import type { BridgePhase } from "@/types/bridge";

// Public x25519 del solver (solo la pública). La privada siempre server-side.
const SOLVER_PUB_HEX = process.env.NEXT_PUBLIC_SOLVER_X25519_PUBLIC?.trim() ?? "";

export type ClaimResult = { sig: string; offset: string | null };

export function useSolanaClaim() {
  const [phase, setPhase] = useState<BridgePhase>("idle");
  const [loading, setLoading] = useState(false);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [lastOffset, setLastOffset] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Dispara el claim en Solana (ruta Solana → Ethereum).
   * Podés opcionalmente forzar un `computationOffset` para debug.
   */
  const claim = useCallback(
    async (opts?: { computationOffset?: bigint; skipSim?: boolean }): Promise<ClaimResult> => {
      setLoading(true);
      setError(null);
      setLastSig(null);
      setLastOffset(null);
      setPhase("burning");

      try {
        // 1) Wallet de Solana
        const wallet = await getSolanaWalletLike();

        // 2) Public key del solver
        let solverPub: Uint8Array;
        if (SOLVER_PUB_HEX) {
          solverPub = hexToBytes(SOLVER_PUB_HEX);
          if (solverPub.length !== 32) {
            throw new Error("Invalid NEXT_PUBLIC_SOLVER_X25519_PUBLIC (must be 32 bytes).");
          }
        } else {
          // Dev-only: clave efímera para no bloquear tests locales
          const { x25519 } = await import("@arcium-hq/client");
          const sk = x25519.utils.randomSecretKey();
          solverPub = x25519.getPublicKey(sk);
          console.warn("[DEV] Ephemeral x25519 in browser. Backend will not decrypt resealed outputs.");
        }

        // 3) Owner/params (ejemplo: requestId=0n si tu backend/flow lo crea así)
        const requestOwner =
          (wallet as any).publicKey?.toBase58?.() ?? String((wallet as any).publicKey);

        const res = await claimBridgeWithWallet(wallet, {
          requestId: 0n,
          requestOwner,
          solverX25519: solverPub,
          computationOffset: opts?.computationOffset,
          simulateFirst: opts?.skipSim ? false : true,
        });

        setLastSig(res.sig);
        setLastOffset(res.offset);
        setPhase("bridging");

        toast.success("Claim enviado", {
          description: `Tx: ${res.sig.slice(0, 8)}…`,
          action: {
            label: "Abrir",
            onClick: () => window.open(solanaTxUrl(res.sig), "_blank", "noopener,noreferrer"),
          },
        });

        return { sig: res.sig, offset: res.offset ?? null };
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

  return { claim, loading, phase, error, lastSig, lastOffset };
}
