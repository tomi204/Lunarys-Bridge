"use client";

import { ethers } from "ethers";
import {
  createContext,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
} from "@reown/appkit/react";

export interface UseReownEthersSignerState {
  provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  accounts: string[] | undefined;
  isConnected: boolean;
  error: Error | undefined;
  connect: () => void;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<
    (ethersSigner: ethers.JsonRpcSigner | undefined) => boolean
  >;
  ethersBrowserProvider: ethers.BrowserProvider | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  initialMockChains: Readonly<Record<number, string>> | undefined;
}

function useReownEthersSignerInternal(parameters: {
  initialMockChains?: Readonly<Record<number, string>>;
}): UseReownEthersSignerState {
  const { initialMockChains } = parameters;
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const { chainId } = useAppKitNetwork();
  const { open } = useAppKit();

  const [ethersSigner, setEthersSigner] = useState<
    ethers.JsonRpcSigner | undefined
  >(undefined);
  const [ethersBrowserProvider, setEthersBrowserProvider] = useState<
    ethers.BrowserProvider | undefined
  >(undefined);
  const [ethersReadonlyProvider, setEthersReadonlyProvider] = useState<
    ethers.ContractRunner | undefined
  >(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);

  const chainIdRef = useRef<number | undefined>(
    typeof chainId === "number" ? chainId : undefined
  );
  const ethersSignerRef = useRef<ethers.JsonRpcSigner | undefined>(undefined);

  const sameChain = useRef((chainId: number | undefined) => {
    return chainId === chainIdRef.current;
  });

  const sameSigner = useRef(
    (ethersSigner: ethers.JsonRpcSigner | undefined) => {
      return ethersSigner === ethersSignerRef.current;
    }
  );

  const walletProviderRef = useRef<ethers.Eip1193Provider | undefined>(
    undefined
  );

  const connect = () => {
    open({ view: "Connect", chainNamespace: "eip155" } as any);
  };

  useEffect(() => {
    chainIdRef.current = typeof chainId === "number" ? chainId : undefined;
  }, [chainId]);

  useEffect(() => {
    const numericChainId = typeof chainId === "number" ? chainId : undefined;

    if (!walletProvider || !numericChainId || !isConnected || !address) {
      walletProviderRef.current = undefined;
      ethersSignerRef.current = undefined;
      setEthersSigner(undefined);
      setEthersBrowserProvider(undefined);
      setEthersReadonlyProvider(undefined);
      setError(undefined);
      return;
    }

    if (
      walletProviderRef.current === walletProvider &&
      sameChain.current(numericChainId) &&
      sameSigner.current(ethersSignerRef.current)
    ) {
      return;
    }

    try {
      const bp: ethers.BrowserProvider = new ethers.BrowserProvider(
        walletProvider as ethers.Eip1193Provider
      );
      let rop: ethers.ContractRunner = bp;
      const rpcUrl: string | undefined = initialMockChains?.[numericChainId];

      if (rpcUrl) {
        rop = new ethers.JsonRpcProvider(rpcUrl);
      }

      const signer = new ethers.JsonRpcSigner(bp, address);
      ethersSignerRef.current = signer;
      setEthersSigner(signer);
      setEthersBrowserProvider(bp);
      setEthersReadonlyProvider(rop);
      setError(undefined);
      walletProviderRef.current = walletProvider as ethers.Eip1193Provider;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      setError(error);
      ethersSignerRef.current = undefined;
      setEthersSigner(undefined);
      setEthersBrowserProvider(undefined);
      setEthersReadonlyProvider(undefined);
    }
  }, [walletProvider, chainId, isConnected, address, initialMockChains]);

  return {
    sameChain,
    sameSigner,
    provider: walletProvider as ethers.Eip1193Provider | undefined,
    chainId: typeof chainId === "number" ? chainId : undefined,
    accounts: address ? [address] : undefined,
    isConnected,
    connect,
    ethersBrowserProvider,
    ethersReadonlyProvider,
    ethersSigner,
    error,
    initialMockChains,
  };
}

const ReownEthersSignerContext = createContext<
  UseReownEthersSignerState | undefined
>(undefined);

const EMPTY_CHAIN_MAP: Readonly<Record<number, string>> = Object.freeze({});

interface ReownEthersSignerProviderProps {
  children: ReactNode;
  initialMockChains?: Readonly<Record<number, string>>;
}

export const ReownEthersSignerProvider: React.FC<
  ReownEthersSignerProviderProps
> = ({ children, initialMockChains }) => {
  const stableMockChains = useMemo(() => {
    return initialMockChains ?? EMPTY_CHAIN_MAP;
  }, [initialMockChains]);

  const props = useReownEthersSignerInternal({
    initialMockChains: stableMockChains,
  });
  return (
    <ReownEthersSignerContext.Provider value={props}>
      {children}
    </ReownEthersSignerContext.Provider>
  );
};

export function useReownEthersSigner() {
  const context = useContext(ReownEthersSignerContext);
  if (context === undefined) {
    throw new Error(
      "useReownEthersSigner must be used within a ReownEthersSignerProvider"
    );
  }
  return context;
}
