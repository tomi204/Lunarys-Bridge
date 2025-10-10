// src/config/config.schema.ts
import { z } from 'zod';
import type { Hex } from 'viem';
import type { BridgeMessage } from 'src/message/canonical';

const wsUrl  = z.string().refine(s => { try { const u = new URL(s); return u.protocol === 'ws:' || u.protocol === 'wss:'; } catch { return false; } }, 'must be ws(s) URL');
const httpUrl= z.string().refine(s => { try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } }, 'must be http(s) URL');

const base58Re = /^[1-9A-HJ-NP-Za-km-z]+$/;
const ethAddrRe = /^0x[a-fA-F0-9]{40}$/;
const hexPkRe   = /^0x[0-9a-fA-F]{64}$/;
const hex32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'must be 0x + 32 bytes hex').transform(s => s as Hex);

// EVM -> Solana token mapping for SPL tokens (USDC/EUROC).
// origin must be bytes32 (EVM address left-padded to 32 bytes).
const TokenMapSchema = z.array(z.object({
  type: z.literal('spl'),
  origin: hex32,
  mint: z.string().regex(base58Re),   // SPL mint (USDC or EUROC on Solana)
  escrow: z.string().regex(base58Re), // SPL TokenAccount vault owned by the PDA signer
}));

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development','production','test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  // Triton WS (Solana logsSubscribe)
  TRITON_WS_URL: wsUrl,
  SOLANA_PROGRAM_ID: z.string().min(32).max(44).regex(base58Re),

  // Accounts required by your ReleaseSpl instruction
  ARCIUM_PROGRAM_ID: z.string().min(32).max(44).regex(base58Re),
  SOLANA_COMP_DEF_ACCOUNT: z.string().min(32).max(44).regex(base58Re),
  // Optional override; if omitted, we derive with seed "sign"
  SOLANA_SIGN_PDA: z.string().min(32).max(44).regex(base58Re).optional(),

  // Encrypted events
  EVENT_ENC_KEY_HEX: z.string().regex(/^[0-9a-fA-F]{64}$/, 'must be 32-byte hex'),
  EVENT_KEYS: z.string().optional(), // "1=hex,2=hex,..."

  // Ethereum (for Locker watcher)
  ETH_RPC_WSS: wsUrl,
  ETH_RPC_HTTP: httpUrl.optional(),
  ETH_CHAIN_ID: z.coerce.number().int().positive().default(11155111),
  ETH_LOCKER_ADDR: z.preprocess(
    v => (typeof v==='string' && v.trim()==='' ? undefined : v),
    z.string().regex(ethAddrRe).optional()
  ),

  // EVM submission (optional; SOL->EVM only; safe to leave unset for USDC/EUROC EVM->SOL)
  EXECUTOR_ADDR: z.string().regex(ethAddrRe).optional(),
  EVM_RELAYER_PK: z.string().regex(hexPkRe).optional(),
  LOCAL_SIGNER_PK: z.string().regex(hexPkRe).optional(), // dev fallback attester

  // Solana submit (required for EVM -> SOL)
  SOLANA_RPC_HTTP: httpUrl.optional(),
  SOLANA_PAYER_SECRET: z.string().optional(), // base58 or JSON array

  // Arcium HTTP attester (optional)
  ARCIUM_API_URL: z.string().url().optional(),
  ARCIUM_TIMEOUT_MS: z.coerce.number().int().positive().optional(),

  CONFIRM_SOL_COMMITMENT: z.enum(['processed','confirmed','finalized']).default('confirmed'),

  // Token mapping JSON (see example .env below)
  TOKEN_MAP_JSON: z.string().optional(),
});
export type EnvVars = z.infer<typeof EnvSchema>;

// Canonical BridgeMessage validation
export const BridgeMessageSchema: z.ZodType<BridgeMessage> = z.object({
  version: z.number().int().min(0).max(255),
  dir: z.number().int().min(0).max(255),
  srcChainId: z.string().regex(/^\d+$/).transform(BigInt),
  dstChainId: z.string().regex(/^\d+$/).transform(BigInt),
  srcTxId: hex32,
  originToken: hex32,
  amount: z.string().regex(/^\d+$/).transform(BigInt),
  recipient: hex32,
  nonce: z.string().regex(/^\d+$/).transform(BigInt),
  expiry: z.string().regex(/^\d+$/).transform(BigInt),
}).strict();

// Runtime helpers
export type TokenMapEntry = z.infer<typeof TokenMapSchema>[number];
export function parseTokenMapFromEnv(raw?: string): TokenMapEntry[] {
  if (!raw || !raw.trim()) return [];
  const parsed = JSON.parse(raw);
  return TokenMapSchema.parse(parsed);
}
