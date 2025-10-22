export type BridgePhase = "idle" | "encrypting" | "burning" | "bridging" | "complete";

export type SolanaWalletLike = {
  publicKey: any; // Phantom/AppKit publicKey
  signAndSendTransaction: (tx: any) => Promise<{ signature: string } | string>;
};

export type BridgeError = {
  short?: string;
  detail?: string;
};


export const PHASE = {
  IDLE: "idle",
  LOCKING: "locking",   // ← iniciar bridge (init_request)
  BURNING: "burning",   // ← claim/burn
  BRIDGING: "bridging", // ← en tránsito
  SETTLING: "settling", // ← esperando settle
  DONE: "done",
  ERROR: "error",
} as const;

export type SolanaBridgePhase = typeof PHASE[keyof typeof PHASE];
