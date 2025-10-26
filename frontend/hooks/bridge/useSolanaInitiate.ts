"use client";

import { useCallback, useState } from "react";
import { Connection, SendTransactionError } from "@solana/web3.js";
import { toast } from "sonner";

import { initRequestWithEthAnchor } from "@/lib/bridge/solana/init-request.anchor";
import { toBaseUnits, solanaTxUrl } from "@/lib/bridge/utils";
import { getDefaultSplUsdc, detectSolanaCluster } from "@/config/tokens";
import { getAnchorProvider } from "@/lib/bridge/solana/anchor-program";

export type SolanaBridgePhase = "idle" | "locking" | "encrypting" | "burning" | "bridging";

export type InitiateResult = {
  requestPda: string;
  sig?: string | null;
  ethParts?: [bigint, bigint, bigint, bigint];
};

type InitiateParams = {
  fromChain?: string;       // "solana-devnet" | "solana-mainnet" | "sepolia" ...
  requestId?: bigint;
  ethRecipient: string;     // 0x...
  humanAmount?: string;     // "5.00"
  decimals?: number;        // 6 por defecto (USDC)
  amountLocked?: bigint;    // en base units (si ya lo traes)
  skipSim?: boolean;
  splMint?: string;         // override del mint SPL
};

export function useSolanaInitiate() {
  const [phase, setPhase] = useState<SolanaBridgePhase>("idle");
  const [loading, setLoading] = useState(false);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [lastRequestPda, setLastRequestPda] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initiate = useCallback(
    async (params: InitiateParams): Promise<InitiateResult> => {
      setLoading(true);
      setError(null);
      setLastSig(null);
      setLastRequestPda(null);
      setPhase("locking");

      // Para obtener logs on-chain si algo falla
      let connection: Connection | undefined;

      try {
        // 0) Validaciones rápidas
        const ethOk = /^0x[0-9a-fA-F]{40}$/.test(params.ethRecipient.trim());
        if (!ethOk) throw new Error("Ethereum address inválida (esperado 0x + 40 hex)");

        // 1) Resolver cluster/mint/decimals si venimos de Solana
        const isFromSolana = (params.fromChain ?? "").toLowerCase().startsWith("solana");
        const cluster = detectSolanaCluster(); // devnet | mainnet-beta | testnet

        const defaultSplUsdc = isFromSolana ? getDefaultSplUsdc() : undefined;
        const resolvedMint =
          params.splMint ??
          defaultSplUsdc?.mint ??
          process.env.NEXT_PUBLIC_SPL_MINT ??
          "";

        const resolvedDecimals =
          params.decimals ??
          defaultSplUsdc?.decimals ??
          6;

        if (isFromSolana && !resolvedMint) {
          throw new Error("Falta configurar el mint SPL (p.ej. USDC). Define NEXT_PUBLIC_SPL_MINT o revisa config/tokens.ts");
        }

        // 2) Wallet Solana
        const anyWin = window as any;
        const w =
          anyWin?.solana ??
          anyWin?.phantom?.solana ??
          anyWin?.appkit?.solana ??
          anyWin?.appKit?.solana;

        if (!w) throw new Error("No se encontró wallet Solana (Phantom/AppKit).");
        if (!w.isConnected) await w.connect();

        const ownerBase58 =
          typeof w.publicKey?.toBase58 === "function"
            ? w.publicKey.toBase58()
            : String(w.publicKey);

        // Connection para logs
        try {
          const provider = getAnchorProvider(w);
          connection = provider?.connection;
        } catch {
          // si falla, igual seguimos; solo perderíamos getLogs()
        }

        // 3) Calcular amountLocked (base units)
        let amountLocked: bigint | undefined = params.amountLocked;
        if (amountLocked === undefined) {
          const human = (params.humanAmount ?? "").trim();
          if (!human) throw new Error("Ingresa un monto (humanAmount)");
          const n = Number(human);
          if (!Number.isFinite(n) || n <= 0) throw new Error("Monto inválido (> 0)");
          amountLocked = toBaseUnits(human, resolvedDecimals);
        }

        // 4) Llamada Anchor (init SPL)
        const res = await initRequestWithEthAnchor({
          ownerBase58,
          requestId: params.requestId ?? 0n,
          splMint: resolvedMint,
          ethRecipient: params.ethRecipient.trim(),
          amountLocked,
          simulateFirst: params.skipSim ? false : true,
        });

        setLastRequestPda(res.requestPda);
        if (res.sig) setLastSig(res.sig);
        setPhase("burning");

        toast.success(`Initiate submitted${defaultSplUsdc?.label ? ` · ${defaultSplUsdc.label}` : ""}`, {
          description: res.sig ? `Tx: ${res.sig.slice(0, 8)}…` : res.requestPda.slice(0, 8) + "…",
          action: res.sig
            ? {
                label: "Open",
                onClick: () => window.open(solanaTxUrl(res.sig!), "_blank", "noopener,noreferrer"),
              }
            : undefined,
        });

        return {
          requestPda: res.requestPda,
          sig: res.sig ?? null,
          ethParts: undefined as any,
        };
      } catch (e: any) {
        // Intenta mostrar logs de simulación
        if (e?.logs?.length) {
          console.error("[simulate logs]\n" + e.logs.join("\n"));
        }
        // Intenta mostrar logs de envío
        try {
          const isSendTxErr =
            e instanceof SendTransactionError || (typeof e?.getLogs === "function" && connection);
          if (isSendTxErr && connection) {
            const logs = await e.getLogs(connection);
            if (logs?.length) console.error("[on-chain logs]\n" + logs.join("\n"));
          }
        } catch {
          // no-op
        }

        const msg = e?.error?.errorMessage ?? e?.message ?? "Transaction failed";
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