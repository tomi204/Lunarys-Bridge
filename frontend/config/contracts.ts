import { RELAYER_ADDR } from "@/lib/constants";

export const NEW_RELAYER_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: RELAYER_ADDR as `0x${string}`,
};

export const DEFAULT_CHAIN_ID = 11155111;

export function getNewRelayerAddress(chainId: number | undefined): `0x${string}` | undefined {
  if (!chainId) return undefined;
  return NEW_RELAYER_ADDRESSES[chainId] ?? undefined;
}