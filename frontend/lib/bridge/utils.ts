// lib/bridge/common/utils.ts
export const isValidSolanaAddress = (address: string): boolean => {
  if (!address || address.trim().length === 0) return false;
  const re = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return re.test(address.trim());
};

export const isValidEthereumAddress = (address: string): boolean => {
  if (!address || address.trim().length === 0) return false;
  const re = /^0x[a-fA-F0-9]{40}$/;
  return re.test(address.trim());
};

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error("hex inválido");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function solanaTxUrl(sig: string): string {
  const clusterParam = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes("devnet") ? "devnet" : "mainnet";
  return `https://explorer.solana.com/tx/${sig}?cluster=${clusterParam}`;
}

export const sepoliaTxUrl = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;
