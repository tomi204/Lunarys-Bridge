"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownUp, ArrowRight } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId as useWagmiChainId,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import {
  type Address,
  parseAbi,
  parseUnits,
  zeroAddress,
} from "viem";

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

import {
  RELAYER_ADDR,
  CHAIN_ID,
  TOKEN_USDC,
  SOL_DESTINATION_ADDRESS,
} from "@/lib/constants";
import {
  aliasAddressFromSolanaBase58,
  encryptEaddressForContract,
} from "@/lib/fhe/encrypt";

// Import ABIs and normalize to viem ABI at runtime.
import { ERC20_ABI as ERC20_HR, RELAYER_ABI as RELAYER_HR } from "@/lib/abi";
const ERC20_ABI = parseAbi(ERC20_HR as readonly string[]);
const RELAYER_ABI = parseAbi(RELAYER_HR as readonly string[]);

// UI options (kept simple; only USDC on Sepolia side)
const chainOptions = [
  { value: "solana-devnet", label: "Solana Devnet", tagline: "Finality < 1s" },
  { value: "sepolia", label: "Sepolia", tagline: "Ethereum testnet" },
];
const tokenOptions = [{ value: "USDC", label: "USDC", subtitle: "Dollar stablecoin" }];
const quickStats = [
  { label: "Privacy score", value: "99.1%" },
  { label: "ETA", value: "0.58s" },
  { label: "Route", value: "Tier 1" },
];

function etherscanTx(hash?: `0x${string}`) {
  if (!hash) return "#";
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

export default function BridgePage() {
  // wagmi
  const { address } = useAccount();
  const chainId = useWagmiChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChain } = useSwitchChain();

  // ui state
  const [fromChain, setFromChain] = useState("solana-devnet");
  const [toChain, setToChain] = useState("sepolia");
  const [amount, setAmount] = useState("10.00");
  const [selectedToken, setSelectedToken] = useState("USDC");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  // token meta (fetched)
  const [symbol, setSymbol] = useState<string>("USDC");
  const [decimals, setDecimals] = useState<number>(6);

  // Destination alias (Solana base58 -> deterministic EVM alias) from env
  const evmAliasForSolDest = useMemo(
    () => aliasAddressFromSolanaBase58(SOL_DESTINATION_ADDRESS),
    []
  );

  // Derived
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

  const tokenAddress: Address =
    selectedToken === "USDC" ? (TOKEN_USDC as Address) : (zeroAddress as Address);

  const networkOk = chainId === CHAIN_ID;

  // Minimal token metadata: symbol + decimals
  useEffect(() => {
    (async () => {
      if (!publicClient) return;
      try {
        const [sym, dec] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "symbol",
          }) as Promise<string>,
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "decimals",
          }) as Promise<number>,
        ]);
        setSymbol(sym ?? selectedToken);
        setDecimals(Number(dec ?? 6));
      } catch {
        setSymbol(selectedToken);
        setDecimals(6);
      }
    })();
  }, [publicClient, tokenAddress, selectedToken]);

  const handleSwapChains = () => {
    if (fromChain === toChain) return;
    setFromChain(toChain);
    setToChain(fromChain);
  };

  // Main action: approve USDC if needed, encrypt destination, call initiateBridge.
  const handleInitiateBridge = async () => {
    setTxHash(undefined);
    try {
      if (!address) throw new Error("Connect a wallet.");
      if (!walletClient) throw new Error("Wallet client not available.");
      if (!publicClient) throw new Error("Public client not available.");
      if (!networkOk) {
        // Optional: auto-switch to expected chain
        try {
          switchChain({ chainId: CHAIN_ID });
          return;
        } catch {
          throw new Error("Wrong network. Please switch to the expected chain.");
        }
      }

      // Parse amount
      const amountBN = parseUnits(amount || "0", decimals);

      // Approve if needed
      const allowance = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, RELAYER_ADDR as Address],
      })) as bigint;

      if (allowance < amountBN) {
        const approveHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [RELAYER_ADDR as Address, amountBN],
          account: address,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // Encrypt destination: produces (handle, proof)
      const { handle, proof } = await encryptEaddressForContract({
        contractAddress: RELAYER_ADDR as Address,
        userAddress: address,
        evmAliasAddress: evmAliasForSolDest,
      });

      // Call relayer.initiateBridge(token, amount, handle, proof)
      const hash = await walletClient.writeContract({
        address: RELAYER_ADDR as Address,
        abi: RELAYER_ABI,
        functionName: "initiateBridge",
        args: [tokenAddress, amountBN, handle, proof],
        account: address,
      });

      setIsLoading(true);
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const fromDetails = chainOptions.find((c) => c.value === fromChain);
  const toDetails = chainOptions.find((c) => c.value === toChain);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {isLoading && <ScannerCardStream fromChain={fromChain} toChain={toChain} />}
      <ConstellationBackground className="z-0" particleCount={220} maxLineDistance={200} />
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,rgba(56,226,255,0.25),transparent_60%)]" />
      <div className="absolute bottom-[-20%] left-[15%] h-[420px] w-[420px] rounded-full bg-violet-500/25 blur-[140px]" />
      <div className="absolute top-[30%] right-[-5%] h-[460px] w-[460px] rounded-full bg-cyan-500/25 blur-[140px]" />

      <header className="relative z-20">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/iso-logo.svg"
              alt="Lunarys logo"
              width={36}
              height={36}
              className="h-9 w-9 animate-spin-slow"
              priority
            />
            <span className="text-2xl font-semibold tracking-tight">Lunarys</span>
          </Link>

          <nav className="hidden items-center gap-10 rounded-full border border-white/5 bg-white/5 px-6 py-2 backdrop-blur-xl md:flex">
            <Link href="/" className="text-sm font-medium text-gray-200 transition-colors hover:text-white">
              Home
            </Link>
            <Link href="/#experience" className="text-sm font-medium text-gray-200 transition-colors hover:text-white">
              Features
            </Link>
            <Link href="/#docs" className="text-sm font-medium text-gray-200 transition-colors hover:text-white">
              Docs
            </Link>
            <Link href="/#team" className="text-sm font-medium text-gray-200 transition-colors hover:text-white">
              Team
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-24">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 pt-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <Badge className="bg-white/10 text-cyan-200">Bridge cockpit</Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Launch a private bridge
            </h1>
          </div>

          <Card className="w-full border-white/10 bg-white/5 shadow-[0_45px_140px_-80px_rgba(56,226,255,0.8)]">
            <CardContent className="space-y-8 p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
                {/* From */}
                <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
                  <div className="flex items-center justify-between text-xs uppercase tracking-widest text-gray-400">
                    <Label className="text-xs uppercase tracking-widest text-gray-400">From</Label>
                    {fromDetails ? <span className="text-gray-500">{fromDetails.tagline}</span> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={fromChain} onValueChange={setFromChain}>
                      <SelectTrigger className="w-[180px] border-white/10 bg-white/10 text-lg font-semibold text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#030712] text-white">
                        {chainOptions.map((chain) => (
                          <SelectItem
                            key={chain.value}
                            value={chain.value}
                            disabled={chain.value === toChain}
                          >
                            <div className="flex flex-col">
                              <span>{chain.label}</span>
                              <span className="text-xs text-gray-400">{chain.tagline}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedToken} onValueChange={setSelectedToken}>
                      <SelectTrigger className="w-[120px] border-white/10 bg-white/10 text-base font-semibold text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#030712] text-white">
                        {tokenOptions.map((token) => (
                          <SelectItem key={token.value} value={token.value}>
                            <div className="flex flex-col">
                              <span>{token.label}</span>
                              <span className="text-xs text-gray-400">{token.subtitle}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    type="number"
                    value={amount}
                    min="0"
                    onChange={(e) => setAmount(e.target.value)}
                    className="border-0 bg-transparent p-0 text-4xl font-semibold text-white focus-visible:ring-0"
                  />

                  {/* Destination is taken from env; keep a read-only indicator */}
                  <div className="mt-4 space-y-2 text-left">
                    <Label className="text-xs uppercase tracking-widest text-gray-400">
                      Solana destination (from env)
                    </Label>
                    <Input
                      value={SOL_DESTINATION_ADDRESS}
                      readOnly
                      className="border-white/10 bg-white/10 text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Balance: — {symbol}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
                      disabled
                    >
                      Max
                    </Button>
                  </div>
                </div>

                {/* Swap */}
                <div className="flex items-center justify-center">
                  <Button
                    onClick={handleSwapChains}
                    variant="outline"
                    size="icon"
                    className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white transition-all hover:-translate-y-1 hover:bg-white/20"
                    disabled={fromChain === toChain}
                    aria-label="Swap chains"
                  >
                    <ArrowDownUp className="h-6 w-6" />
                  </Button>
                </div>

                {/* To */}
                <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
                  <div className="flex items-center justify-between text-xs uppercase tracking-widest text-gray-400">
                    <Label className="text-xs uppercase tracking-widest text-gray-400">To</Label>
                    {toDetails ? <span className="text-gray-500">{toDetails.tagline}</span> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={toChain} onValueChange={setToChain}>
                      <SelectTrigger className="w-[180px] border-white/10 bg-white/10 text-lg font-semibold text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#030712] text-white">
                        {chainOptions.map((chain) => (
                          <SelectItem
                            key={chain.value}
                            value={chain.value}
                            disabled={chain.value === fromChain}
                          >
                            <div className="flex flex-col">
                              <span>{chain.label}</span>
                              <span className="text-xs text-gray-400">{chain.tagline}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
                      Receive · {symbol}
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                    <div className="flex items-center justify-between">
                      <span>You receive</span>
                      <span className="text-lg font-semibold text-white">
                        {estimatedReceive} {symbol}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Protocol fee</span>
                      <span>{protocolFee} {symbol}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Network fee</span>
                      <span>{networkFee} {symbol}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="flex flex-col gap-3">
                {!networkOk && (
                  <Button
                    onClick={() => switchChain({ chainId: CHAIN_ID })}
                    variant="outline"
                    className="w-full border-cyan-400/40 bg-white/5 text-white"
                  >
                    Switch to correct network
                  </Button>
                )}
                <Button
                  onClick={handleInitiateBridge}
                  disabled={isLoading || !address || !walletClient || !publicClient || !networkOk}
                  className="w-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 py-4 text-base font-semibold text-black shadow-[0_0_40px_rgba(56,226,255,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "Processing..." : "Initiate bridge"}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>

              {txHash && (
                <div className="text-sm text-gray-300">
                  Sent!{" "}
                  <a
                    className="underline text-cyan-300"
                    href={etherscanTx(txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Etherscan
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid w-full gap-4 text-sm text-gray-400 sm:grid-cols-3">
            {quickStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center backdrop-blur"
              >
                <span className="text-xs uppercase tracking-[0.35em] text-gray-500">
                  {stat.label}
                </span>
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
