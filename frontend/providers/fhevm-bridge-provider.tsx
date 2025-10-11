"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import bs58 from "bs58";
import { ethers } from "ethers";
import { useFhevm, type FhevmInstance } from "@/lib/fhevm-react";

import { useReownEthersSigner } from "@/hooks/useReownEthersSigner";
import { DEFAULT_CHAIN_ID, getNewRelayerAddress } from "@/config/contracts";

const fallbackRelayer = getNewRelayerAddress(DEFAULT_CHAIN_ID);

if (!fallbackRelayer) {
  throw new Error("Missing default NewRelayer contract address configuration");
}

const FALLBACK_NEW_RELAYER: `0x${string}` = fallbackRelayer;

type EncryptionResult = {
  handle: `0x${string}`;
  proof: `0x${string}`;
  plaintextAsHex: `0x${string}`;
};

type FheStatus = "idle" | "loading" | "ready" | "error";

type FhevmBridgeContextType = {
  account?: `0x${string}`;
  chainId?: number;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  expectedChainId: number;
  ethersProvider?: ethers.BrowserProvider;
  signer?: ethers.Signer | null;
  fhevm?: FhevmInstance;
  fheStatus: FheStatus;
  connectWallet: () => Promise<void>;
  encryptSolanaDestination: (
    solanaAddress: string
  ) => Promise<EncryptionResult>;
  newRelayerAddress: `0x${string}`;
};

const FhevmBridgeContext = createContext<FhevmBridgeContextType | undefined>(
  undefined
);

function normalizeAccount(
  account: string | undefined
): `0x${string}` | undefined {
  if (!account) return undefined;
  try {
    return ethers.getAddress(account) as `0x${string}`;
  } catch {
    return undefined;
  }
}

function decodeSolanaAddressToBigInt(destination: string): {
  value: bigint;
  hex: `0x${string}`;
} {
  const trimmed = destination.trim();
  if (!trimmed) {
    throw new Error("Solana destination address is required");
  }

  let decoded: Uint8Array;
  try {
    decoded = bs58.decode(trimmed);
  } catch (error) {
    throw new Error("Destination is not valid base58 encoding");
  }

  if (decoded.length !== 32) {
    throw new Error("Solana destination must decode to 32 bytes");
  }

  let hex = "0x";
  for (const byte of decoded) {
    hex += byte.toString(16).padStart(2, "0");
  }

  const value = BigInt(hex);
  return { value, hex: hex as `0x${string}` };
}

export function FhevmBridgeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    provider,
    chainId,
    accounts,
    isConnected: appkitConnected,
    connect,
    ethersBrowserProvider,
    ethersSigner,
    initialMockChains,
  } = useReownEthersSigner();

  const account = normalizeAccount(accounts?.[0]);

  const fhevmState = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: Boolean(provider && chainId),
  });
  const fhevm = fhevmState.instance;
  const fheStatus: FheStatus = fhevmState.status;

  const connectWallet = useCallback(async () => {
    connect();
  }, [connect]);

  const newRelayerAddress = useMemo(() => {
    return getNewRelayerAddress(chainId) ?? FALLBACK_NEW_RELAYER;
  }, [chainId]);

  const encryptSolanaDestination = useCallback(
    async (destination: string): Promise<EncryptionResult> => {
      if (!account) {
        throw new Error("Wallet must be connected before encrypting");
      }
      if (!fhevm || fheStatus !== "ready") {
        throw new Error("FHEVM instance is not ready yet");
      }
      if (!newRelayerAddress) {
        throw new Error(
          "Missing NewRelayer contract address for the current chain"
        );
      }
      if (chainId !== undefined && chainId !== DEFAULT_CHAIN_ID) {
        console.warn(
          `Encrypting on unexpected chainId ${chainId}, expected ${DEFAULT_CHAIN_ID}`
        );
      }

      const { value, hex } = decodeSolanaAddressToBigInt(destination);

      const encryptedInput = fhevm.createEncryptedInput(
        newRelayerAddress,
        account
      );

      encryptedInput.add256(value);

      const encrypted = await encryptedInput.encrypt();

      const [firstHandle] = encrypted.handles;
      if (!firstHandle) {
        throw new Error("Encryption did not return any handles");
      }

      return {
        handle: ethers.hexlify(firstHandle) as `0x${string}`,
        proof: ethers.hexlify(encrypted.inputProof) as `0x${string}`,
        plaintextAsHex: hex,
      };
    },
    [account, fhevm, fheStatus, newRelayerAddress, chainId]
  );

  const contextValue = useMemo<FhevmBridgeContextType>(() => {
    return {
      account,
      chainId,
      isConnected: Boolean(account) && appkitConnected,
      isCorrectNetwork:
        chainId === undefined || chainId === DEFAULT_CHAIN_ID,
      expectedChainId: DEFAULT_CHAIN_ID,
      ethersProvider: ethersBrowserProvider,
      signer: (ethersSigner as ethers.Signer | undefined) ?? null,
      fhevm,
      fheStatus,
      connectWallet,
      encryptSolanaDestination,
      newRelayerAddress,
    };
  }, [
    account,
    chainId,
    appkitConnected,
    ethersBrowserProvider,
    ethersSigner,
    fhevm,
    fheStatus,
    connectWallet,
    encryptSolanaDestination,
    newRelayerAddress,
  ]);

  return (
    <FhevmBridgeContext.Provider value={contextValue}>
      {children}
    </FhevmBridgeContext.Provider>
  );
}

export function useFhevmBridge(): FhevmBridgeContextType {
  const context = useContext(FhevmBridgeContext);
  if (!context) {
    throw new Error("useFhevmBridge must be used within <FhevmBridgeProvider>");
  }
  return context;
}
