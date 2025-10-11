const fromEnv = (name: string): string | undefined =>
  process.env[`NEXT_PUBLIC_${name}`] ??
  process.env[name];

export const RELAYER_ADDR = fromEnv("RELAYER_ADDR")!;

export const CHAIN_ID = Number(fromEnv("CHAIN_ID") ?? "11155111");

export const TOKEN_USDC = fromEnv("TOKEN_USDC")!;

export const TOKEN_SOL = fromEnv("TOKEN_SOL")!;

export const RPC_URL = fromEnv("RPC_URL")!;

export const WALLET_CONNECT_PROJECT_ID = fromEnv("WALLET_CONNECT_PROJECT_ID")!;

export const SOL_DESTINATION_ADDRESS = fromEnv("SOL_DESTINATION_ADDRESS")!;