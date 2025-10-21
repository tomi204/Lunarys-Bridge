"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownUp, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { ConstellationBackground } from "@/components/constellation-background";
import { Footer } from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScannerCardStream } from "@/components/ui/scanner-card-stream";
import { ChainInfo } from "@/components/ui/chain-info";
import { MatrixText } from "@/components/ui/matrix-text";
import { InlineMatrixText } from "@/components/ui/inline-matrix-text";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";

// Hooks
import { useBridgeRoute } from "@/hooks/bridge/useBridgeRoute";
import { useSolanaClaim } from "@/hooks/bridge/useSolanaClaim";
import { useEvmBridge } from "@/hooks/bridge/useEvmBridge";
import { isValidSolanaAddress, isValidEthereumAddress } from "@/lib/bridge/utils";
import { useFhevmBridge } from "@/providers/fhevm-bridge-provider";

/* ---------- Logos ---------- */

const EthereumLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path fill="#343434" d="m127.961 0-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" />
    <path fill="#8C8C8C" d="M127.962 0 0 212.32l127.962 75.639V154.158z" />
    <path fill="#3C3C3B" d="m127.961 312.187-1.575 1.92v98.199l1.575 4.6L256 236.587z" />
    <path fill="#8C8C8C" d="M127.962 416.905v-104.72L0 236.585z" />
    <path fill="#141414" d="m127.961 287.958 127.96-75.637-127.96-58.162z" />
    <path fill="#393939" d="m.001 212.321 127.96 75.637V154.159z" />
  </svg>
);

const SolanaLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 397.7 311.7" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="solGradient1" x1="360.879" y1="351.455" x2="141.213" y2="-69.294" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00ffa3" />
        <stop offset="1" stopColor="#dc1fff" />
      </linearGradient>
      <linearGradient id="solGradient2" x1="264.829" y1="401.601" x2="45.163" y2="-19.148" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00ffa3" />
        <stop offset="1" stopColor="#dc1fff" />
      </linearGradient>
      <linearGradient id="solGradient3" x1="312.548" y1="376.688" x2="92.882" y2="-44.061" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#00ffa3" />
        <stop offset="1" stopColor="#dc1fff" />
      </linearGradient>
    </defs>
    <path fill="url(#solGradient1)" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z" />
    <path fill="url(#solGradient2)" d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1z" />
    <path fill="url(#solGradient3)" d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c-3 0 4.6-11.1z" />
  </svg>
);

const USDCLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 2000 2000" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="1000" cy="1000" r="1000" fill="#2775CA" />
    <path
      fill="#fff"
      d="M1275 1158.33c0-145.83-87.5-195.83-262.5-216.66-125-16.67-150-50-150-108.34s41.67-95.83 125-95.83c75 0 116.67 25 137.5 87.5 4.17 12.5 16.67 20.83 29.17 20.83h66.66c16.67 0 29.17-12.5 29.17-29.16v-4.17c-16.67-91.67-91.67-162.5-187.5-170.83v-100c0-16.67-12.5-29.17-33.33-33.34h-62.5c-16.67 0-29.17 12.5-33.34 33.34v95.83c-125 16.67-204.16 100-204.16 204.17 0 137.5 83.33 191.66 258.33 212.5 116.67 20.83 154.17 45.83 154.17 112.5s-58.34 112.5-137.5 112.5c-108.34 0-145.84-45.84-158.34-108.34-4.16-16.66-16.66-25-29.16-25h-70.84c-16.66 0-29.16 12.5-29.16 29.17v4.17c16.66 104.16 83.33 179.16 220.83 200v100c0 16.66 12.5 29.16 33.33 33.33h62.5c16.67 0 29.17-12.5 33.34-33.33v-100c125-20.84 208.33-108.34 208.33-220.84z"
    />
    <path
      fill="#fff"
      d="M787.5 1595.83c-325-116.66-491.67-479.16-370.83-800 62.5-175 200-308.33 370.83-370.83 16.67-8.33 25-20.83 25-41.67V325c0-16.67-8.33-29.17-25-33.33-4.17 0-12.5 0-16.67 4.16-395.83 125-612.5 545.84-487.5 941.67 75 233.33 254.17 412.5 487.5 487.5 16.67 8.33 33.34 0 37.5-16.67 4.17-4.16 4.17-8.33 4.17-16.66v-58.34c0-12.5-12.5-29.16-25-37.5zM1229.17 295.83c-16.67-8.33-33.34 0-37.5 16.67-4.17 4.17-4.17 8.33-4.17 16.67v58.33c0 16.67 12.5 33.33 25 41.67 325 116.66 491.67 479.16 370.83 800-62.5 175-200 308.33-370.83 370.83-16.67 8.33-25 20.83-25 41.67V1700c0 16.67 8.33 29.17 25 33.33 4.17 0 12.5 0 16.67-4.16 395.83-125 612.5-545.84 487.5-941.67-75-237.5-258.34-416.67-487.5-491.67z"
    />
  </svg>
);

/* ---------- Constantes UI ---------- */

const chainOptions = [
  { value: "solana-devnet", label: "Solana Devnet", tagline: "Finality < 1s" },
  { value: "sepolia", label: "Sepolia", tagline: "Ethereum testnet" },
];

const tokenOptions = [{ value: "USDC", label: "USDC", subtitle: "USD Coin (Sepolia)" }];

const quickStats = [
  { label: "Privacy score", value: "99.1%" },
  { label: "ETA", value: "0.58s" },
  { label: "Route", value: "Tier 1" },
];

// ✅ Obligatorio SOLO para Solana → Ethereum
const REQUIRE_ETH_DEST_ON_CLAIM = true;

export default function BridgePage() {
  // Ruta
  const { fromChain, toChain, setFromChain, setToChain, swap, isSolToEvm, isEvmToSol } =
    useBridgeRoute();

  // Estado UI
  const [amount, setAmount] = useState("10.00");
  const [selectedToken, setSelectedToken] = useState("USDC");

  // Destinos
  const [destinationAddress, setDestinationAddress] = useState(""); // Solana (EVM→Sol)
  const [destinationAddressError, setDestinationAddressError] = useState<string | null>(null);

  const [ethereumDestination, setEthereumDestination] = useState(""); // Ethereum (Sol→EVM)
  const [ethereumDestinationError, setEthereumDestinationError] = useState<string | null>(null);

  const ethereumDestinationValid = useMemo(
    () =>
      ethereumDestination.trim().length > 0 &&
      isValidEthereumAddress(ethereumDestination.trim()),
    [ethereumDestination]
  );

  // Hooks negocio
  const { claim, phase: solPhase, loading: solLoading, error: solErr, lastSig: lastSolSig } =
    useSolanaClaim();
  const {
    bridge,
    phase: evmPhase,
    loading: evmLoading,
    error: evmErr,
    balance,
    isLoadingBalance,
    tokenConfig,
    canBridge,
  } = useEvmBridge({ amount, selectedToken, solanaDestination: destinationAddress });

  // (Opcional) Debug FHE/chain en UI
  const { isConnected, isCorrectNetwork, fheStatus } = useFhevmBridge();

  // Wallet Solana presente (UX)
  const [hasSolWallet, setHasSolWallet] = useState(false);
  useEffect(() => {
    const anyWin = window as any;
    const phantom = !!anyWin?.solana?.isPhantom;
    const reown = !!(anyWin?.appkit?.solana || anyWin?.appKit?.solana || anyWin?.reown?.solana);
    setHasSolWallet(phantom || reown);
  }, []);

  // Fase/Loading combinados
  const phase = isSolToEvm ? solPhase : evmPhase;
  const isLoading = isSolToEvm ? solLoading : evmLoading;

  // Mates rápidos
  const numericAmount = useMemo(() => {
    const parsed = Number.parseFloat(amount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amount]);

  const estimatedReceive = useMemo(() => {
    const value = numericAmount * 0.996;
    return value <= 0
      ? "0.00"
      : value.toLocaleString("en-US", { maximumFractionDigits: 4, minimumFractionDigits: 2 });
  }, [numericAmount]);

  const protocolFee = useMemo(() => {
    const value = numericAmount * 0.0025;
    return value <= 0
      ? "0.000"
      : value.toLocaleString("en-US", { maximumFractionDigits: 3, minimumFractionDigits: 3 });
  }, [numericAmount]);

  const networkFee = useMemo(() => {
    const value = numericAmount * 0.0004;
    return value <= 0
      ? "0.000"
      : value.toLocaleString("en-US", { maximumFractionDigits: 3, minimumFractionDigits: 3 });
  }, [numericAmount]);

  // Mensajes de ayuda
  const helperMessage = useMemo(() => {
    if (isSolToEvm) {
      if (!hasSolWallet) return "Connect your Solana wallet (Phantom/AppKit) to claim.";
      if (REQUIRE_ETH_DEST_ON_CLAIM && ethereumDestination.trim().length === 0)
        return "Enter the Ethereum destination address.";
      if (REQUIRE_ETH_DEST_ON_CLAIM && !isValidEthereumAddress(ethereumDestination))
        return "Enter a valid Ethereum address (0x...).";
      return "Your Ethereum address will be used at the release step.";
    }
    // EVM → Sol
    if (destinationAddress.trim().length === 0) return "Enter the Solana destination address.";
    if (!isValidSolanaAddress(destinationAddress)) return "Enter a valid Solana address.";
    if (numericAmount <= 0) return "Enter an amount greater than zero.";
    if (!tokenConfig && isEvmToSol) return "Pick a supported token for this route.";
    return null;
  }, [
    isSolToEvm,
    hasSolWallet,
    ethereumDestination,
    destinationAddress,
    numericAmount,
    tokenConfig,
    isEvmToSol,
  ]);

  // Disable del botón (solo obliga EVM address en Sol→EVM)
  const isBridgeDisabled =
    isLoading ||
    (isSolToEvm
      ? !hasSolWallet || (REQUIRE_ETH_DEST_ON_CLAIM && !ethereumDestinationValid)
      : !canBridge);

  // Acción principal (claim o bridge)
  const onAction = async () => {
    if (isSolToEvm) {
      if (REQUIRE_ETH_DEST_ON_CLAIM && !ethereumDestinationValid) {
        toast.error("Enter a valid Ethereum address (0x...).");
        return;
      }
      // Ej.: persistir para el release
      // localStorage.setItem("ethDestinationForClaim", ethereumDestination.trim());
      return claim();
    }
    return bridge();
  };

  // Middle swap
  const handleSwapChains = () => {
    if (fromChain !== toChain) swap();
  };

  // Max button
  const handleMaxClick = () => {
    if (balance) setAmount(balance);
  };

  // Debug compacto
  const debugStatus = (
    <div className="text-xs text-gray-500 grid grid-cols-2 gap-1 mt-2">
      <div>EVM connected: <span className={isConnected ? "text-emerald-400" : "text-red-400"}>{String(isConnected)}</span></div>
      <div>Sepolia network: <span className={isCorrectNetwork ? "text-emerald-400" : "text-red-400"}>{String(isCorrectNetwork)}</span></div>
      <div>FHE ready: <span className={fheStatus === "ready" ? "text-emerald-400" : "text-red-400"}>{String(fheStatus === "ready")}</span></div>
      <div>Token cfg: <span className={tokenConfig ? "text-emerald-400" : "text-red-400"}>{String(!!tokenConfig)}</span></div>
    </div>
  );

  const fromDetails = chainOptions.find((c) => c.value === fromChain);
  const toDetails = chainOptions.find((c) => c.value === toChain);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {phase === "encrypting" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]">
          <MatrixText text="Encrypting" className="min-h-0" initialDelay={0} letterAnimationDuration={300} letterInterval={80} />
        </div>
      )}
      {phase === "burning" && (
        <ScannerCardStream fromChain={fromChain} toChain={toChain} tokenSymbol={selectedToken} />
      )}
      {phase === "bridging" && (
        <ChainInfo fromChain={fromChain} toChain={toChain} tokenSymbol={selectedToken} amount={amount} />
      )}

      <ConstellationBackground className="z-0" particleCount={220} maxLineDistance={200} />
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,rgba(56,226,255,0.25),transparent_60%)]" />
      <div className="absolute bottom-[-20%] left-[15%] h-[420px] w-[420px] rounded-full bg-violet-500/25 blur-[140px]" />
      <div className="absolute top-[30%] right-[-5%] h-[460px] w-[460px] rounded-full bg-cyan-500/25 blur-[140px]" />

      <header className="relative z-20">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/iso-logo.svg" alt="Lunarys logo" width={36} height={36} className="h-9 w-9 animate-spin-slow" priority />
            <span className="text-2xl font-semibold tracking-tight">Lunarys</span>
          </Link>
          <nav className="hidden items-center gap-10 rounded-full border border-white/5 bg-white/5 px-6 py-2 backdrop-blur-xl md:flex">
            <Link href="/" className="text-sm font-medium text-gray-200 transition-colors hover:text-white">Home</Link>
            <Link href="/#experience" className="text-sm font-medium text-gray-200 transition-colors hover:text-white">Features</Link>
            <Link href="/#docs" className="text-sm font-medium text-gray-200 transition-colors hover:text-white">Docs</Link>
            <Link href="/#team" className="text-sm font-medium text-gray-200 transition-colors hover:text-white">Team</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/terms" className="hidden text-sm text-gray-200 transition-colors hover:text-white md:block">Terms</Link>
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-24">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 pt-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <Badge className="bg-white/10 text-cyan-200">
              <InlineMatrixText text="Bridge cockpit" initialDelay={300} letterAnimationDuration={400} letterInterval={80} />
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              <InlineMatrixText text="Launch a private bridge" initialDelay={500} letterAnimationDuration={400} letterInterval={60} />
            </h1>
          </div>

          <Card className="w-full border-white/10 bg-white/5 shadow-[0_45px_140px_-80px_rgba(56,226,255,0.8)]">
            <CardContent className="space-y-8 p-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
                {/* Left panel - From */}
                <div className="space-y-6 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-widest text-gray-400">From</Label>
                    {fromDetails ? <span className="text-xs text-gray-500">{fromDetails.tagline}</span> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={fromChain} onValueChange={setFromChain}>
                      <SelectTrigger className="w-[220px] border-white/10 bg-white/10 px-5 py-4 text-base font-semibold text-white">
                        <div className="flex items-center gap-3"><SelectValue /></div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#030712] text-white border-white/10">
                        {chainOptions.map((chain) => (
                          <SelectItem key={chain.value} value={chain.value} disabled={chain.value === toChain} className="py-4 px-3">
                            <div className="flex items-center gap-4">
                              {chain.value.includes("solana") ? <SolanaLogo className="w-6 h-6 shrink-0" /> : <EthereumLogo className="w-6 h-6 shrink-0" />}
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium">{chain.label}</span>
                                <span className="text-xs text-gray-400">{chain.tagline}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedToken} onValueChange={setSelectedToken}>
                      <SelectTrigger className="w-[180px] border-white/10 bg-white/10 px-2 py-4 text-base font-semibold text-white">
                        <div className="flex items-center gap-3"><USDCLogo className="w-6 h-6 shrink-0" /><SelectValue /></div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#030712] p-3 text-white border-white/10">
                        {tokenOptions.map((token) => (
                          <SelectItem key={token.value} value={token.value} className="py-4 px-3">
                            <div className="flex items-center">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium">{token.label}</span>
                                <span className="text-xs text-gray-400">{token.subtitle}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount (afecta EVM → Sol) */}
                  <div className="space-y-2">
                    <Input
                      type="number"
                      value={amount}
                      min="0"
                      step="0.01"
                      onChange={(e) => setAmount(e.target.value)}
                      className="border-0 bg-transparent p-0 text-4xl font-semibold text-white focus-visible:ring-0"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Balance</span>
                      <div className="flex items-center gap-2">
                        <USDCLogo className="w-5 h-5 opacity-70" />
                        <span className="text-sm font-medium text-gray-300">
                          {/* El balance real lo trae el hook en EVM→Sol; acá mostramos placeholder o el valor si existe */}
                          {Number.isFinite(Number(balance))
                            ? `${Number(balance).toLocaleString("en-US", { maximumFractionDigits: 4, minimumFractionDigits: 2 })} ${selectedToken}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={handleMaxClick}
                      disabled={!balance || isNaN(Number(balance))}
                      className="rounded-lg px-5 py-2.5 text-sm font-semibold text-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Max
                    </Button>
                  </div>
                </div>

                {/* Middle swap button */}
                <div className="flex items-center justify-center">
                  <Button
                    onClick={handleSwapChains}
                    variant="outline"
                    className="h-14 w-14 rounded-2xl border border-white/20 bg-white/10 text-white transition-all hover:-translate-y-1 hover:bg-white/20"
                    disabled={fromChain === toChain}
                    aria-label="Swap chains"
                  >
                    <ArrowDownUp className="h-6 w-6" />
                  </Button>
                </div>

                {/* Right panel - To */}
                <div className="space-y-6 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-widest text-gray-400">To</Label>
                    {toDetails ? <span className="text-xs text-gray-500">{toDetails.tagline}</span> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={toChain} onValueChange={setToChain}>
                      <SelectTrigger className="w-[220px] border-white/10 bg-white/10 px-5 py-4 text-base font-semibold text-white">
                        <div className="flex items-center gap-3"><SelectValue /></div>
                      </SelectTrigger>
                      <SelectContent className="bg-[#030712] text-white border-white/10">
                        {chainOptions.map((chain) => (
                          <SelectItem key={chain.value} value={chain.value} disabled={chain.value === fromChain} className="py-4 px-3">
                            <div className="flex items-center gap-4">
                              {chain.value.includes("solana") ? <SolanaLogo className="w-6 h-6 shrink-0" /> : <EthereumLogo className="w-6 h-6 shrink-0" />}
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium">{chain.label}</span>
                                <span className="text-xs text-gray-400">{chain.tagline}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-medium text-gray-300">
                      <USDCLogo className="w-5 h-5 shrink-0" />
                      <span>Receive · {selectedToken}</span>
                    </div>
                  </div>

                  {/* Fees summary */}
                  <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
                    <div className="flex items-center justify-between pb-4 border-b border-white/10">
                      <span className="text-sm font-medium text-gray-300">You receive</span>
                      <div className="flex items-center gap-2.5">
                        <USDCLogo className="w-6 h-6" />
                        <span className="text-xl font-semibold text-white">{estimatedReceive} {selectedToken}</span>
                      </div>
                    </div>

                    <div className="space-y-3.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Protocol fee (0.25%)</span>
                        <div className="flex items-center gap-2">
                          <USDCLogo className="w-4 h-4 opacity-60" />
                          <span className="font-medium text-gray-300">{protocolFee} {selectedToken}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Network fee</span>
                        <div className="flex items-center gap-2">
                          <USDCLogo className="w-4 h-4 opacity-60" />
                          <span className="font-medium text-gray-300">{networkFee} {selectedToken}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Destination inputs */}
                  {isEvmToSol && (
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-widest text-gray-400">Solana destination address</Label>
                      <Input
                        value={destinationAddress}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDestinationAddress(value);
                          if (value.trim().length > 0 && !isValidSolanaAddress(value)) {
                            setDestinationAddressError("Invalid Solana address format");
                          } else {
                            setDestinationAddressError(null);
                          }
                        }}
                        placeholder="e.g. 4Nd1K..."
                        className={`border-white/10 bg-white/10 py-3 text-sm text-white placeholder:text-gray-500 focus-visible:ring-cyan-400/20 ${
                          destinationAddressError ? "border-red-500/50" : ""
                        }`}
                      />
                      {destinationAddressError ? (
                        <p className="text-xs leading-relaxed text-red-400">{destinationAddressError}</p>
                      ) : (
                        <p className="text-xs leading-relaxed text-gray-500">
                          We secure the address before forwarding it to the NewRelayer contract.
                        </p>
                      )}
                    </div>
                  )}

                  {isSolToEvm && (
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-widest text-gray-400">Ethereum destination address</Label>
                      <Input
                        value={ethereumDestination}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEthereumDestination(value);
                          if (value.trim().length > 0 && !isValidEthereumAddress(value)) {
                            setEthereumDestinationError("Invalid Ethereum address format");
                          } else {
                            setEthereumDestinationError(null);
                          }
                        }}
                        placeholder="0x..."
                        className={`border-white/10 bg-white/10 py-3 text-sm text-white placeholder:text-gray-500 focus-visible:ring-cyan-400/20 ${
                          ethereumDestinationError ? "border-red-500/50" : ""
                        }`}
                      />
                      {ethereumDestinationError ? (
                        <p className="text-xs leading-relaxed text-red-400">{ethereumDestinationError}</p>
                      ) : (
                        <p className="text-xs leading-relaxed text-gray-500">
                          This address will be used at the EVM release step. The Solana claim itself does not submit it on-chain.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Inline debug (sólo útil en EVM→Sol) */}
                  {isEvmToSol && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 grid grid-cols-2 gap-1">
                        <div>EVM connected: <span className={isConnected ? "text-emerald-400" : "text-red-400"}>{String(isConnected)}</span></div>
                        <div>Sepolia network: <span className={isCorrectNetwork ? "text-emerald-400" : "text-red-400"}>{String(isCorrectNetwork)}</span></div>
                        <div>FHE ready: <span className={fheStatus === "ready" ? "text-emerald-400" : "text-red-400"}>{String(fheStatus === "ready")}</span></div>
                        <div>Token cfg: <span className={tokenConfig ? "text-emerald-400" : "text-red-400"}>{String(!!tokenConfig)}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="space-y-4 pt-4">
                <Button
                  onClick={onAction}
                  disabled={isBridgeDisabled}
                  className="w-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 py-6 text-lg font-semibold text-black shadow-[0_0_40px_rgba(56,226,255,0.35)] transition-all hover:shadow-[0_0_60px_rgba(56,226,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <InlineMatrixText
                      text={isSolToEvm ? "Claiming" : "Encrypting"}
                      className="text-black"
                      initialDelay={0}
                      letterAnimationDuration={200}
                      letterInterval={50}
                    />
                  ) : isSolToEvm ? (
                    "Claim on Solana"
                  ) : fheStatus === "ready" ? (
                    "Initiate bridge"
                  ) : (
                    "Preparing secure session..."
                  )}
                  {!isLoading && <ArrowRight className="ml-2 h-5 w-5" />}
                </Button>

                {/* Mensajes informativos */}
                {helperMessage && (
                  <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                    <p className="text-sm leading-relaxed text-blue-300">{helperMessage}</p>
                  </div>
                )}

                {/* Errores de los hooks */}
                {(solErr || evmErr) && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                    <p className="text-sm leading-relaxed text-red-400">{solErr || evmErr}</p>
                  </div>
                )}

                {/* Feedback simple para Sol→EVM */}
                {lastSolSig && (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                    <p className="text-sm leading-relaxed text-emerald-300">
                      Claim submitted. Check toast to open in explorer.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid w-full gap-4 text-sm text-gray-400 sm:grid-cols-3">
            {quickStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center backdrop-blur">
                <span className="text-xs uppercase tracking-[0.35em] text-gray-500">{stat.label}</span>
                <div className="mt-2 text-2xl font-semibold text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
