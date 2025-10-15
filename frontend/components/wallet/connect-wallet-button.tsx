"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useFhevmBridge } from "@/providers/fhevm-bridge-provider";
import { useSolanaWallet } from "@/hooks/useReownSolanaWallet";
import { cn } from "@/lib/utils";

export function ConnectWalletButton({
  className,
}: {
  className?: string;
}) {
  const {
    account,
    isConnected: isEvmConnected,
    connectWallet: connectEvm,
  } = useFhevmBridge();
  const {
    address: solanaAddress,
    isConnected: isSolanaConnected,
    connect: connectSolana,
  } = useSolanaWallet();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const label = useMemo(() => {
    if (isEvmConnected && account) {
      return `${account.slice(0, 6)}...${account.slice(-4)}`;
    }
    if (isSolanaConnected && solanaAddress) {
      return `${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)}`;
    }
    return "Connect wallet";
  }, [isEvmConnected, account, isSolanaConnected, solanaAddress]);

  const subtitle = useMemo(() => {
    if (isEvmConnected && account) {
      return "EVM connected";
    }
    if (isSolanaConnected && solanaAddress) {
      return "Solana connected";
    }
    return "";
  }, [isEvmConnected, account, isSolanaConnected, solanaAddress]);

  const handleSelect = async (handler: () => void | Promise<void>) => {
    setIsBusy(true);
    try {
      await Promise.resolve(handler());
    } finally {
      setIsBusy(false);
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <Button
        className={cn(
          "bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 cursor-pointer px-4 py-6 mx-4 text-base font-semibold text-black shadow-[0_0_40px_rgba(56,226,255,0.35)]",
          className
        )}
        onClick={() => setIsModalOpen(true)}
      >
        <span className="flex flex-col items-center leading-tight">
          <span>{label}</span>
          {subtitle ? (
            <span className="text-xs justify font-normal text-black/60">{subtitle}</span>
          ) : null}
        </span>
      </Button>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#070A1D]/95 p-8 text-white shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-full bg-white/10 cursor-pointer px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/20"
            >
              Close
            </button>

            <div className="flex items-center gap-3">
              <Image
                src="/iso-logo.svg"
                alt="Lunarys"
                width={40}
                height={40}
                className="h-10 w-10"
              />
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-cyan-200/70">
                  Lunarys access panel
                </p>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Choose your network
                </h2>
              </div>
            </div>

            <p className="mt-4 text-sm text-white/70">
              Conecta tu billetera para continuar con el bridge privado. Puedes
              elegir entre EVM (Sepolia) o Solana.
            </p>

            <div className="mt-6 grid gap-4">
              <button
                onClick={() => handleSelect(connectEvm)}
                disabled={isBusy}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 cursor-pointer p-5 text-left transition hover:border-cyan-400/60",
                  isBusy && "cursor-not-allowed opacity-60"
                )}
              >
                <div className="absolute inset-y-0 right-[-30%] w-[60%] rotate-12 bg-gradient-to-l from-cyan-400/20 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">EVM Wallet</h3>
                    <p className="text-xs text-white/60">
                      Conecta Metamask, WalletConnect u otra billetera compatible con Sepolia.
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                    EVM
                  </span>
                </div>
                {isEvmConnected && account ? (
                  <p className="mt-3 text-xs font-mono text-cyan-200/80">
                    Conectado como {account.slice(0, 6)}...{account.slice(-4)}
                  </p>
                ) : null}
              </button>

              <button
                onClick={() => handleSelect(connectSolana)}
                disabled={isBusy}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 cursor-pointer p-5 text-left transition hover:border-violet-400/60",
                  isBusy && "cursor-not-allowed opacity-60"
                )}
              >
                <div className="absolute inset-y-0 left-[-30%] w-[60%] -rotate-12 bg-gradient-to-r from-violet-500/20 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Solana Wallet</h3>
                    <p className="text-xs text-white/60">
                      Conecta Phantom u otra billetera compatible con Solana.
                    </p>
                  </div>
                  <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-200">
                    Solana
                  </span>
                </div>
                {isSolanaConnected && solanaAddress ? (
                  <p className="mt-3 text-xs font-mono text-violet-200/80">
                    Conectado como {solanaAddress.slice(0, 4)}...{solanaAddress.slice(-4)}
                  </p>
                ) : null}
              </button>
            </div>

            <p className="mt-6 text-[11px] text-white/40">
              Al continuar aceptas los términos y confirmas que entiendes los riesgos de redes en beta.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
