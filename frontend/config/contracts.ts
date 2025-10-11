export const NEW_RELAYER_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: "0x80A4aC24C022cCCe157F59E63EF7A7abf644e515",
};

export const DEFAULT_CHAIN_ID = 11155111;

export function getNewRelayerAddress(chainId: number | undefined): `0x${string}` | undefined {
  if (!chainId) return undefined;
  return NEW_RELAYER_ADDRESSES[chainId] ?? undefined;
}
