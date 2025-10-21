export type BridgePhase = "idle" | "encrypting" | "burning" | "bridging" | "complete";

export type SolanaWalletLike = {
  publicKey: any; // Phantom/AppKit publicKey
  signAndSendTransaction: (tx: any) => Promise<{ signature: string } | string>;
};

export type BridgeError = {
  short?: string;
  detail?: string;
};