// hooks/bridge/useBridgeRoute.ts
import { useMemo, useState } from "react";

export function useBridgeRoute() {
  const [fromChain, setFromChain] = useState("solana-devnet");
  const [toChain, setToChain] = useState("sepolia");

  const isSolToEvm = useMemo(() => fromChain.startsWith("solana") && toChain === "sepolia", [fromChain, toChain]);
  const isEvmToSol = useMemo(() => fromChain === "sepolia" && toChain.startsWith("solana"), [fromChain, toChain]);
  const isSolanaTarget = useMemo(() => toChain.startsWith("solana"), [toChain]);

  const swap = () => {
    if (fromChain !== toChain) {
      const fc = fromChain;
      setFromChain(toChain);
      setToChain(fc);
    }
  };

  return { fromChain, toChain, setFromChain, setToChain, swap, isSolToEvm, isEvmToSol, isSolanaTarget };
}
