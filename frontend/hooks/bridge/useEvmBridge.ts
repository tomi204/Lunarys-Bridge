// hooks/bridge/useEvmBridge.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { toast } from "sonner";
import { isValidSolanaAddress, sepoliaTxUrl } from "@/lib/bridge/utils";
import { getTokenConfig } from "@/config/tokens";
import { useFhevmBridge } from "@/providers/fhevm-bridge-provider";
import { evmToSolBridge } from "@/lib/bridge/evm/bridge";
import type { BridgePhase } from "@/types/bridge";
import { ERC20_ABI } from "@/abi/erc20";

const SEPOLIA_CHAIN_HEX = "0xaa36a7";

type BridgeResult = { approvalTxHash?: string; bridgeTxHash: string };

export function useEvmBridge({
  amount,
  selectedToken,
  solanaDestination,
}: {
  amount: string;
  selectedToken: string;
  solanaDestination: string;
}) {
  const {
    account,
    chainId,
    encryptSolanaDestination,
    fheStatus,
    isConnected,
    isCorrectNetwork,
    expectedChainId,
    newRelayerAddress,
    signer,
  } = useFhevmBridge();

  const [phase, setPhase] = useState<BridgePhase>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const tokenConfig = useMemo(
    () => getTokenConfig(chainId ?? expectedChainId, selectedToken),
    [chainId, expectedChainId, selectedToken]
  );

  const numericAmount = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  // Leer balance cuando hay signer + tokenConfig
  useEffect(() => {
    const run = async () => {
      if (!account || !signer || !tokenConfig) {
        setBalance(null);
        return;
      }
      setIsLoadingBalance(true);
      try {
        const erc20 = new ethers.Contract(tokenConfig.address, ERC20_ABI, signer);
        const raw = await erc20.balanceOf(account);
        setBalance(ethers.formatUnits(raw, tokenConfig.decimals));
      } catch {
        setBalance(null);
      } finally {
        setIsLoadingBalance(false);
      }
    };
    run();
  }, [account, signer, tokenConfig]);

  const ensureEvmWallet = useCallback(async () => {
    const anyWin = window as any;
    if (!anyWin?.ethereum) {
      toast.error("No Ethereum provider found (install MetaMask or similar).");
      return false;
    }
    try {
      await anyWin.ethereum.request?.({ method: "eth_requestAccounts" });
      return true;
    } catch (e: any) {
      toast.error(e?.message || "EVM wallet connection was rejected.");
      return false;
    }
  }, []);

  const ensureSepoliaNetwork = useCallback(async () => {
    const anyWin = window as any;
    if (!anyWin?.ethereum?.request) return false;
    try {
      await anyWin.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_HEX }],
      });
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Failed to switch to Sepolia.");
      return false;
    }
  }, []);

  const canBridge =
    !!tokenConfig &&
    numericAmount > 0 &&
    isValidSolanaAddress(solanaDestination) &&
    !!newRelayerAddress &&
    fheStatus === "ready";

  const bridge = useCallback(async (): Promise<BridgeResult> => {
    if (!isValidSolanaAddress(solanaDestination)) {
      toast.error("Enter a valid Solana address.");
      throw new Error("Invalid Solana address");
    }
    if (!tokenConfig) {
      toast.error("Token is not configured for this network.");
      throw new Error("Missing token config");
    }
    if (numericAmount <= 0) {
      toast.error("Amount must be greater than zero.");
      throw new Error("Invalid amount");
    }
    if (!newRelayerAddress) {
      toast.error("NewRelayer contract address not found.");
      throw new Error("Missing NewRelayer");
    }
    if (fheStatus !== "ready") {
      toast.error("Secure session is not ready yet.");
      throw new Error("FHE not ready");
    }

    if (!isConnected || !signer) {
      const ok = await ensureEvmWallet();
      if (!ok) throw new Error("No EVM wallet");
    }
    if (!isCorrectNetwork) {
      const ok = await ensureSepoliaNetwork();
      if (!ok) throw new Error("Wrong network");
      await new Promise((r) => setTimeout(r, 600));
    }

    setLoading(true);
    setError(null);
    setPhase("encrypting");

    try {
      const res = await evmToSolBridge({
        signer: signer as ethers.Signer,
        ownerAddress: account as `0x${string}`,
        newRelayerAddress: newRelayerAddress as `0x${string}`,
        tokenAddress: tokenConfig.address as `0x${string}`,
        tokenDecimals: tokenConfig.decimals,
        amountStr: amount,
        destinationSolBase58: solanaDestination,
        encryptSolanaDestination,
      });

      setPhase("bridging");

      toast.success("Bridge confirmed", {
        description: `Tx: ${res.bridgeTxHash.slice(0, 10)}…  •  Open in Etherscan`,
        action: {
          label: "Open",
          onClick: () =>
            window.open(sepoliaTxUrl(res.bridgeTxHash), "_blank", "noopener,noreferrer"),
        },
      });

      setPhase("complete");
      setTimeout(() => setPhase("idle"), 2500);
      return res;
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      setPhase("idle");
      toast.error(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [
    account,
    amount,
    encryptSolanaDestination,
    ensureEvmWallet,
    ensureSepoliaNetwork,
    fheStatus,
    isConnected,
    isCorrectNetwork,
    newRelayerAddress,
    numericAmount,
    signer,
    solanaDestination,
    tokenConfig,
  ]);

  return {
    phase,
    loading,
    error,
    balance,
    isLoadingBalance,
    tokenConfig,
    canBridge,
    bridge,
  };
}
